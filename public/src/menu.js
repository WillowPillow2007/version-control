// import { v4 as uuidv4 } from 'uuid';
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

    let isMenuBlurred = false;

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
        });
    });

    localPlay.addEventListener("click", () => {
        window.location.href = "game.html";
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

    document.getElementById('online-play').addEventListener('click', function() {
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
        createRoomOverlay.classList.toggle('show');
        // Broadcast the game code to the opponent
        socket.emit('game-code', gameCode);
    });
    
    document.getElementById('copy-code-button').addEventListener('click', () => {
        const gameCode = document.getElementById('game-code-text').textContent;
        navigator.clipboard.writeText(gameCode);
    });
    
    document.getElementById('close-overlay-button').addEventListener('click', () => {
        document.getElementById('create-room-overlay').style.display = 'none';
    });
});
