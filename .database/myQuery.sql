-- Open the database file
.open datasource.db

CREATE TABLE Games (
    game_id TEXT PRIMARY KEY,
    game_state TEXT,  -- 'open', 'in_progress', 'completed'
    game_time_elapsed INTEGER,
    player_1_session_id TEXT,  -- Session ID for player 1
    player_2_session_id TEXT,  -- Session ID for player 2
    current_turn TEXT,  -- 'player_1', 'player_2'
    player1_x INTEGER,
    player1_y INTEGER,
    player1_color TEXT,
    player1_wall_count INTEGER,
    player2_x INTEGER,
    player2_y INTEGER,
    player2_color TEXT,
    player2_wall_count INTEGER,
    occupied_walls TEXT
);
