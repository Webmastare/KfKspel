export class Tile {
  constructor(value = 0) {
    this.value = value
  }

  draw(ctx, x, y, tileSize, gap, colors) {
    const colorSet = colors[this.value] || colors.default
    ctx.fillStyle = colorSet[0]
    ctx.fillRect(x + gap, y + gap, tileSize - gap, tileSize - gap)

    if (this.value > 0) {
      ctx.fillStyle = this.value <= 4 ? '#776e65' : '#f9f6f2'
      ctx.font = `${Math.floor(tileSize / 2.5)}px 'Segoe UI', Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.value, x + gap / 2 + tileSize / 2, y + gap / 2 + tileSize / 2)
    }
  }
}

export class Game2048Logic {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.ratio = window.devicePixelRatio || 1

    this.board = []
    this.score = 0
    this.rows = 4
    this.columns = 4
    this.tileSize = 100
    this.gap = 8
    this.canvasWidth = 0
    this.canvasHeight = 0

    this.darkMode = false
    this.useClassicColors = false

    // Callbacks
    this.onScoreUpdate = null
    this.onGameOver = null

    this.setupColors()
  }

  setupColors() {
    this.classicColors = {
      0: ['#cdc1b5', '#5c5c5e'],
      2: ['#eee4da', '#bbada0'],
      4: ['#ece0ca', '#a39489'],
      8: ['#f4b17a', '#f5ac5f'],
      16: ['#f59575', '#f68d5b'],
      32: ['#f57c5f', '#e65d3b'],
      64: ['#f65d3b', '#c83410'],
      128: ['#edce71', '#edc850'],
      256: ['#edcc63', '#edc53f'],
      512: ['#edc651', '#eec744'],
      1024: ['#eec744', '#ecc230'],
      2048: ['#ecc230', '#e6b800'],
      4096: ['#3cb371', '#2e8b57'],
      8192: ['#2e8b57', '#228b22'],
      16384: ['#228b22', '#006400'],
      32768: ['#006400', '#004d00'],
      65536: ['#4682b4', '#4169e1'],
      131072: ['#4169e1', '#0000ff'],
      262144: ['#0000ff', '#00008b'],
      524288: ['#00008b', '#00004b'],
      default: ['#3c3a32', '#cdc1b5'],
    }

    this.kfkbColors = {
      0: ['#e8f5e8', '#374151'], // Light green and dark grey
      2: ['#c8e6c9', '#4b5563'],
      4: ['#a5d6a7', '#6b7280'],
      8: ['#81c784', '#16a34a'],
      16: ['#66bb6a', '#15803d'],
      32: ['#4caf50', '#166534'],
      64: ['#43a047', '#14532d'],
      128: ['#388e3c', '#365314'],
      256: ['#2e7d32', '#1a2e05'],
      512: ['#1b5e20', '#0f172a'],
      1024: ['#0d3b12', '#020617'],
      2048: ['#09270c', '#000000'],
      4096: ['#061b08', '#000000'],
      8192: ['#041204', '#000000'],
      16384: ['#020a02', '#000000'],
      32768: ['#000000', '#000000'],
      65536: ['#000000', '#000000'],
      131072: ['#000000', '#000000'],
      262144: ['#000000', '#000000'],
      524288: ['#000000', '#000000'],
      default: ['#f8fafc', '#374151'],
    }
  }

  setDarkMode(darkMode) {
    this.darkMode = darkMode
  }

  setUseClassicColors(useClassic) {
    this.useClassicColors = useClassic
  }

  setBoardSize(rows, columns) {
    this.rows = rows
    this.columns = columns
    // Don't call resizeBoard here - let initGame handle it
  }

  initGame() {
    // Ensure board is properly initialized
    this.board = Array.from({ length: this.rows }, () =>
      Array(this.columns)
        .fill(null)
        .map(() => new Tile()),
    )
    this.score = 0

    this.addRandomTile()
    this.addRandomTile()
    this.resizeBoard()

    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score)
    }
  }

  resetGame() {
    this.score = 0
    this.initGame()
  }

  resizeBoard() {
    const containerWidth = Math.min(window.innerWidth * 0.9, 600)
    const containerHeight = Math.min(window.innerHeight * 0.6, 600)
    this.tileSize =
      Math.min(containerWidth / this.columns, containerHeight / this.rows) -
      (this.gap * 2) / this.rows

    this.canvasWidth = this.tileSize * this.columns + this.gap
    this.canvasHeight = this.tileSize * this.rows + this.gap

    this.canvas.width = this.canvasWidth * this.ratio
    this.canvas.height = this.canvasHeight * this.ratio
    this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0)
    this.canvas.style.width = `${this.canvasWidth}px`
    this.canvas.style.height = `${this.canvasHeight}px`

    // Only draw if board is initialized
    if (this.board && this.board.length > 0) {
      this.drawBoard()
    }
  }

  drawBoard() {
    // Ensure board is initialized before drawing
    if (!this.board || this.board.length === 0) {
      return
    }

    const colors = this.useClassicColors ? this.classicColors : this.kfkbColors

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

    // Get theme colors from CSS custom properties
    const rootStyles = getComputedStyle(document.documentElement)
    const bgColor = rootStyles.getPropertyValue('--theme-canvas-2048-bg').trim()
    const borderColor = rootStyles.getPropertyValue('--theme-canvas-2048-border').trim()

    // Background - use theme colors if available, fallback to hardcoded
    this.ctx.fillStyle = bgColor || (this.darkMode ? '#1f2937' : '#f8fafc')
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    // Border - use theme colors if available, fallback to hardcoded
    this.ctx.strokeStyle = borderColor || (this.darkMode ? '#4b5563' : '#d1d5db')
    this.ctx.lineWidth = this.gap * this.ratio
    this.ctx.strokeRect(0, 0, this.canvasWidth, this.canvasHeight)

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        if (this.board[r] && this.board[r][c]) {
          const x = c * this.tileSize
          const y = r * this.tileSize
          const colorIndex = this.darkMode ? 1 : 0
          const tileColors = {
            ...colors,
            0: [this.darkMode ? colors[0][1] : colors[0][0], colors[0][1]],
            default: [this.darkMode ? colors.default[1] : colors.default[0], colors.default[1]],
          }
          this.board[r][c].draw(this.ctx, x, y, this.tileSize, this.gap, tileColors)
        }
      }
    }

    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score)
    }
  }

  addRandomTile() {
    const emptyTiles = []
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        if (this.board[r][c].value === 0) {
          emptyTiles.push({ r, c })
        }
      }
    }

    if (emptyTiles.length === 0) {
      const gameOver = this.checkGameOver()
      if (gameOver && this.onGameOver) {
        this.onGameOver()
        return
      }
    }

    if (emptyTiles.length > 0) {
      const { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)]
      this.board[r][c].value = Math.random() < 0.9 ? 2 : 4
    }
  }

  checkGameOver() {
    // Check if there are any empty tiles
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        if (this.board[r][c].value === 0) {
          return false
        }
      }
    }

    // Check for possible merges
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        const currentTile = this.board[r][c].value

        // Check right neighbor
        if (c < this.columns - 1 && currentTile === this.board[r][c + 1].value) {
          return false
        }

        // Check bottom neighbor
        if (r < this.rows - 1 && currentTile === this.board[r + 1][c].value) {
          return false
        }
      }
    }

    return true
  }

  slide(row) {
    const filteredRow = row.filter((tile) => tile.value !== 0)
    for (let i = 0; i < filteredRow.length - 1; i++) {
      if (filteredRow[i].value === filteredRow[i + 1].value) {
        filteredRow[i].value *= 2
        this.score += filteredRow[i].value
        filteredRow[i + 1].value = 0
      }
    }
    const newRow = filteredRow.filter((tile) => tile.value !== 0)
    while (newRow.length < this.columns) {
      newRow.push(new Tile())
    }
    return newRow
  }

  slideLeft() {
    for (let r = 0; r < this.rows; r++) {
      this.board[r] = this.slide(this.board[r])
    }
    this.addRandomTile()
    this.drawBoard()
  }

  slideRight() {
    for (let r = 0; r < this.rows; r++) {
      this.board[r].reverse()
      this.board[r] = this.slide(this.board[r])
      this.board[r].reverse()
    }
    this.addRandomTile()
    this.drawBoard()
  }

  slideUp() {
    for (let c = 0; c < this.columns; c++) {
      const column = this.board.map((row) => row[c])
      const newColumn = this.slide(column)
      for (let r = 0; r < this.rows; r++) {
        this.board[r][c] = newColumn[r]
      }
    }
    this.addRandomTile()
    this.drawBoard()
  }

  slideDown() {
    for (let c = 0; c < this.columns; c++) {
      const column = this.board.map((row) => row[c])
      column.reverse()
      const newColumn = this.slide(column)
      newColumn.reverse()
      for (let r = 0; r < this.rows; r++) {
        this.board[r][c] = newColumn[r]
      }
    }
    this.addRandomTile()
    this.drawBoard()
  }

  saveGame() {
    const gameState = {
      board: this.board.map((row) => row.map((tile) => tile.value)),
      score: this.score,
      rows: this.rows,
      columns: this.columns,
    }
    localStorage.setItem('2048GameState', JSON.stringify(gameState))
  }

  loadGame() {
    const savedState = localStorage.getItem('2048GameState')
    if (savedState) {
      try {
        const gameState = JSON.parse(savedState)
        this.rows = gameState.rows
        this.columns = gameState.columns
        this.score = gameState.score
        this.board = gameState.board.map((row) => row.map((value) => new Tile(value)))
        this.resizeBoard()
        return gameState
      } catch (error) {
        console.error('Error loading game state:', error)
        return null
      }
    }
    return null
  }
}
