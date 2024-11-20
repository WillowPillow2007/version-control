// Define the Player class
class Player {
constructor(id, startX, startY, color) {
    this.id = id;
    this.position = { x: startX, y: startY };
    this.color = color;
}
}

// Export the Player class for use in other scripts
export default Player;
