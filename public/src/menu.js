document.addEventListener("DOMContentLoaded", function() {
    const instructionButton = document.querySelector(".instruction-button");
    const instructionOverlay = document.querySelector("#instruction-overlay");
    const closeButton = document.querySelector(".close-button");

    instructionButton.addEventListener("click", function() {
        instructionOverlay.classList.add("show");
    });

    closeButton.addEventListener("click", function() {
        instructionOverlay.classList.remove("show");
    });
});