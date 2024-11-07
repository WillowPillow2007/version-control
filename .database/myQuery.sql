-- Create the games table
CREATE TABLE games (
    game_id INTEGER PRIMARY KEY,
    game_state TEXT,
    game_status TEXT
);

-- Create the game_statistics table
CREATE TABLE game_statistics (
    game_id INTEGER PRIMARY KEY,
    game_length INTEGER,
    end_game_position TEXT,
    winner TEXT
);

-- Insert data into the extension table
INSERT INTO extension (extID, name, hyperlink, about, image, language)
VALUES (1, "Live Server", "https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer", "Launch a development local Server with live reload feature for static & dynamic pages", "https://ritwickdey.gallerycdn.vsassets.io/extensions/ritwickdey/live-server/5.7.9/1661914858952/Microsoft.VisualStudio.Services.Icons.Default", "HTML CSS JS");

-- Select all data from the extension table
SELECT * FROM extension;

-- Select all data from the extension table where language is like '#BASH'
SELECT * FROM extension WHERE language LIKE '#BASH';