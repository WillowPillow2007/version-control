document.addEventListener("DOMContentLoaded", function () {
    // Elements
    const instructionButton = document.querySelector(".instruction-button");
    const instructionOverlay = document.querySelector("#instruction-overlay");
    const playButton = document.querySelector(".play-button");
    const playOverlay = document.querySelector("#play-overlay");
    const closeButtons = document.querySelectorAll(".close-button");
    const menuContainer = document.querySelector(".menu-container");
    const localPlay = document.getElementById("local-play");
    const createRoomOverlay = document.getElementById("create-room-overlay");
    const joinRoomOverlay = document.getElementById("join-room-overlay");
    const onlinePlay = document.getElementById("online-play");
    let isMenuBlurred = false;
    // Track if the user has already navigated to game.html
    let isGameNavigated = false;

    // Register the service worker when the menu page is loaded
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(function (registration) {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(function (error) {
                console.log('Service Worker registration failed:', error);
            });
    }

    // Event Listeners
    instructionButton.addEventListener("click", () => {
        toggleOverlay(instructionOverlay, true);
    });

    playButton.addEventListener("click", () => {
        toggleOverlay(playOverlay, true);
    });

    closeButtons.forEach(button => {
        button.addEventListener("click", () => {
            // Close overlays
            toggleOverlay(instructionOverlay, false);
            toggleOverlay(playOverlay, false);
            toggleOverlay(createRoomOverlay, false);
            toggleOverlay(joinRoomOverlay, false);
        });
    });

    localPlay.addEventListener("click", () => {
        if (!isGameNavigated) {
            location.replace('game.html'); // Avoids adding a back entry for menu.html
            isGameNavigated = true;
        } else {
            history.pushState(null, null, 'game.html'); // Allows for repeated visits
            window.location.href = 'game.html';
        }
    });

    // Helper functions
    function toggleOverlay(overlay, show) {
        if (show) {
            overlay.classList.add("show");
            blurMenu();
        } else {
            overlay.classList.remove("show");
            unblurMenu();
        }
    }

    function blurMenu() {
        if (!isMenuBlurred) {
            menuContainer.classList.add("blurred");
            isMenuBlurred = true;
        }
    }

    function unblurMenu() {
        if (isMenuBlurred) {
            menuContainer.classList.remove("blurred");
            isMenuBlurred = false;
        }
    }

    onlinePlay.addEventListener('click', function() {
        document.querySelector('.online-branch').classList.toggle('show');
    });

    function generateCode() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 5; i++) {
          code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return code;
    }

    document.getElementById('create-room').addEventListener('click', () => {
        const gameCode = generateCode(); // Generate a 5-letter code
        document.getElementById('game-code-text').textContent = gameCode;
        createRoomOverlay.classList.toggle('show', true);
    
        // Store the game code and session ID for Player 1 (host) in sessionStorage
        sessionStorage.setItem('game_id', gameCode);
        sessionStorage.setItem('player_id', 'player_1');  // Set the player ID for Player 1 (host)
    
        // Send the game code and state to the server to create a room in the database
        fetch('/api/create-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_id: gameCode,    // Pass the generated game code
                game_state: 'open',    // Pass the game state as 'open' when the room is created
                player_id: 'player_1' // Set player_1 as the creator
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
            // Emit the join_game event to the server
            socket.emit('join_game', {
                game_id: gameCode,
                player_id: 'player_1'
            });
        })
        .catch(error => {
            console.error('Error creating game room:', error);
        });

        // Listen for 'redirect_to_game' event from the server (Player 1 should wait until Player 2 joins)
        socket.on('redirect_to_game', (data) => {
            console.log('Received redirect_to_game event');
            window.location.href = data.url;
        });
    });
    
    const closeRoomButton = document.getElementById('close-room');
    closeRoomButton.addEventListener('click', () => {
        toggleOverlay(createRoomOverlay, false);
    
        fetch('/api/delete-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(data.message);
                window.location.href = 'menu.html'; 
            } else {
                console.error(data.message);
                alert(data.message); // Show an error message if the room cannot be deleted
            }
        })
        .catch(error => console.error('Error deleting game room:', error));
    });

    document.getElementById('copy-code-button').addEventListener('click', () => {
        const gameCode = document.getElementById('game-code-text').textContent;
        navigator.clipboard.writeText(gameCode);
        document.getElementById('copy-code-button').textContent = 'Copied!';
        setTimeout(() => {
            document.getElementById('copy-code-button').textContent = 'Copy Code';
        }, 2000);
    });

    document.getElementById('join-room-code').addEventListener('input', function(event) {
        const input = event.target.value;
        if (!/^[a-zA-Z]*$/.test(input)) {
            event.target.value = input.replace(/[^a-zA-Z]/g, '');
        }
    });

    const socket = io();  // This will connect to the server via WebSocket

    // Listen for 'redirect_to_game' event from the server (Player 2 should wait until game starts)
    socket.on('redirect_to_game', (data) => {
        console.log('Received redirect_to_game event');
        window.location.href = data.url;
    });
    
    document.getElementById('join-room-button').addEventListener('click', () => {
        const gameCode = document.getElementById('join-room-code').value.toUpperCase();
        const playerId = 'player_2';  // Assume Player 2 is joining
    
        if (gameCode) {
            fetch('/api/join-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_id: gameCode,
                    player_id: playerId  // Pass Player 2's ID
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Joined the room successfully');
                    socket.emit('join_game', {
                        game_id: gameCode,
                        player_id: playerId
                    });
    
                    // Disable the join button after joining
                    document.getElementById('join-room-button').disabled = true;
                    
                } else {
                    console.log('Failed to join room:', data.message);
                    alert(data.message);
                }
            })
            .catch(error => {
                console.error('Error joining game room:', error);
                alert('An error occurred while joining the room.');
            });
        } else {
            alert('Please enter a game code.');
        }
    });

    document.getElementById('join-room').addEventListener('click', () => {
        joinRoomOverlay.classList.toggle('show', true);
    });

    window.addEventListener('beforeunload', () => {
        // Check if the user has a game code (i.e., they are in a game)
        const gameId = sessionStorage.getItem('game_id');  // Get game_id from sessionStorage or from the session cookie
        if (gameId) {
            // Trigger the server-side deletion to clean up the room when leaving or reloading
            fetch('/api/delete-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_id: gameId })  // Send the game_id to identify which room to delete
            })
            .then(response => response.json())
            .then(data => console.log(data.message))
            .catch(error => console.error('Error deleting game room on unload:', error));
        }
    });
    
    // Function to handle online status change
    function updateOnlineStatus() {
        if (navigator.onLine) {
            localStorage.setItem('onlineStatus', 'online');
            onlinePlay.disabled = false;
            onlinePlay.title = "Click to play online (Requires internet)";
            onlinePlay.style.cursor = 'pointer'; // Change cursor to pointer
        } else {
            localStorage.setItem('onlineStatus', 'offline');
            onlinePlay.disabled = true;
            onlinePlay.title = "You must be online to play online games.";
            onlinePlay.style.cursor = 'not-allowed'; // Change cursor to not-allowed
        }
    }

    updateOnlineStatus()
    // Event listeners for online/offline status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    // Optional: Show a status indicator on the page
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'status-indicator';
    statusIndicator.style.position = 'fixed';
    statusIndicator.style.bottom = '10px';
    statusIndicator.style.left = '10px';
    statusIndicator.style.padding = '10px';
    statusIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    statusIndicator.style.color = 'white';
    statusIndicator.style.borderRadius = '5px';
    statusIndicator.style.fontSize = '14px';
    document.body.appendChild(statusIndicator);

    function updateStatusIndicator() {
        if (navigator.onLine) {
            statusIndicator.textContent = "You are online.";
            statusIndicator.style.backgroundColor = 'rgba(0, 128, 0, 0.7)'; // Green
        } else {
            statusIndicator.textContent = "You are offline.";
            statusIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.7)'; // Red
        }
    }

    updateStatusIndicator();
    window.addEventListener('online', updateStatusIndicator);
    window.addEventListener('offline', updateStatusIndicator);
});

