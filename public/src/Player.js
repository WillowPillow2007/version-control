// Define the Player class
class Player {
constructor(id, startX, startY, color) {
    this.id = id;
    this.position = { x: startX, y: startY };
    this.color = color;
    this.wallsRemaining = 10;
}

move(newX, newY) {
    this.position = { x: newX, y: newY };
}

placeWall() {
    if (this.wallsRemaining > 0) {
    this.wallsRemaining--;
    return true;
    }
    return false;
}
}

// Export the Player class for use in other scripts
export default Player;
