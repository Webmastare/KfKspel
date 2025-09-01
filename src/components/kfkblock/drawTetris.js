// Drawing functions for KfKblock Tetris game
export const shape_colors = [
  'rgb(70, 140, 70)',
  'rgb(170, 200, 160)',
  'rgb(130, 170, 120)',
  'rgb(70, 140, 70)',
  'rgb(70, 140, 70)',
  'rgb(20, 20, 20)',
  'rgb(130, 130, 130)',
]

// --- Helper Functions ---
export function getThemeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

// Helper function to calculate piece dimensions for centering
function getPieceDimensions(piece) {
  const xValues = piece.getShape().map((coord) => coord[0])
  const yValues = piece.getShape().map((coord) => coord[1])
  const blockWidth = Math.abs(Math.min(...xValues)) + Math.max(...xValues) + 1
  const blockHeight = Math.abs(Math.min(...yValues)) + Math.max(...yValues) + 1
  return { blockWidth, blockHeight }
}

// Helper function to draw a single piece with inset shadow
function drawSinglePieceWithInset(ctx, piece, x, y, blockSize, insetBlock) {
  piece.getShape().forEach((node) => {
    const actualX = (x + node[0]) * blockSize
    const actualY = (y + node[1]) * blockSize

    // Draw main block
    ctx.fillStyle = piece.color
    ctx.fillRect(actualX, actualY, blockSize, blockSize)

    // Draw inset shadow for 3D effect
    ctx.fillStyle = 'rgba(30,30,30,0.8)'
    ctx.fillRect(
      actualX + insetBlock,
      actualY + insetBlock,
      blockSize - insetBlock * 2,
      blockSize - insetBlock * 2,
    )
  })
}

// --- Main Drawing Functions ---
export function drawBoard(
  ctx,
  board,
  canvasWidth,
  canvasHeight,
  blockSize,
  isDarkMode,
  COLS,
  ROWS,
) {
  if (!ctx || !board || board.length === 0) return

  // Clear canvas with theme-appropriate background
  const bg_color = isDarkMode ? `rgb(50, 50, 50)` : `rgb(220, 220, 220)`
  ctx.fillStyle = bg_color
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Draw grid lines
  ctx.strokeStyle = `rgb(180,180,180)`
  ctx.beginPath()

  // Vertical lines
  for (let i = 1; i < COLS; i++) {
    ctx.moveTo(i * blockSize, 0)
    ctx.lineTo(i * blockSize, canvasHeight)
  }

  // Horizontal lines
  for (let i = 1; i < ROWS; i++) {
    ctx.moveTo(0, i * blockSize)
    ctx.lineTo(canvasWidth, i * blockSize)
  }
  ctx.stroke()

  // Draw placed blocks on the board
  for (let r = 0; r < board.length; r++) {
    const row = board[r]
    for (let c = 0; c < row.length; c++) {
      const spot = row[c]
      if (spot != null) {
        ctx.fillStyle = shape_colors[spot]
        ctx.fillRect(c * blockSize + 1, r * blockSize + 1, blockSize - 2, blockSize - 2)
      }
    }
  }
}

export function drawPiece(pieceData, context, pieceX, pieceY, customBlockSize = null, blockSize) {
  if (!pieceData || !context) return

  const bs = customBlockSize || blockSize
  const insetBlock = bs / 5.5

  drawSinglePieceWithInset(context, pieceData, pieceX, pieceY, bs, insetBlock)
}

export function drawGhostPiece(currentPiece, ctx, blockSize, intersectsFunc) {
  if (!currentPiece || !ctx) return

  // Calculate where the piece would land (ghost position)
  const currentY = currentPiece.y
  let intersectYOffset = -1

  while (!intersectsFunc()) {
    currentPiece.y++
    intersectYOffset++
  }

  // Restore original position
  currentPiece.y = currentY

  // Draw ghost piece with transparency at landing position
  const insetBlock = blockSize / 5.5

  // Create a transparent version of the piece color
  const ghostColor = currentPiece.color.replace('rgb', 'rgba').replace(')', ', 0.3)')
  ctx.fillStyle = ghostColor

  currentPiece.getPositions().forEach((pos) => {
    ctx.fillRect(
      pos[0] * blockSize + insetBlock,
      (intersectYOffset + pos[1]) * blockSize + insetBlock,
      blockSize - insetBlock * 2,
      blockSize - insetBlock * 2,
    )
  })
}

export function drawNextPieces(nextPieces, nextCtx, blockSize, isDarkMode) {
  if (!nextPieces || nextPieces.length === 0 || !nextCtx) return

  const canvas = nextCtx.canvas
  const bg_color = isDarkMode ? `rgb(50, 50, 50)` : `rgb(220, 220, 220)`

  // Clear canvas
  nextCtx.fillStyle = bg_color
  nextCtx.fillRect(0, 0, canvas.width, canvas.height)

  const pieceHeight = canvas.height / 3 // Divide into 3 sections for 3 next pieces
  const insetBlock = blockSize / 5.5

  // Draw each of the 3 next pieces
  nextPieces.slice(0, 3).forEach((piece, index) => {
    if (!piece) return

    const yOffset = index * pieceHeight
    const { blockWidth, blockHeight } = getPieceDimensions(piece)

    // Center the piece horizontally and adjust vertical position
    let y_adj = 1.25
    if (blockHeight === 1) {
      y_adj -= 0.5 // Adjust for single-row pieces (like I-piece)
    }

    const x_offset = 1 + (4 - blockWidth) / 2
    const y_position = yOffset / blockSize + y_adj

    drawSinglePieceWithInset(nextCtx, piece, x_offset, y_position, blockSize, insetBlock)
  })
}

// --- Main Game Drawing Function ---
export function drawGame(
  gameOver,
  ctx,
  board,
  canvasWidth,
  canvasHeight,
  blockSize,
  isDarkMode,
  COLS,
  ROWS,
  currentPiece,
  intersectsFunc,
  nextPieces = null,
  nextCtx = null,
) {
  if (gameOver || !ctx) return

  // Draw main game board
  drawBoard(ctx, board, canvasWidth, canvasHeight, blockSize, isDarkMode, COLS, ROWS)

  // Draw current piece and its ghost
  if (currentPiece) {
    drawGhostPiece(currentPiece, ctx, blockSize, intersectsFunc)
    drawPiece(currentPiece, ctx, currentPiece.x, currentPiece.y, null, blockSize)
  }

  // Draw next pieces panel if provided
  if (nextPieces && nextCtx) {
    drawNextPieces(nextPieces, nextCtx, blockSize, isDarkMode)
  }
}
