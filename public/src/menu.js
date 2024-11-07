document.addEventListener("DOMContentLoaded", function() {
    const instructionButton = document.querySelector(".instruction-button");
    const instructionOverlay = document.querySelector("#instruction-overlay");
    const playButton = document.querySelector(".play-button");
    const playOverlay = document.querySelector("#play-overlay");
    const closeButtons = document.querySelectorAll(".close-button");
    const menuContainer = document.querySelector(".menu-container");
    let isMenuBlurred = false;

    instructionButton.addEventListener("click", function() {
    instructionOverlay.classList.add("show");
    blurMenu();
    });

    playButton.addEventListener("click", function() {
    playOverlay.classList.add("show");
    blurMenu();
    });

    closeButtons.forEach(function(closeButton) {
    closeButton.addEventListener("click", function() {
        instructionOverlay.classList.remove("show");
        playOverlay.classList.remove("show");
        unblurMenu();
    });
    });

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