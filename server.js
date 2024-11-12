const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('.database/datasource.db'); // Path to SQLite database

const app = express();
const server = http.createServer(app);
const io = socketIo(server);  // Initialize socket.io with the server

// Store clients by game_id
const gameClients = {};

app.use(bodyParser.json());

// Session setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Redirect to menu.html on the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'menu.html'));
});

// Catch-all route for other paths
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'menu.html'));
});

// POST route to create a game room
app.post('/api/create-room', (req, res) => {
  const { game_id } = req.body;

  // Check if the game_id already exists (optional check to ensure unique game_id)
  const checkQuery = 'SELECT * FROM Games WHERE game_id = ?';
  db.get(checkQuery, [game_id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal error occurred while checking game ID.' });
    }

    if (row) {
      // If the game_id already exists, return an error
      return res.status(400).json({ success: false, message: 'Game ID already exists. Please choose a different game ID.' });
    }

    // Insert a new game record into the database
    const query = 'INSERT INTO Games (game_id, game_state, game_time_elapsed) VALUES (?, "open", 0)';
    db.run(query, [game_id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to create game room.' });
      }

      // Set the session game_id to track this room for the user (the creator)
      req.session.game_id = game_id;

      // Send a success response
      res.status(200).json({ success: true, message: 'Game room created successfully!' });
    });
  });
});

// POST route for joining a game room
app.post('/api/join-room', (req, res) => {
  const { game_id } = req.body;
  const session_id = req.session.id;  // Using the session ID for player 2

  // Query to check if the game exists and is in the "open" state
  const query = 'SELECT * FROM Games WHERE game_id = ? AND game_state = "open"';
  db.get(query, [game_id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal error occurred.' });
    }

    if (!row) {
      return res.status(400).json({ success: false, message: 'Invalid game code or the game is no longer open.' });
    }

    // Game found and is open, now we proceed to join the game

    // Update the game to "in_progress" state and assign the session ID of player 2
    const updateQuery = `
      UPDATE Games 
      SET game_state = "in_progress", player_2_session_id = ?, current_turn = "player_1"
      WHERE game_id = ?`;
    db.run(updateQuery, [session_id, game_id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to join the game.' });
      }

      // Set the session game_id to track this room for the user
      req.session.game_id = game_id;

      // Respond with success
      res.status(200).json({ success: true, message: 'Successfully joined the game!' });
    });
  });
});

// POST route to delete a game room
app.post('/api/delete-room', (req, res) => {
  if (!req.session.game_id) {
    return res.status(400).json({ success: false, message: 'No active game to delete.' });
  }

  const game_id = req.session.game_id;

  // Delete the game from the database if the state is still open
  const query = 'SELECT * FROM Games WHERE game_id = ? AND game_state = "open"';
  db.get(query, [game_id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error checking game state.' });
    }

    if (!row) {
      return res.status(400).json({ success: false, message: 'Game is no longer open or has already been deleted.' });
    }

    const deleteQuery = 'DELETE FROM Games WHERE game_id = ?';
    db.run(deleteQuery, [game_id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete the game.' });
      }

      req.session.game_id = null;

      res.status(200).json({ success: true, message: 'Game room deleted successfully!' });
    });
  });
});

// Socket.io logic for handling real-time connections
io.on('connection', (socket) => {
  let currentGameId = null;
  let playerId = null;

  // When a player joins a game
  socket.on('join_game', (data) => {
    currentGameId = data.game_id;
    playerId = data.player_id;

    if (!gameClients[currentGameId]) gameClients[currentGameId] = [];
    gameClients[currentGameId].push({ socket, playerId });

    console.log(`Player ${playerId} joined game ${currentGameId}`);
    socket.emit('game_status', { message: 'You joined the game.' });

    // Notify the other player if both players are connected
    if (gameClients[currentGameId].length === 2) {
      const opponent = gameClients[currentGameId].find(client => client.socket !== socket);
      opponent.socket.emit('game_status', { message: 'Your opponent has joined!' });

      // Emit the game_updated event to update the game state for both players
      const gameData = getGameData(currentGameId); // Retrieve the game data from the database
      io.to(currentGameId).emit('game_updated', gameData); // Emit the event to both players
    }
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    if (currentGameId && gameClients[currentGameId]) {
      console.log(`Player ${playerId} disconnected from game ${currentGameId}`);

      // Find the remaining player in the game and declare them the winner
      const remainingPlayer = gameClients[currentGameId].find(client => client.socket !== socket);
      if (remainingPlayer) {
        remainingPlayer.socket.emit('game_over', {
          message: 'Your opponent disconnected. You win!',
          result: 'win'
        });
      }

      // Clean up the game
      gameClients[currentGameId] = gameClients[currentGameId].filter(client => client.socket !== socket);
      if (gameClients[currentGameId].length === 0) {
        delete gameClients[currentGameId];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});