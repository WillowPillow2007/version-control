-- Open the database file
.open datasource.db

CREATE TABLE Games (
    game_id INT PRIMARY KEY,
    game_state INT,
    game_time_elapsed INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);