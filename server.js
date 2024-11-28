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
    secret: 'WillowPillow@1802',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
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

app.post('/api/create-room', (req, res) => {
    const { game_id, game_state, player_id } = req.body;

    const checkQuery = 'SELECT * FROM Games WHERE game_id = ?';
    db.get(checkQuery, [game_id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Internal error occurred while checking game ID.' });
        }

        if (row) {
            return res.status(400).json({ success: false, message: 'Game ID already exists. Please choose a different game ID.' });
        }

        const initialOccupiedWalls = JSON.stringify({ horizontal: [], vertical: [] });

        // Randomly select the starting player (either 'player_1' or 'player_2')
        const startingTurn = Math.random() < 0.5 ? 'player_1' : 'player_2';

        const query = `
            INSERT INTO Games (game_id, game_state, game_time_elapsed, player_1_session_id, current_turn, occupied_walls)
            VALUES (?, ?, 0, ?, ?, ?)
        `;
        db.run(query, [game_id, game_state, req.session.id, startingTurn, initialOccupiedWalls], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to create game room.' });
            }

            // Initialize player 1's data
            const player1Query = `
                UPDATE Games
                SET player1_x = 8, player1_y = 4, player1_color = "#f0f", player1_wall_count = 10
                WHERE game_id = ?`;
            db.run(player1Query, [game_id], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to store Player 1 data.' });
                }

                // Set session data
                req.session.game_id = game_id;
                req.session.player_id = player_id;
                res.status(200).json({ success: true, message: 'Game room created successfully!' });
            });
        });
    });
});

app.post('/api/join-room', (req, res) => {
    const { game_id, player_id } = req.body;

    // Query to check if the game exists and is in the "open" state
    const query = 'SELECT * FROM Games WHERE game_id = ? AND game_state = "open"';
    db.get(query, [game_id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Internal error occurred.' });
        }

        if (!row) {
            return res.status(400).json({ success: false, message: 'Invalid game code or the game is no longer open.' });
        }

        // Create a new session for Player 2
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to create a new session for Player 2.' });
            }

            const sessionId = req.session.id;

            // Update game state and current turn
            const updateQuery = `
                UPDATE Games
                SET game_state = "in_progress", player_2_session_id = ?
                WHERE game_id = ?`;
            db.run(updateQuery, [sessionId, game_id], function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to join the game.' });
                }

                // Insert Player 2's data (coordinates, color, and wall count)
                const player2Query = `
                    UPDATE Games
                    SET player2_x = 0, player2_y = 4, player2_color = "#00ff00", player2_wall_count = 10
                    WHERE game_id = ?`;
                db.run(player2Query, [game_id], function(err) {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Failed to store Player 2 data.' });
                    }

                    // Store Player 2's session data
                    req.session.game_id = game_id;
                    req.session.player_id = player_id;

                    res.status(200).json({ success: true, message: 'Successfully joined the game!' });
                });
            });
        });
    });
});

// Delete a game room
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

app.get('/game/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    res.render('game-online.html', { gameId });
});

// Socket.io setup for real-time communication
io.on('connection', (socket) => {
    let currentGameId = null;
    let playerId = null;

    // Server-side: Handling 'join_game' event
    socket.on('join_game', (data) => {
        console.log('join_game event received:', data);

        currentGameId = data.game_id;
        playerId = data.player_id;

        // Ensure there's an entry for this game in the gameClients object
        if (!gameClients[currentGameId]) {
            gameClients[currentGameId] = [];
        }

        // Add the player to the gameClients object
        gameClients[currentGameId].push({ socket, playerId });

        console.log(`Player ${playerId} joined game ${currentGameId}`);
        console.log('gameClients:', gameClients);

        // If both players have joined, redirect them to the game room
        if (gameClients[currentGameId].length === 2) {
            // Emit redirect_to_game event to both players
            gameClients[currentGameId].forEach(client => {
                const url = `game-online.html?room=${currentGameId}&playerId=${client.playerId}`;
                client.socket.emit('redirect_to_game', { url });
            });
        }
    });

    socket.on('update-socket-id', (data) => {
        const gameId = data.gameId;
        const playerId = data.playerId;
        const newSocketId = socket.id;
        
        // Update the socket in gameClients
        gameClients[gameId].forEach((client) => {
            if (client.playerId === playerId) {
                client.socket = socket;
            }
        });
        
        console.log(`Socket updated for player ${playerId} in game ${gameId}: ${newSocketId}`);
    });

    // Handle 'game_over' event from the client (user clicks the button to end the game)
    socket.on('game_over', (data) => {
        const { gameId, winnerId } = data;  // Get the game ID and winner's player ID from the data
        const winnerNumber = winnerId.split('_')[1];

        // Check the game state in the database
        db.get('SELECT game_state FROM Games WHERE game_id = ?', [gameId], (err, row) => {
            if (err) {
                console.error('Error fetching game state:', err);
                return;
            }

            if (row && row.game_state === 'in_progress') {
                // Update the game state to 'done' in the database
                db.run('UPDATE Games SET game_state = "done" WHERE game_id = ?', [gameId], function (err) {
                    if (err) {
                        console.error('Error setting game state:', err);
                        return;
                    }

                    console.log(`Game ${gameId} is now over.`);

                    // Create the game over message
                    const message = `Player ${winnerNumber} wins! The game is over.`;

                    // Emit game over event to all connected clients
                    io.emit('game_over', { message, playerId: winnerId });

                    // Redirect players to the menu page after 5 seconds and delete the game row from the database
                    setTimeout(() => {
                        io.emit('redirect_to_menu', { url: '/menu.html' });

                        // Delete the game row from the database
                        db.run('DELETE FROM Games WHERE game_id = ?', [gameId], function (err) {
                            if (err) {
                                console.error('Error deleting game row:', err);
                                return;
                            }

                            console.log(`Game row deleted from database.`);
                        });
                    }, 5000);
                });
            }
        });
    });

    socket.on('fetch-turn', (data) => {
        const { gameID } = data;
    
        // Retrieve the current turn from the database without changing it
        db.get('SELECT current_turn FROM Games WHERE game_id = ?', [gameID], (err, row) => {
            if (err) {
                console.error(err);
                return;
            }
    
            if (!row) {
                console.error(`No game found with ID ${gameID}`);
                return;
            }
    
            // Emit the current turn without updating it
            socket.emit('turn-fetched', { currentTurn: row.current_turn });
        });
    });

    socket.on('get-initial-data', (data) => {
        console.log('Received get-initial-data request for game:', data.game_id);
    
        const gameId = data.game_id; // Get the game ID from the request
    
        // Fetch player data, occupied walls, and current turn from the database based on the gameId
        db.get('SELECT player1_x, player1_y, player1_color, player1_wall_count, player2_x, player2_y, player2_color, player2_wall_count, occupied_walls, current_turn FROM Games WHERE game_id = ?', [gameId], (err, row) => {
            if (err) {
                console.error('Error fetching game data:', err);
                return;
            }
    
            if (!row) {
                console.error(`No game found with ID ${gameId}`);
                return;
            }
    
            // Prepare the player data to send back to the client
            const playersData = [
                {
                    player_id: 'player_1',
                    x: row.player1_x,
                    y: row.player1_y,
                    color: row.player1_color,
                    wall_count: row.player1_wall_count,
                },
                {
                    player_id: 'player_2',
                    x: row.player2_x,
                    y: row.player2_y,
                    color: row.player2_color,
                    wall_count: row.player2_wall_count,
                }
            ];
    
            // Parse the occupied_walls JSON string back into an object
            const occupiedWalls = JSON.parse(row.occupied_walls);
    
            // Convert the arrays back into Sets
            occupiedWalls.horizontal = new Set(occupiedWalls.horizontal);
            occupiedWalls.vertical = new Set(occupiedWalls.vertical);
    
            // Emit the player data and occupied walls to the client
            socket.emit('initial-data', { players: playersData, occupiedWalls });
        });
    });        

    // Listen for player move events
    socket.on('player_move', (data) => {
        const { game_id, player_id, new_x, new_y } = data;

        // Retrieve the current game state from the database
        db.get('SELECT * FROM Games WHERE game_id = ?', [game_id], (err, game) => {
            if (err) {
                console.error("Error retrieving game state:", err);
                socket.emit('error', { message: 'Failed to retrieve game state' });
                return;
            }

            // Check if it is the player's turn
            if (game.current_turn !== player_id) {
                // It's not the player's turn, so send an error
                socket.emit('error', { message: 'It is not your turn' });
                return;
            }

            // Update the game state in the database (or memory)
            db.run('UPDATE Games SET ' +
            (player_id === 'player_1' ? 'player1_x = ?, player1_y = ?' : 'player2_x = ?, player2_y = ?') +
            ' WHERE game_id = ?', [new_x, new_y, game_id], (err) => {
                if (err) {
                    console.error("Error updating player position:", err);
                    // Optionally notify the client about the failure
                    socket.emit('error', { message: 'Failed to update position' });
                    return;
                }

                // Update the current turn
                const newTurn = game.current_turn === 'player_1' ? 'player_2' : 'player_1';
                db.run('UPDATE Games SET current_turn = ? WHERE game_id = ?', [newTurn, game_id], (err) => {
                    if (err) {
                        console.error("Error updating current turn:", err);
                        return;
                    }

                    // Emit the opponent move event
                    socket.broadcast.emit('opponent_move', { player_id, new_x, new_y });

                    // Emit the turn update event to the other client
                    socket.emit('turn_disable', { current_turn: newTurn });

                    // Emit the turn update event to the other client
                    socket.broadcast.emit('turn_update', { current_turn: newTurn });
                });
            });
        })
    });

    socket.on('wall_placed', (data) => {
        const { game_id, player_id, wallCount, occupiedWalls } = data;

        db.run('UPDATE Games SET ' + (player_id === 'player_1' ? 'player1_wall_count' : 'player2_wall_count') + ' = ?, occupied_walls = ? WHERE game_id = ?', [wallCount, occupiedWalls, game_id], function (err) {
            if (err) {
                console.error('Error updating wall count and occupied walls:', err);
                return;
            }
            console.log('Wall count and occupied walls updated successfully');
    
            // Retrieve the current game state from the database
            db.get('SELECT current_turn FROM Games WHERE game_id = ?', [game_id], (err, row) => {
                if (err) {
                    console.error("Error retrieving current turn:", err);
                    return;
                }
    
                // Update the current turn
                const newTurn = row.current_turn === 'player_1' ? 'player_2' : 'player_1';
    
                // Update the current turn in the database
                db.run('UPDATE Games SET current_turn = ? WHERE game_id = ?', [newTurn, game_id], (err) => {
                    if (err) {
                        console.error("Error updating current turn:", err);
                        return;
                    }
    
                    // Emit the opponent move event
                    socket.broadcast.emit('opponent_wall', { player_id: player_id, wallCount: wallCount, newOccupiedWalls: occupiedWalls});
    
                    // Emit the turn update event to the other client
                    socket.emit('turn_disable', { current_turn: newTurn });
    
                    // Emit the turn update event to the other client
                    socket.broadcast.emit('turn_update', { current_turn: newTurn });
                });
            });
        });
    });

    socket.on('current-player', (data) => {
        const currentPlayer = data.current_player;
        const socketId = data.socketId;
        const gameId = data.gameId;
        const player1Id = gameClients[gameId].find((client) => client.playerId === 'player_1').socket.id;
        const player2Id = gameClients[gameId].find((client) => client.playerId === 'player_2').socket.id;
    
        if (socketId === player1Id) {
            if (currentPlayer === 'player_1') {
                // Send turn_update to player 2 and turn_disable to player 1
                io.to(player1Id).emit('turn_update', { current_turn: currentPlayer });
                io.to(player2Id).emit('turn_disable', { current_turn: currentPlayer });
            }
            else if (currentPlayer === 'player_2') {
                // Send turn_update to player 1 and turn_disable to player 2
                io.to(player1Id).emit('turn_disable', { current_turn: currentPlayer });
                io.to(player2Id).emit('turn_update', { current_turn: currentPlayer });
            }
        }
    });
}); 

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});