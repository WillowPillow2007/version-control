import Player from './Player.js';

const socket = io();
let gameOver = false; 
let player1;
let player2;
let currentPlayer;
let currentWarningCount = 0;
let currentlyShownGaps = [];
let player1WallCount;
let player2WallCount;
let occupiedWalls;
let player1TimerValue = 300;
let player2TimerValue = 300;
let timerInterval;

const currentGameId = new URLSearchParams(window.location.search).get('room');
console.log('currentGameId:', currentGameId);

socket.on('connect', () => {
    console.log('Connected to the server!');
});

socket.on('disconnect', () => {
    console.log('Disconnected from the server');
});

// Fetch the initial turn without switching it
function fetchCurrentTurn() {
    return new Promise((resolve, reject) => {
        socket.emit('fetch-turn', { gameID: currentGameId });

        // Listen for the server's response with the current turn
        socket.once('turn-fetched', (data) => {
            if (data.currentTurn === 'player_1') {
                resolve(player1);
            } else if (data.currentTurn === 'player_2') {
                resolve(player2);
            } else {
                reject(new Error('Invalid player data received'));
            }
        });

        socket.on('error', (err) => {
            console.error('Error fetching current turn:', err);
            reject(err);
        });
    });
}

// // Update turn function, called after a move
// function updateTurn() {
//     return new Promise((resolve, reject) => {
//         socket.emit('update-turn', { gameID: currentGameId });

//         // Listen for the server's response after updating the turn
//         socket.once('turn-updated', (data) => {
//             if (data.currentTurn === 'player1') {
//                 resolve(player1);
//             } else if (data.currentTurn === 'player2') {
//                 resolve(player2);
//             } else {
//                 reject(new Error('Invalid player data received'));
//             }
//         });

//         socket.on('error', (err) => {
//             console.error('Error updating turn:', err);
//             reject(err);
//         });
//     });
// }

socket.on('turn_disable', (data) => {
    disableCellInteractions();
    removeHighlightValidMoves();
    if (data.current_turn === 'player_1') {
        currentPlayer = player1;
    } else if (data.current_turn === 'player_2') {
        currentPlayer = player2;
    }
    highlightCurrentPlayer();

});

socket.on('turn_update', (data) => {
    console.log(data.current_turn)
    // Update the turn logic here
    if (data.current_turn === 'player_1') {
        currentPlayer = player1;
    } else if (data.current_turn === 'player_2') {
        currentPlayer = player2;
    }
    enableCellInteractions();
    highlightValidMoves();
    highlightCurrentPlayer();
    // timerInterval = setInterval(updateTimer, 1000); // Start the timer
});

function removeHighlightValidMoves() {
    const allCells = document.querySelectorAll('.cell');
    allCells.forEach(cell => {
        const existingHighlight = cell.querySelector('.highlight');
        if (existingHighlight) {
            cell.removeChild(existingHighlight);
        }
        cell.classList.remove('shadowy');
    });
}

function enableCellInteractions() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.pointerEvents = 'auto';
    });
    const gaps= document.querySelectorAll('.gap');
    gaps.forEach(gap => {
        gap.style.pointerEvents = 'auto';
    });
}

// Listen for game over event
socket.on('game_over', (data) => {
    // Log the message for debugging
    console.log(data.message);

    alert(data.message);
});

socket.on('opponent_move', (data) => {
    try {
        const { player_id, new_x, new_y } = data;

        console.log(`Received opponent_move: ${player_id} moved to x = ${new_x}, y = ${new_y}`);

        let player;
        if (player_id === 'player_1') {
            player = player1;
        } else if (player_id === 'player_2') {
            player = player2;
        }

        if (player) {
            // Check win condition
            const currentCell = document.getElementById(`cell-${player.position.x}-${player.position.y}`);
            const newCell = document.getElementById(`cell-${new_x}-${new_y}`);

            // Log to see if the cells are being correctly identified
            console.log(`Current cell: cell-${player.position.x}-${player.position.y}`);
            console.log(`New cell: cell-${new_x}-${new_y}`);

            if (currentCell) {
            currentCell.innerHTML = ''; // Clear the old cell
            }

            // Update the player position
            player.position.x = new_x;
            player.position.y = new_y;
            console.log(player.position);
            if (newCell) {
                const playerNumber = currentPlayer.id.split('_')[1];
                newCell.innerHTML = `<div class="player-marker" id="marker${playerNumber}" style="background-color:${player.color}; transform: translate(-50%, -50%);"></div>`;
            }

            // Check win condition
            checkWinCondition(player);
    }
    } catch (error) {
        console.error('Error handling opponent_move event:', error);
    }
});

socket.on('redirect_to_menu', (data) => {
    window.location.href = data.url;
});

socket.on('opponent_wall', (data) => {
    const { player_id, newOccupiedWalls, wallCount } = data;
    if (player_id === 'player_1') {
        player1WallCount = wallCount;
    } else if (player_id === 'player_2') {
        player2WallCount = wallCount;
    }
    occupiedWalls = JSON.parse(newOccupiedWalls);

    // Update the occupiedWalls object with the new wall placement
    occupiedWalls.horizontal = new Set(occupiedWalls.horizontal);
    occupiedWalls.vertical = new Set(occupiedWalls.vertical);

    // Temporarily mark walls as occupied to check for path
    occupiedWalls.horizontal.forEach(gapId => {
        const gap = document.querySelector(`#${gapId}[data-gap-type="horizontal"]`);
        if (gap) {
            gap.classList.add('wall-placed');
            console.log("Added horizontal");
        }
        const crossGap = document.querySelector(`#${gapId}[data-gap-type="cross"]`);
        if (crossGap) {
            crossGap.classList.add('wall-placed');
            console.log("Added cross");
        }
    });
    occupiedWalls.vertical.forEach(gapId => {
        const gap = document.querySelector(`#${gapId}[data-gap-type="vertical"]`);
        if (gap) {
            gap.classList.add('wall-placed');
            console.log("Added vertical");
        }
        const crossGap = document.querySelector(`#${gapId}[data-gap-type="cross"]`);
        if (crossGap) {
            crossGap.classList.add('wall-placed');
            console.log("Added cross");
        }
    });
});

//Getting player start cell and setting up all other function
function initBoard() {

    const startCell1 = document.getElementById(`cell-${player1.position.x}-${player1.position.y}`);
    const startCell2 = document.getElementById(`cell-${player2.position.x}-${player2.position.y}`);

    if (startCell1 && startCell2) {
        startCell1.innerHTML = `<div class="player-marker" id="marker1" style="background-color:${player1.color};"></div>`;
        startCell2.innerHTML = `<div class="player-marker" id="marker2" style="background-color:${player2.color};"></div>`;
    } else {
        console.error("One or both starting cells not found.");
    }

    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    highlightValidMoves();
    highlightCurrentPlayer();
}

// Flag to track if a move is being processed
let isProcessingMove = false;

async function handleCellClick(event) {
    if (gameOver || isProcessingMove) return; // Prevent moves if the game is over or if a move is in progress

    const cellId = event.target.id;
    const [_, x, y] = cellId.split('-');
    const newX = parseInt(x);
    const newY = parseInt(y);

    const validMoves = getValidMoves(currentPlayer);
    
    // Check if the move is valid
    if (validMoves.some(move => move.x === newX && move.y === newY)) {
        // Set flag to indicate the move is being processed
        isProcessingMove = true;
        
        // Move the player locally on the board
        movePlayer(currentPlayer, newX, newY);
        console.log(currentPlayer.id)
        // Emit the updated move to the server
        socket.emit('player_move', {
            game_id: currentGameId,
            player_id: currentPlayer.id,
            new_x: newX,
            new_y: newY
        });
        // Reset flag after a short delay (ensure move is fully processed)
        setTimeout(() => {
            isProcessingMove = false;
        }, 300); // Adjust timeout for game speed
    } else {
        showWarning("Invalid move. Click a valid cell.");
    }
}

// function updateTimer() {
//     const player1Timer = document.getElementById('player1-timer');
//     const player2Timer = document.getElementById('player2-timer');
//     if (currentPlayer === player1) {
//         player1TimerValue -= 1;
//         player1Timer.innerText = `Time: ${formatTime(player1TimerValue)}`;
//         player1Timer.dataset.time = player1TimerValue;
//         if (player1TimerValue === 0) {
//             clearInterval(timerInterval);
//             // Handle timer expiration
//         }
//     } else {
//         player2TimerValue -= 1;
//         player2Timer.innerText = `Time: ${formatTime(player2TimerValue)}`;
//         player2Timer.dataset.time = player2TimerValue;
//         if (player2TimerValue === 0) {
//             clearInterval(timerInterval);
//             // Handle timer expiration
//         }
//     }
// }

function highlightCurrentPlayer() {
    const player1Indicator = document.getElementById('player1-indicator');
    const player2Indicator = document.getElementById('player2-indicator');
    const player1WallCountDisplay = document.getElementById('player1-wall-count');
    const player2WallCountDisplay = document.getElementById('player2-wall-count');
    // const player1Timer = document.getElementById('player1-timer');
    // const player2Timer = document.getElementById('player2-timer');

    player1Indicator.classList.remove('active');
    player2Indicator.classList.remove('active');

    // Reset light-up effect
    player1WallCountDisplay.classList.remove('active');
    player2WallCountDisplay.classList.remove('active');

    player1Timer.classList.remove('active');
    player2Timer.classList.remove('active');

    // Update wall count displays
    player1WallCountDisplay.innerText = `Walls: ${player1WallCount}`;
    player2WallCountDisplay.innerText = `Walls: ${player2WallCount}`;

    if (currentPlayer === player1) {
        player1Indicator.classList.add('active');
        player1WallCountDisplay.classList.add('active'); // Light up for Player 1
        // player1Timer.classList.add('active');

    } else {
        player2Indicator.classList.add('active');
        player2WallCountDisplay.classList.add('active'); // Light up for Player 2
        // player2Timer.classList.add('active');
    }
}

// function formatTime(time) {
//     const minutes = Math.floor(time / 60);
//     const seconds = time % 60;
//     return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
// }

//Check if opponent is adjacent to do the jump
function isOpponentInWay(player, newX, newY) {
    const opponent = player === player1 ? player2 : player1;
    return opponent.position.x === newX && opponent.position.y === newY;
}

function canJumpOver(player, newX, newY) {
    const deltaX = newX - player.position.x; // Direction to opponent
    const deltaY = newY - player.position.y;

    // Calculate landing position based on the direction of the jump
    const landingX = newX + deltaX; // Jumping over the opponent
    const landingY = newY + deltaY;

    // Check if the landing position is valid
    if (isCellValid(landingX, landingY) && !isCellOccupied(landingX, landingY)) {
        // Check if there is a wall blocking the jump
        if (!isWallBlocking(newX, newY, deltaX, deltaY)) {
            return { x: landingX, y: landingY }; // Valid jump
        }
    }

    return null; // No valid jump
}


function isCellOccupied(x, y) {
    return (player1.position.x === x && player1.position.y === y) || 
           (player2.position.x === x && player2.position.y === y);
}

function isCellValid(x, y) {
    return x >= 0 && x < 9 && y >= 0 && y < 9;
}

function movePlayer(player, newX, newY) {
    const currentCell = document.getElementById(`cell-${player.position.x}-${player.position.y}`);
    const newCell = document.getElementById(`cell-${newX}-${newY}`);
    const playerNumber = currentPlayer.id.split('_')[1];

    // Clear the current cell if it exists
    if (currentCell) {
        currentCell.innerHTML = ''; // Remove the player marker from the current cell
    }

    // Update the player's position
    player.position.x = newX;
    player.position.y = newY;

    // Add the player marker to the new cell
    if (newCell) {
        newCell.innerHTML = `<div class="player-marker" id="marker${playerNumber}" style="background-color:${player.color}; transform: translate(-50%, -50%);"></div>`;
    }
    // Check for win condition after the move is complete
    checkWinCondition(player);
}

function highlightValidMoves() {
    const allCells = document.querySelectorAll('.cell');
    allCells.forEach(cell => {
        const existingHighlight = cell.querySelector('.highlight');
        if (existingHighlight) {
            cell.removeChild(existingHighlight);
        }
    });

    const validMoves = getValidMoves(currentPlayer);
    validMoves.forEach(({ x, y }) => {
        const cellToHighlight = document.getElementById(`cell-${x}-${y}`);
        if (cellToHighlight) {
            // Only highlight if the cell is not occupied by the opponent
            if (!isOpponentInWay(currentPlayer, x, y)) {
                const highlightDiv = document.createElement('div');
                highlightDiv.className = 'highlight';
                highlightDiv.style.backgroundColor = `${currentPlayer.color}`;
                highlightDiv.style.opacity = '0.3';
                highlightDiv.style.position = 'absolute';
                highlightDiv.style.width = '100%';
                highlightDiv.style.height = '100%';
                highlightDiv.style.borderRadius = '5px';
                highlightDiv.style.pointerEvents = 'none';
                cellToHighlight.appendChild(highlightDiv);
            }
        }
    });

    const currentCell = document.getElementById(`cell-${currentPlayer.position.x}-${currentPlayer.position.y}`);
    if (currentCell) {
        currentCell.classList.add('shadowy');
    }
}

function getDiagonalMoves(currentX, currentY, opponentX, opponentY) {
    const potentialMoves = [];
    const dx = opponentX - currentX;
    const dy = opponentY - currentY;

    // Check diagonal moves around the opponent
    if (dx === 0  && dy === 1) { // To the right of the player
        // Player is horizontally aligned with the opponent to the right
        const upRightDiagonal = { x: opponentX - 1, y: opponentY };
        const downRightDiagonal = { x: opponentX + 1, y: opponentY };

        // Check wall blocking for up-right diagonal move
        if (isCellValid(upRightDiagonal.x, upRightDiagonal.y) && !isWallBlocking(currentX, currentY, -1, 1)){
            potentialMoves.push(upRightDiagonal);
        }

        // Check wall blocking for down-right diagonal move
        if (isCellValid(downRightDiagonal.x, downRightDiagonal.y) && !isWallBlocking(currentX, currentY, 1, 1)){
            potentialMoves.push(downRightDiagonal);
        }
    } 
    else if (dx === 0 && dy === -1) { // To the left of the player
        // Player is horizontally aligned with the opponent to the left
        const upLeftDiagonal = { x: opponentX - 1, y: opponentY };
        const downLeftDiagonal = { x: opponentX + 1, y: opponentY };

        // Check wall blocking for up-left diagonal move
        if (isCellValid(upLeftDiagonal.x, upLeftDiagonal.y) && !isWallBlocking(currentX, currentY, -1, -1)){
            potentialMoves.push(upLeftDiagonal); 
        }

        // Check wall blocking for down-left diagonal move
        if (isCellValid(downLeftDiagonal.x, downLeftDiagonal.y) && !isWallBlocking(currentX, currentY, 1, -1)){
            potentialMoves.push(downLeftDiagonal);
        }
    }
    else if (dy === 0 && dx === -1) { // In front of the player
        // Player is vertically aligned with the opponent above
        const upLeftDiagonal = { x: opponentX, y: opponentY - 1 };
        const upRightDiagonal = { x: opponentX, y: opponentY + 1 };

        // Check wall blocking for up-left diagonal move
        if (isCellValid(upLeftDiagonal.x, upLeftDiagonal.y) && !isWallBlocking(currentX, currentY, -1, -1)){
            potentialMoves.push(upLeftDiagonal); 
        }

        // Check wall blocking for up-right diagonal move
        if (isCellValid(upRightDiagonal.x, upRightDiagonal.y) && !isWallBlocking(currentX, currentY, -1, 1)){
            potentialMoves.push(upRightDiagonal);
        }
    }
    else if (dy === 0 && dx === 1) { // Behind the player
        // Player is vertically aligned with the opponent below
        const downRightDiagonal = { x: opponentX, y: opponentY + 1 };
        const downLeftDiagonal = { x: opponentX, y: opponentY - 1 };

        // Check wall blocking for down-right diagonal move
        if (isCellValid(downRightDiagonal.x, downRightDiagonal.y) && !isWallBlocking(currentX, currentY, 1, 1)){
            potentialMoves.push(downRightDiagonal);
        }

        // Check wall blocking for down-left diagonal move
        if (isCellValid(downLeftDiagonal.x, downLeftDiagonal.y) && !isWallBlocking(currentX, currentY, 1, -1)){
            potentialMoves.push(downLeftDiagonal);
        }
    }

    // Filter potential moves to only valid and unoccupied cells
    return potentialMoves.filter(move => 
        isCellValid(move.x, move.y) && !isCellOccupied(move.x, move.y)
    );
}

function getValidMoves(player) {
    const { x, y } = player.position;
    const validMoves = [];

    // Normal adjacent movement
    const directions = [
        { dx: 0, dy: 1 },  // Right
        { dx: 0, dy: -1 }, // Left
        { dx: 1, dy: 0 },  // Down
        { dx: -1, dy: 0 }  // Up
    ];

    directions.forEach(({ dx, dy }) => {
        const newX = x + dx;
        const newY = y + dy;

        // Check for normal moves
        if (isCellValid(newX, newY) && !isWallBlocking(x, y, dx, dy)) {
            validMoves.push({ x: newX, y: newY });
        }

        // Check for jump-over moves when the opponent is in the way
        if (isOpponentInWay(player, newX, newY)) {
            // Ensure there's no wall blocking the player's direct movement
            if (!isWallBlocking(x, y, dx, dy)) {
                const jumpPosition = canJumpOver(player, newX, newY);
                if (jumpPosition) {
                    validMoves.push(jumpPosition);
                }
                else {
                    // If the jump is invalid, add diagonal moves instead
                    validMoves.push(...getDiagonalMoves(x, y, newX, newY));
                }
            } 
        }
    });

    return validMoves.filter(move => isCellValid(move.x, move.y));
}

function isWallBlocking(x, y, dx, dy) {
    // Check for horizontal movement
    if (dx === 0) {
        // Moving horizontally, check for walls left and right
        if (dy > 0) { // Moving right
            const wallKeyRight = `gap-${x}-${y}`;
            return occupiedWalls.vertical.has(wallKeyRight);
        } else if (dy < 0) { // Moving left
            const wallKeyLeft = `gap-${x}-${y - 1}`;
            return occupiedWalls.vertical.has(wallKeyLeft);
        }
    }

    // Check for vertical movement
    else if (dy === 0) {
        // Moving vertically, check for walls up and down
        if (dx > 0) { // Moving down
            const wallKeyDown = `gap-${x + 1}-${y}`;
            return occupiedWalls.horizontal.has(wallKeyDown);
        } else if (dx < 0) { // Moving up
            const wallKeyUp = `gap-${x}-${y}`;
            return occupiedWalls.horizontal.has(wallKeyUp);
        }
    }

    // Diagonal movements
    else {
        // Down-right (dx > 0, dy > 0)
        if (dx > 0 && dy > 0) {
        console.log("Checking down-right diagonal movement");
        if (isCellOccupied(x + 1, y)) { // Behind the player
            const wallKeyDownRightVer = `gap-${x + 1}-${y}`;
            console.log(`Checking vertical wall: ${wallKeyDownRightVer}`);
            return occupiedWalls.vertical.has(wallKeyDownRightVer);
        } else { // To the right
            const wallKeyDownRightHor = `gap-${x + 1}-${y + 1}`;
            console.log(`Checking horizontal wall: ${wallKeyDownRightHor}`);
            return occupiedWalls.horizontal.has(wallKeyDownRightHor);
        }
        }
    
        // Down-left (dx > 0, dy < 0)
        else if (dx > 0 && dy < 0) { 
        console.log("Checking down-left diagonal movement");
        if (isCellOccupied(x + 1, y)) { // Behind the player
            const wallKeyDownLeftVer = `gap-${x + 1}-${y - 1}`;
            console.log(`Checking vertical wall: ${wallKeyDownLeftVer}`);
            return occupiedWalls.vertical.has(wallKeyDownLeftVer);
        } else { // To the left
            const wallKeyDownLeftHor = `gap-${x + 1}-${y - 1}`;
            console.log(`Checking horizontal wall: ${wallKeyDownLeftHor}`);
            return occupiedWalls.horizontal.has(wallKeyDownLeftHor);
        }
        }
    
        // Up-right (dx < 0, dy > 0)
        else if (dx < 0 && dy > 0) {
        console.log("Checking up-right diagonal movement");
        if (isCellOccupied(x - 1, y)) { // In front of the player
            const wallKeyUpRightVer = `gap-${x - 1}-${y}`;
            console.log(`Checking vertical wall: ${wallKeyUpRightVer}`);
            return occupiedWalls.vertical.has(wallKeyUpRightVer);
        } else { // To the right
            const wallKeyUpRightHor = `gap-${x}-${y + 1}`;
            console.log(`Checking horizontal wall: ${wallKeyUpRightHor}`);
            return occupiedWalls.horizontal.has(wallKeyUpRightHor);
        }
        }
    
        // Up-left (dx < 0, dy < 0)
        else if (dx < 0 && dy < 0) {
        console.log("Checking up-left diagonal movement");
        if (isCellOccupied(x - 1, y)) { // In front of the player
            const wallKeyUpLeftVer = `gap-${x - 1}-${y - 1}`;
            console.log(`Checking vertical wall: ${wallKeyUpLeftVer}`);
            return occupiedWalls.vertical.has(wallKeyUpLeftVer);
        } else { // To the left
            const wallKeyUpLeftHor = `gap-${x}-${y - 1}`;
            console.log(`Checking horizontal wall: ${wallKeyUpLeftHor}`);
            return occupiedWalls.horizontal.has(wallKeyUpLeftHor);
        }
        }
    }

    // No blocking if no conditions were met
    return false;
}

function checkWinCondition(player) {
    const winPosition = player === player1 ? 0 : 8; // Define the winning position
    if (player.position.x === winPosition) {
        // If player reaches the win position, trigger game over

        // Set the gameOver flag on the client side (for UI handling)
        gameOver = true;

        // Notify the server to mark the game as over in the database
        socket.emit('game_over', { gameId: currentGameId, winnerId: player.id });

        // Disable all interactive elements (move, place walls, etc.)
        disableCellInteractions();
    }
}

function disableCellInteractions() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.pointerEvents = 'none';
    });
    const gaps= document.querySelectorAll('.gap');
    gaps.forEach(gap => {
        gap.style.pointerEvents = 'none';
    });
}

function canReachWinPosition(player) {
    const visited = new Set();
    const queue = [player.position];
    const winPosition = player === player1 ? 0 : 8;

    // Define direction vectors
    const directions = [
        { dx: 0, dy: 1 },   // Right
        { dx: 0, dy: -1 },  // Left
        { dx: 1, dy: 0 },   // Down
        { dx: -1, dy: 0 }   // Up
    ];

    while (queue.length > 0) {
        const { x, y } = queue.shift();

        // Check if the current position is the winning position
        if (x === winPosition) {
            return true;
        }

        // Iterate through possible directions
        for (const { dx, dy } of directions) {
            const newX = x + dx;
            const newY = y + dy;

            // Check for valid, unoccupied, and non-blocked cells
            if ((isCellValid(newX, newY) && !isWallBlocking(x, y, dx, dy) && !visited.has(`${newX},${newY}`))) {
                visited.add(`${newX},${newY}`); // Mark this cell as visited
                queue.push({ x: newX, y: newY }); // Add the new position to the queue
            }
        }
    }
    
    return false; // No path found
}

function initGaps() {
    const gaps = document.querySelectorAll('.gap');
    gaps.forEach(gap => {
        gap.addEventListener('click', placeWall);
        gap.addEventListener('mousemove', showWallPreview);
        gap.addEventListener('mouseleave', hideWallPreview); 
    });
}

function showWallPreview(event) {
    const gapType = event.target.dataset.gapType;
    if (event.target.classList.contains('cross')) {
        document.querySelectorAll('.wall-preview').forEach((gap) => {
            gap.classList.remove('wall-preview');
        });
        return;
    }
    else {
        const closestCells = getClosestCells(event, gapType);
        const gapsToColor = getGapsToColor(closestCells[0], closestCells[1], gapType);

        if (gapsToColor && gapsToColor.length > 0) {
            const crossGapsToCheck = [];
            if (gapType === 'horizontal') {
                const y = parseCellPosition(closestCells[0])[0];
                const xMin = Math.min(parseCellPosition(closestCells[0])[1], parseCellPosition(closestCells[1])[1]);
                crossGapsToCheck.push(`gap-cross-${y}-${xMin}`);
            } else if (gapType === 'vertical') {
                const yMin = Math.min(parseCellPosition(closestCells[0])[0], parseCellPosition(closestCells[1])[0]);
                const x = parseCellPosition(closestCells[0])[1];
                crossGapsToCheck.push(`gap-cross-${yMin + 1}-${x}`);
            }

            // Check if the placement is valid
            const isValidPlacement = gapsToColor.every((gap) => {
                const id = gap.id;
                const [_, x, y] = id.split('-');
                const wallKey = `gap-${x}-${y}`;

                return !occupiedWalls[gapType].has(wallKey) && !crossGapsToCheck.some((crossGapId) => {
                    return occupiedWalls['horizontal'].has(crossGapId) || occupiedWalls['vertical'].has(crossGapId);
                });
            });

            if (isValidPlacement) {
                // Remove wall-preview class from all gaps
                document.querySelectorAll('.wall-preview').forEach((gap) => {
                    gap.classList.remove('wall-preview');
                });

                // Add wall-preview class to the gaps that should be shown
                gapsToColor.forEach((gap) => {
                    if (gap) {
                        gap.classList.add('wall-preview');
                        currentlyShownGaps.push(gap);
                    }
                });
            }
        }
    }
}

function hideWallPreview(event) {
    if (event.relatedTarget && event.relatedTarget.classList.contains('cell')) {
    document.querySelectorAll('.gap').forEach((gap) => {
        gap.classList.remove('wall-preview');
    });
    currentlyShownGaps = [];
    }
}

async function placeWall(event) {
    const gapType = event.target.dataset.gapType;
    const closestCells = getClosestCells(event, gapType);

    if (!closestCells[0] || !closestCells[1]) {
        console.error("Wall placement failed: One or both cells are undefined.");
        return;
    }

    const [cell1, cell2] = closestCells;
    const gapsToColor = getGapsToColor(cell1, cell2, gapType);

    // Check wall limits
    if ((currentPlayer === player1 && player1WallCount <= 0) ||
        (currentPlayer === player2 && player2WallCount <= 0)) {
        showWarning(`You has reached the maximum wall limit of 10.`);
        return; // Prevent placing the wall
    }

    // Determine cross gaps based on gapType
    const crossGapsToCheck = [];
    if (gapType === 'horizontal') {
        const y = parseCellPosition(cell1)[0];
        const xMin = Math.min(parseCellPosition(cell1)[1], parseCellPosition(cell2)[1]);
        crossGapsToCheck.push(`gap-cross-${y}-${xMin}`);
    } else if (gapType === 'vertical') {
        const yMin = Math.min(parseCellPosition(cell1)[0], parseCellPosition(cell2)[0]);
        const x = parseCellPosition(cell1)[1];
        crossGapsToCheck.push(`gap-cross-${yMin + 1}-${x}`);
    }

    // Check for overlapping walls first
    const occupiedSet = occupiedWalls[gapType];
    const isOverlap = gapsToColor.some(gap => gap && occupiedSet.has(gap.id)) ||
                        crossGapsToCheck.some(crossGapId => 
                            occupiedWalls.horizontal.has(crossGapId) || 
                            occupiedWalls.vertical.has(crossGapId));

    if (isOverlap) {
        showWarning("Cannot place wall on an existing wall");
        return; // Prevent placing the wall
    }

    // Temporarily mark walls as occupied to check for path
    gapsToColor.forEach(gap => {
        if (gap) {
            gap.classList.add('wall-placed');
            occupiedSet.add(gap.id);
        }
    });

    // Check if the wall placement blocks paths to victory
    const pathsBlocked = !canReachWinPosition(player1) || !canReachWinPosition(player2);

    if (pathsBlocked) {
        showWarning("Cannot place wall, must leave at least one path to the goal for each pawn");
        
        // Rollback wall placement
        gapsToColor.forEach(gap => {
            if (gap) {
                gap.classList.remove('wall-placed');
                occupiedSet.delete(gap.id);
            }
        });
        return; // Prevent placing the wall
    }

    // Mark cross gaps as occupied
    crossGapsToCheck.forEach(crossGapId => {
        occupiedWalls.horizontal.add(crossGapId);
        occupiedWalls.vertical.add(crossGapId);
    });
    
    const playerNumber = currentPlayer.id.split('_')[1];
    showWarning(`Player ${playerNumber} placed a wall`);
    
    // Decrement the wall count for the current player
    if (currentPlayer === player1) {
        player1WallCount--;
    } else {
        player2WallCount--;
    }
    console.log(occupiedWalls);
    // Emit the wall placement event to update the database
    socket.emit('wall_placed', {
        game_id: currentGameId,
        player_id: currentPlayer.id,
        wallCount: currentPlayer === player1 ? player1WallCount : player2WallCount,
        occupiedWalls: JSON.stringify({
            horizontal: Array.from(occupiedWalls.horizontal),
            vertical: Array.from(occupiedWalls.vertical)
        })
    });
}

function getGapsToColor(cell1, cell2, gapType) {
    const [y1, x1] = parseCellPosition(cell1);
    const [y2, x2] = parseCellPosition(cell2);

    const gaps = [];

    if (gapType === 'horizontal' && y1 === y2) { 
        // Horizontal wall between two cells in the same row (y1)
        const gapId1 = `gap-${y1}-${Math.min(x1, x2)}`;
        const gapId2 = `gap-${y1}-${Math.min(x1, x2) + 1}`;
        
        gaps.push(
            document.querySelector(`#${gapId1}[data-gap-type="horizontal"]`),
            document.querySelector(`#${gapId2}[data-gap-type="horizontal"]`)
        );

        // Add the cross gap at the midpoint
        const crossGapId = `gap-cross-${y1}-${Math.min(x1, x2)}`;
        const crossGap = document.querySelector(`#${crossGapId}`);
        if (crossGap) {
            gaps.push(crossGap);
        }
    } 
    else if (gapType === 'vertical' && x1 === x2) { 
        // Vertical wall between two cells in the same column (x1)
        const gapId1 = `gap-${Math.min(y1, y2)}-${x1}`;
        const gapId2 = `gap-${Math.min(y1, y2) + 1}-${x1}`;
        
        gaps.push(
            document.querySelector(`#${gapId1}[data-gap-type="vertical"]`),
            document.querySelector(`#${gapId2}[data-gap-type="vertical"]`)
        );

        // Add the cross gap at the midpoint
        const crossGapId = `gap-cross-${Math.min(y1, y2) + 1}-${x1}`;
        const crossGap = document.querySelector(`#${crossGapId}`);
        if (crossGap) {
            gaps.push(crossGap);
        }
    }
    else {
        console.warn("Invalid gapType or cell positions:", { gapType, y1, x1, y2, x2 });
    }

    return gaps;
}

function parseCellPosition(gap) {
    const position = gap.id.split('-').slice(1).map(Number);
    return position;
}

function getClosestCells(event, gapType) {
    const {offsetX, offsetY} = event;
    const [y, x] = parseCellPosition(event.target);
    let cell1 = null, cell2 = null;

    if (gapType === 'horizontal') {
        if (offsetX < event.target.offsetWidth / 2) {
            cell1 = document.getElementById(`cell-${y}-${x}`);
            cell2 = document.getElementById(`cell-${y}-${x - 1}`);
            if (!cell2) cell2 = document.getElementById(`cell-${y}-${x + 1}`);
        } else {
            cell1 = document.getElementById(`cell-${y}-${x + 1}`);
            cell2 = document.getElementById(`cell-${y}-${x}`);
            if (!cell1) cell1 = document.getElementById(`cell-${y}-${x - 1}`);
        }
    } else if (gapType === 'vertical') {
        if (offsetY < event.target.offsetHeight / 2) {
            cell1 = document.getElementById(`cell-${y}-${x}`);
            cell2 = document.getElementById(`cell-${y - 1}-${x}`);
            if (!cell2) cell2 = document.getElementById(`cell-${y +1 }-${x}`);
        } else {
            cell1 = document.getElementById(`cell-${y + 1}-${x}`);
            cell2 = document.getElementById(`cell-${y}-${x}`);
            if (!cell1) cell1 = document.getElementById(`cell-${y - 1}-${x}`);
        }
    }

    return [cell1, cell2];
}

function showWarning(...messages) {
    const warningBox = document.createElement('div');
    warningBox.className = 'warning-box';
    warningBox.innerText = messages.join(' '); // Join messages with a space

    // Calculate the top position for the new warning
    const warningBoxHeight = 60; // Adjust this value for height of the warning box
    const topPosition = 20 + (currentWarningCount * warningBoxHeight); // Set the position

    // Set style properties
    warningBox.style.position = 'fixed';
    warningBox.style.left = '50%'; // Center horizontally
    warningBox.style.transform = 'translate(-50%, 0)'; // Adjust for centering
    warningBox.style.top = `${topPosition}px`; // Set top position

    // Increment the warning count
    currentWarningCount++;

    document.body.appendChild(warningBox);

    setTimeout(() => {
        warningBox.style.opacity = 0; // Start fade-out
        setTimeout(() => {
            document.body.removeChild(warningBox);
            currentWarningCount--; // Decrement when warning is removed
        }, 500); // Match with CSS transition duration
    }, 2000);
}

document.getElementById('back-to-menu').addEventListener('click', function() {
    location.replace('menu.html'); // Replaces game.html in the history stack
});

async function initializeGame() {
    try {
        // Emit the get-initial-data event
        socket.emit('get-initial-data', { game_id: currentGameId });

        // Wait for the player data and occupied walls to be received and processed
        await new Promise((resolve, reject) => {
            socket.once('initial-data', (data) => {  // Use 'once' to ensure it's only triggered once
                console.log('Received initial data:', data);

                if (data.players && data.players.length === 2) {
                    player1 = new Player(data.players[0].player_id, data.players[0].x, data.players[0].y, data.players[0].color);
                    player2 = new Player(data.players[1].player_id, data.players[1].x, data.players[1].y, data.players[1].color);

                    console.log('Player 1:', player1);
                    console.log('Player 2:', player2);

                    player1WallCount = data.players[0].wall_count;
                    player2WallCount = data.players[1].wall_count;

                    console.log('Player 1 Wall Count:', player1WallCount);
                    console.log('Player 2 Wall Count:', player2WallCount);

                    // Ensure horizontal and vertical are arrays before using them in Sets
                    occupiedWalls = {
                        horizontal: new Set(Array.isArray(data.occupiedWalls.horizontal) ? data.occupiedWalls.horizontal : []),
                        vertical: new Set(Array.isArray(data.occupiedWalls.vertical) ? data.occupiedWalls.vertical : [])
                    };

                    console.log('Occupied Walls:', occupiedWalls);

                    resolve();  // Resolve the promise once player data and occupied walls are fully processed
                } else {
                    reject(new Error('Invalid player data or occupied walls received'));
                }
            });
        });

        // Now that player data is processed, fetch the current turn
        currentPlayer = await fetchCurrentTurn();
        console.log("Initial currentPlayer:", currentPlayer);

        // Initialize the board and other game components
        initBoard();
        initGaps();
    } catch (error) {
        console.error("Failed to initialize game:", error);
    }
}

// Call initializeGame on window load
window.onload = () => {
    initializeGame();
};