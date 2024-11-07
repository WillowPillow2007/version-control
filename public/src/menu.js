document.addEventListener("DOMContentLoaded", function () {
    // Elements
    const instructionButton = document.querySelector(".instruction-button");
    const instructionOverlay = document.querySelector("#instruction-overlay");
    const playButton = document.querySelector(".play-button");
    const playOverlay = document.querySelector("#play-overlay");
    const closeButtons = document.querySelectorAll(".close-button");
    const menuContainer = document.querySelector(".menu-container");
    const localPlay = document.getElementById("local-play");

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
});
