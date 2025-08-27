// Drawing functions for KfKblock Tetris game
export const shape_colors = [
    "rgb(70, 140, 70)",   
    "rgb(170, 200, 160)",   
    "rgb(130, 170, 120)",
    "rgb(70, 140, 70)",
    "rgb(70, 140, 70)",  
    "rgb(20, 20, 20)",   
    "rgb(130, 130, 130)"
];

// --- Drawing Functions ---
export function getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export function drawBoard(ctx, board, canvasWidth, canvasHeight, blockSize, isDarkMode, COLS, ROWS) {
    if (!ctx || !board || board.length === 0) return;
    
    let bg_color = isDarkMode ? `rgb(50, 50, 50)` : `rgb(220, 220, 220)`;
    ctx.fillStyle = bg_color;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.strokeStyle = `rgb(180,180,180)`;
    
    // Draw gridlines
    for (let i = 0; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * blockSize, 0);
        ctx.lineTo(i * blockSize, canvasHeight);
        ctx.stroke();
    }
    for (let i = 0; i < ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * blockSize);
        ctx.lineTo(canvasWidth, i * blockSize);
        ctx.stroke();
    }
    
    // Draw board blocks
    for (let r = 0; r < board.length; r++) {
        const row = board[r];
        for (let c = 0; c < row.length; c++) {
            const spot = row[c];
            if (spot != null) {
                ctx.fillStyle = shape_colors[spot];
                ctx.fillRect(c * blockSize + 1, r * blockSize + 1, blockSize - 2, blockSize - 2);
            }
        }
    }
}

export function drawPiece(pieceData, context, pieceX, pieceY, customBlockSize = null, blockSize) {
    if (!pieceData || !context) return;
    const bs = customBlockSize || blockSize;
    
    // Draw the main block
    context.fillStyle = pieceData.color;
    pieceData.getShape().forEach((node) => {
        let x_pos = pieceX + node[0];
        let y_pos = pieceY + node[1];
        context.fillRect(x_pos * bs, y_pos * bs, bs, bs);
    });

    // Draw inset
    let insetBlock = bs / 5.5;
    context.fillStyle = "rgba(30,30,30,0.8)";
    pieceData.getPositions().forEach((pos) => {
        context.fillRect(pos[0] * bs + insetBlock, pos[1] * bs + insetBlock, bs - insetBlock * 2, bs - insetBlock * 2);
    });
}

export function drawGhostPiece(currentPiece, ctx, blockSize, intersectsFunc) {
    if (!currentPiece || !ctx) return;
    
    // Calculate ghost position
    let currentY = currentPiece.y;
    let intersectYOffset = -1;
    while (!intersectsFunc()) {
        currentPiece.y++;
        intersectYOffset++;
    }
    currentPiece.y = currentY;
    
    // Draw ghost piece
    let insetBlock = blockSize / 5.5;
    ctx.fillStyle = currentPiece.color;
    currentPiece.getPositions().forEach((pos) => {
        ctx.fillRect(pos[0] * blockSize + insetBlock, (intersectYOffset + pos[1]) * blockSize + insetBlock, blockSize - insetBlock * 2, blockSize - insetBlock * 2);
    });
}

export function drawNextPiece(nextPiece, nextCtx, isDarkMode) {
    if (!nextPiece || !nextCtx) return;
    const canvas = nextCtx.canvas;
    
    let bg_color = isDarkMode ? `rgb(50, 50, 50)` : `rgb(220, 220, 220)`;
    nextCtx.fillStyle = bg_color;
    nextCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const block = nextPiece;
    const block_width = canvas.width / 4;
    let insetBlock = block_width / 5.5;
    
    let xValues = block.getShape().map(x => x[0]);
    let blockWidth = Math.abs(Math.min(...xValues)) + Math.max(...xValues) + 1;
    let yValues = block.getShape().map(x => x[1]);
    let blockHeight = Math.abs(Math.min(...yValues)) + Math.max(...yValues) + 1;
    
    let y_adj = 1.25;
    if (blockHeight == 1) {
        y_adj = y_adj - 0.5;
    }

    block.getShape().forEach((node) => {
        let x_pos = node[0] + 1 + (4 - blockWidth) / 2;
        let y_pos = node[1] + y_adj;
        
        nextCtx.fillStyle = block.color;
        nextCtx.fillRect(x_pos * block_width, y_pos * block_width, block_width, block_width);
        nextCtx.fillStyle = "rgba(30,30,30,0.8)";
        nextCtx.fillRect(x_pos * block_width + insetBlock, y_pos * block_width + insetBlock, block_width - insetBlock * 2, block_width - insetBlock * 2);
    });
}

export function drawGame(gameOver, ctx, board, canvasWidth, canvasHeight, blockSize, isDarkMode, COLS, ROWS, currentPiece, nextPiece, nextCtx, intersectsFunc) {
    if (gameOver || !ctx) return;
    
    drawBoard(ctx, board, canvasWidth, canvasHeight, blockSize, isDarkMode, COLS, ROWS); 
    
    // Draw current piece
    if (currentPiece) {
        drawGhostPiece(currentPiece, ctx, blockSize, intersectsFunc);
        drawPiece(currentPiece, ctx, currentPiece.x, currentPiece.y, null, blockSize);
    }
    drawNextPiece(nextPiece, nextCtx, isDarkMode);
}
