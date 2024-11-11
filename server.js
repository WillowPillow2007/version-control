const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('.database/datasource.db'); // Path to SQLite database

// Store clients by game_id
const gameClients = {};

const app = express();
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
        // If there's an error during the insert operation
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
          // If there’s an error during the query
          return res.status(500).json({ success: false, message: 'Internal error occurred.' });
      }

      if (!row) {
          // If no game found or the game is not in "open" state
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
              // Error while updating the game state
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
  // Check if the session has a game_id
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

          // Clear the session game_id as the room is deleted
          req.session.game_id = null;

          res.status(200).json({ success: true, message: 'Game room deleted successfully!' });
      });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  let currentGameId = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    // When a player joins a game room, store the WebSocket connection
    if (data.type === 'join_game') {
      currentGameId = data.game_id;

      // Store the client connection in the corresponding game room
      if (!gameClients[currentGameId]) {
        gameClients[currentGameId] = [];
      }
      gameClients[currentGameId].push(ws);

      console.log(`Player joined game ${currentGameId}`);
    }

    // Handle game actions (e.g., player move)
    if (data.type === 'move' && currentGameId) {
      // Broadcast the move to the other player in the same game room
      gameClients[currentGameId].forEach(client => {
        if (client !== ws) {
          client.send(JSON.stringify({
            type: 'move',
            data: data.data // send move data to other player
          }));
        }
      });
    }
  });

  ws.on('close', () => {
    // Remove the player from the game room when they disconnect
    if (currentGameId && gameClients[currentGameId]) {
      gameClients[currentGameId] = gameClients[currentGameId].filter(client => client !== ws);
      console.log(`Player disconnected from game ${currentGameId}`);
    }
  });
});
