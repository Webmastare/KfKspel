<template>
  <div class="hamiltonian-snake" :class="{ 'dark-theme': isDarkTheme }">
    <canvas ref="snakeCanvas" id="snakeCanvas"></canvas>
    <div v-if="gameMessage" class="game-message" :class="{ show: showMessage }">
      {{ gameMessage }}
    </div>
    
    <!-- Debug Overlay -->
    <div v-if="props.debugMode && debugInfo" class="debug-overlay">
      <h3>Shortcut Info</h3>
      
      <div class="debug-section">
        <h4>Snake State</h4>
        <div class="debug-row">Snake Length: {{ debugInfo.snakeLength }}</div>
        <div class="debug-row">Snake Ratio: {{ debugInfo.snakeRatio.toFixed(3) }}</div>
        <div class="debug-row">Max Snake Length: {{ debugInfo.maxSnakeLength }}</div>
      </div>
      
      <div class="debug-section">
        <h4>Shortcut Thresholds</h4>
        <div class="debug-row">Shortcut Threshold: {{ debugInfo.shortcutThreshold }}</div>
        <div class="debug-row">Length Check Passed: {{ debugInfo.lengthCheckPassed ? 'YES' : 'NO' }}</div>
      </div>
      
      <div class="debug-section">
        <h4>Distance Analysis</h4>
        <div class="debug-row">Distance to Food (Hamilton): {{ debugInfo.minDistToFood }}</div>
        <div class="debug-row">Min Required Savings: {{ debugInfo.minRequiredSavings }}</div>
      </div>
      
      <div class="debug-section">
        <h4>Neighbor Analysis</h4>
        <div class="debug-row">Valid Neighbors: {{ debugInfo.validNeighbors }}</div>
        <div class="debug-row">Snake Body In: {{ debugInfo.snakeBodyIn }}</div>
      </div>
      
      <div class="debug-section">
        <h4>Statistics</h4>
        <div class="debug-row">Shortcuts Taken: {{ debugInfo.shortcutsTaken }}</div>
        <div class="debug-row">Total Moves: {{ debugInfo.totalMoves }}</div>
        <div class="debug-row">Shortcut Rate: {{ debugInfo.shortcutRate.toFixed(2) }}%</div>
      </div>
      
      <div class="debug-section">
        <h4>Last Decision</h4>
        <div class="debug-row decision" :class="debugInfo.lastDecision.type">
          {{ debugInfo.lastDecision.reason }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

// Props
interface Props {
  autoStart?: boolean
  fps?: number
  visualCycle?: boolean
  visualPath?: boolean
  showGeneration?: boolean
  generationDelay?: number
  debugMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoStart: true,
  fps: 12,
  visualCycle: true,
  visualPath: true,
  showGeneration: true,
  generationDelay: 50,
  debugMode: false
})

// Watch for prop changes
watch(() => props.visualCycle, (newVal: boolean) => {
  // Update global visualization flag
  if (typeof window !== 'undefined') {
    ;(window as any).visualCycle = newVal
  }
})

watch(() => props.visualPath, (newVal: boolean) => {
  // Update global visualization flag
  if (typeof window !== 'undefined') {
    ;(window as any).visualPath = newVal
  }
})

watch(() => props.showGeneration, async (newVal: boolean) => {
  // Regenerate the maze and Hamiltonian path with new visualization setting
  if (GM && GM.hamilDone) {
    await regenerateGamePaths()
  } else if (props.autoStart) {
    // If game hasn't been initialized yet but autoStart is enabled, start it
    await startGame()
  }
})

watch(() => props.fps, (newVal: number) => {
  // Update FPS - ensure we clear any existing interval first
  if (intervalID) {
    clearInterval(intervalID)
    intervalID = 0 // Reset to ensure it's properly cleared
  }
  
  // Only restart interval if game is running (not game over)
  if (!gameOver && GM && GM.hamilDone) {
    intervalID = setInterval(preUpdate, 1000 / newVal)
  }
})

// Template refs
const snakeCanvas = ref<HTMLCanvasElement>()

// Theme state - Initialize from system preference
const isDarkTheme = ref(
  typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-color-scheme: dark)').matches 
    : false
)

// Game state
const gameMessage = ref('')
const showMessage = ref(false)

// Debug state
interface DebugInfo {
  snakeLength: number
  snakeRatio: number
  maxSnakeLength: number
  shortcutThreshold: number
  lengthCheckPassed: boolean
  minDistToFood: number
  minRequiredSavings: number
  validNeighbors: number
  snakeBodyIn: number
  shortcutsTaken: number
  totalMoves: number
  shortcutRate: number
  lastDecision: {
    type: 'shortcut' | 'hamiltonian' | 'skip'
    reason: string
  }
}

const debugInfo = ref<DebugInfo | null>(null)

// Theme colors - Updated for better contrast
const themeColors = {
  light: {
    background: '#ffffff',
    gridLine: '#e0e0e0',
    hamiltonianPath: '#1f6124',
    snakePath: '#666666',
    mazeVisited: '#76b366',
    mazeUnvisited: '#f5f5f5',
    mazeCurrent: '#d32f2f',
    mazeWall: '#333333',
    textColor: '#333333'
  },
  dark: {
    background: '#121212',
    gridLine: '#404040',
    hamiltonianPath: '#76b366',
    snakePath: '#cccccc',
    mazeVisited: '#2d803a',
    mazeUnvisited: '#2a2a2a',
    mazeCurrent: '#f44336',
    mazeWall: '#e0e0e0',
    textColor: '#e0e0e0'
  }
}

// Game variables
let gameOver = false
let rows = 20
let columns = 20
let blockSize = 25
let score = 0
let lastTime = performance.now()
let frameCount = 0

let context: CanvasRenderingContext2D
let intervalID: number
let animationFrameId: number

// Snake
let snakeBody: number[][] = []
let snakeX: number
let snakeY: number

// Food
let food: number[] = []


// Game Master instance
let GM: GameMaster

// Classes
class Spot {
  x: number
  y: number
  visited: boolean = false
  nextNode: Spot | null = null
  neighbors: Spot[] = []
  walls: boolean[] = [true, true, true, true] // User's order: 0:Up, 1:Left, 2:Down, 3:Right

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

class GameMaster {
  selectedNode: Spot | null = null
  grid: Spot[][] = []
  hamilDone: boolean = false
  hamilStart: Spot | null = null
  hamilPath: Spot[] = []
  mazeStart: Spot | null = null
  mazeGrid: Spot[][] = []
  mazePath: Spot[] = []
  snakePath: Spot[] = []
  debugMode: boolean = true // Enable for debugging
  shortcutsTaken: number = 0 // Track shortcuts for performance monitoring
  totalMoves: number = 0 // Track total moves for statistics

  constructor() {
    this.setup()
  }

  sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  setup() {
    this.grid = []
    for (let r = 0; r < rows; r++) {
      this.grid.push([])
      for (let c = 0; c < columns; c++) {
        this.grid[r].push(new Spot(c, r))
      }
    }

    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r]
      for (let c = 0; c < row.length; c++) {
        const spot = row[c]
        if (r > 0) spot.neighbors.push(this.grid[r - 1][c]) // Up
        if (c < row.length - 1) spot.neighbors.push(this.grid[r][c + 1]) // Right
        if (r < this.grid.length - 1) spot.neighbors.push(this.grid[r + 1][c]) // Down
        if (c > 0) spot.neighbors.push(this.grid[r][c - 1]) // Left
      }
    }
  }

  async genMaze(): Promise<void> {
    // Generate maze using DFS to make it look more interesting
    // The maze will be generated on a half-sized grid
    // Then the Hamiltonian cycle will be generated on the full grid based on the maze
    // Splitting each maze cell into 4 cells in the full grid
    const mazeRows = Math.floor(rows / 2)
    const mazeCols = Math.floor(columns / 2)
    this.mazeGrid = []
    for (let r = 0; r < mazeRows; r++) {
      this.mazeGrid.push([])
      for (let c = 0; c < mazeCols; c++) {
        this.mazeGrid[r].push(new Spot(c, r))
      }
    }

    // Get neighbors for maze grid
    for (let r = 0; r < this.mazeGrid.length; r++) {
      const row = this.mazeGrid[r]
      for (let c = 0; c < row.length; c++) {
        const spot = row[c]
        if (r > 0) spot.neighbors.push(this.mazeGrid[r - 1][c])
        if (c < row.length - 1) spot.neighbors.push(this.mazeGrid[r][c + 1])
        if (r < this.mazeGrid.length - 1) spot.neighbors.push(this.mazeGrid[r + 1][c])
        if (c > 0) spot.neighbors.push(this.mazeGrid[r][c - 1])
      }
    }
    // Create starting point
    this.mazeStart = this.mazeGrid[Math.floor(Math.random() * this.mazeGrid.length)][
      Math.floor(Math.random() * this.mazeGrid[0].length)
    ]
    // Start maze generation
    this.mazePath = [this.mazeStart]
    this.mazeStart.visited = true
    await this.genMazeFunc(this.mazeStart)
    console.log('Maze generation complete.')

    // Expand maze to full grid and generate Hamiltonian cycle
    // Reset visited flags
    for (const row of this.grid) {
      for (const cell of row) cell.visited = false
    }
    for (const row of this.mazeGrid) {
      for (const cell of row) cell.visited = false
    }

    this.hamilStart = this.grid[0][0]
    this.hamilPath = [this.hamilStart]
    // Generate Hamiltonian cycle from maze
    if (await this.genCycleFromMaze(this.hamilStart, 1)) {
      console.log('Hamiltonian cycle generated successfully!')
      if (this.hamilPath.length === rows * columns) {
        this.hamilDone = true
      } else {
        console.warn('Cycle length mismatch')
      }
    } else {
      console.error('Could not generate Hamiltonian cycle')
      this.hamilDone = false
    }
  }

  async genMazeFunc(node: Spot): Promise<boolean> {
    // Generate maze using DFS with backtracking and recursion
    // Call draw function to visualize generation if enabled
    if (props.showGeneration) {
      this.drawMaze(node)
      // Add title text
      const theme = getCurrentTheme()
      context.fillStyle = theme.textColor
      context.font = `${Math.max(12, blockSize * 0.8)}px Arial`
      context.textAlign = 'left'
      context.fillText('Generating Maze...', blockSize * 0.5, blockSize * 0.9)
      await this.sleep(props.generationDelay)
    }
    const unvisitedNeighbors = node.neighbors.filter(neighbor => !neighbor.visited)
    if (unvisitedNeighbors.length > 0) {
      const nextCell = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)]
      nextCell.visited = true
      this.removeWalls(node, nextCell)
      this.mazePath.push(nextCell)
      await this.genMazeFunc(nextCell)
      return true
    } else {
      if (this.mazePath.length > 1) {
        this.mazePath.pop()
        const parentCell = this.mazePath[this.mazePath.length - 1]
        await this.genMazeFunc(parentCell)
      }
      return true
    }
  }

  drawHamiltonianGeneration(currentNode: Spot) {
    // Start by drawing the maze, and clear canvas first
    this.drawMaze()

    const theme = getCurrentTheme()
    
    // Draw the grid
    context.strokeStyle = theme.gridLine
    context.lineWidth = 1
    for (let i = 0; i <= columns; i++) {
      context.beginPath()
      context.moveTo(i * blockSize, 0)
      context.lineTo(i * blockSize, rows * blockSize)
      context.stroke()
    }
    for (let i = 0; i <= rows; i++) {
      context.beginPath()
      context.moveTo(0, i * blockSize)
      context.lineTo(columns * blockSize, i * blockSize)
      context.stroke()
    }
    
    // Draw visited cells in the Hamiltonian path
    context.fillStyle = theme.mazeVisited
    for (const spot of this.hamilPath) {
      if (spot.visited) {
        context.fillRect(
          spot.x * blockSize + 2,
          spot.y * blockSize + 2,
          blockSize - 4,
          blockSize - 4
        )
      }
    }
    
    // Draw the current Hamiltonian path so far
    if (this.hamilPath.length > 1) {
      context.strokeStyle = '#4466bb'
      context.lineWidth = Math.max(2, blockSize / 10)
      context.beginPath()
      context.moveTo(
        this.hamilPath[0].x * blockSize + blockSize / 2,
        this.hamilPath[0].y * blockSize + blockSize / 2
      )
      
      for (let i = 1; i < this.hamilPath.length; i++) {
        const spot = this.hamilPath[i]
        context.lineTo(
          spot.x * blockSize + blockSize / 2,
          spot.y * blockSize + blockSize / 2
        )
      }
      context.stroke()
    }
    
    // Highlight the current node being processed
    if (currentNode) {
      context.fillStyle = theme.mazeCurrent
      context.fillRect(
        currentNode.x * blockSize + 1,
        currentNode.y * blockSize + 1,
        blockSize - 2,
        blockSize - 2
      )
    }
    
    // Add title text
    context.fillStyle = theme.textColor
    context.font = `${Math.max(12, blockSize * 0.8)}px Arial`
    context.textAlign = 'left'
    context.fillText(`Generating Hamiltonian Cycle... (${this.hamilPath.length}/${rows * columns})`, blockSize * 0.5, blockSize * 0.9)
  }

  drawMaze(currentNode: any = null) {
    // Clear canvas with transparent background
    const theme = getCurrentTheme()
    context.clearRect(0, 0, columns * blockSize, rows * blockSize)
    
    // Calculate the scale factor to map maze coordinates to full grid
    const mazeRows = Math.floor(rows / 2)
    const mazeCols = Math.floor(columns / 2)
    const scaleX = columns / mazeCols
    const scaleY = rows / mazeRows
    
    // Draw all maze cells
    for (const row of this.mazeGrid) {
      for (const cell of row) {
        // Map maze coordinates to full grid coordinates
        const fullGridX = cell.x * scaleX
        const fullGridY = cell.y * scaleY
        
        if (cell === currentNode) {
          // Highlight the current cell being processed
          context.fillStyle = theme.mazeCurrent
            context.fillRect(
            fullGridX * blockSize, 
            fullGridY * blockSize, 
            scaleX * blockSize, 
            scaleY * blockSize
            )
        } else if (cell.visited) {
          // Show visited cells
          context.fillStyle = theme.mazeVisited
          context.fillRect(
          fullGridX * blockSize, 
          fullGridY * blockSize, 
          scaleX * blockSize, 
          scaleY * blockSize
        )
        }    
        
        // Draw walls for the maze cell
        context.strokeStyle = theme.mazeWall
        context.lineWidth = 2
        context.beginPath()
        
        const x = fullGridX * blockSize
        const y = fullGridY * blockSize
        const w = scaleX * blockSize
        const h = scaleY * blockSize
        
        // Draw walls based on the maze cell's wall configuration
        if (cell.walls[0]) { // Top wall
          context.moveTo(x, y)
          context.lineTo(x + w, y)
        }
        if (cell.walls[1]) { // Left wall
          context.moveTo(x, y)
          context.lineTo(x, y + h)
        }
        if (cell.walls[2]) { // Bottom wall
          context.moveTo(x, y + h)
          context.lineTo(x + w, y + h)
        }
        if (cell.walls[3]) { // Right wall
          context.moveTo(x + w, y)
          context.lineTo(x + w, y + h)
        }
        
        context.stroke()
      }
    }
  }

  removeWalls(node: Spot, nextNode: Spot) {
    const dx = nextNode.x - node.x
    const dy = nextNode.y - node.y
    
    if (dx === 1) {
      // Moving Right
      node.walls[3] = false // Node's Right wall
      nextNode.walls[1] = false // NextNode's Left wall
    } else if (dx === -1) {
      // Moving Left
      node.walls[1] = false // Node's Left wall
      nextNode.walls[3] = false // NextNode's Right wall
    } else if (dy === -1) {
      // Moving Up
      node.walls[0] = false // Node's Up wall
      nextNode.walls[2] = false // NextNode's Down wall
    } else if (dy === 1) {
      // Moving Down
      node.walls[2] = false // Node's Down wall
      nextNode.walls[0] = false // NextNode's Up wall
    }
  }

  // Emergency fallback: ensure we always have a valid move
  getEmergencyMove(currentNodeIndex: number): number {
    // Always return the next node in the Hamiltonian cycle
    return (currentNodeIndex + 1) % this.hamilPath.length
  }

  isShortcutSafe(fromIndex: number, toIndex: number): { safetyCheckPassed: boolean; snakeBodyIn: number } {
    // Use temporal collision detection: simulate snake movement and check for collisions
    let snakeBodyIn = rows * columns // Start with max possible distance 
    for (let bodySegmentIndex = 0; bodySegmentIndex < snakeBody.length; bodySegmentIndex++) {
        const bodyPart = snakeBody[bodySegmentIndex]
        
        // Convert body part position to grid coordinates
        const bodyGridX = Math.floor(bodyPart[0] / blockSize)
        const bodyGridY = Math.floor(bodyPart[1] / blockSize)
        
        // Get the Hamiltonian path index for this body part
        const bodyNode = this.grid[bodyGridY][bodyGridX]
        const bodyCurrentIndex = this.hamilPath.indexOf(bodyNode)

        // Calculate the distance from the head to this body part along the path
        let distanceFromHead = this.getDistance(toIndex, bodyCurrentIndex)
        if (distanceFromHead === 0) {
            // This is the head itself - no collision
            continue
        }
        
        // How many moves until the body is no longer at this position, add 5% buffer
        const movesToSnakeFree = Math.ceil(snakeBody.length * 1.05) - bodySegmentIndex
        if (distanceFromHead < snakeBodyIn) {
            // Track the closest body part in the path
            snakeBodyIn = distanceFromHead
        }
        // Check if the body part will have moved before we reach this position
        if (movesToSnakeFree > distanceFromHead) {
            //console.log('Not Safe: Body part at', bodyCurrentIndex, 'will still be here in', distanceFromHead, 'moves (frees in', movesToSnakeFree, ')');
            return {safetyCheckPassed: false, snakeBodyIn} // Collision will occur
        }
    }
    // No collisions detected - shortcut is safe
    //console.log('Safe: No body parts will collide, closest is', snakeBodyIn);
    return {safetyCheckPassed: true, snakeBodyIn}
  }

  getDistance(fromIndex: number, toIndex: number): number {
    // Calculate distance along the Hamiltonian cycle from fromIndex to toIndex
    return (toIndex - fromIndex + this.hamilPath.length) % this.hamilPath.length
  }

  async genCycleFromMaze(node: Spot, currentMovingDirection: number): Promise<boolean> {
    // Generate Hamiltonian cycle using backtracking and recursion based on the maze
    // Draw generation if enabled
    if (props.showGeneration) {
      this.drawHamiltonianGeneration(node)
      await this.sleep(props.generationDelay)
    }
    node.visited = true
    // If all cells are in the path, check if we can connect back to start
    if (this.hamilPath.length === rows * columns) {
      let canConnectToStart = false
      for (const neighbor of node.neighbors) {
        if (neighbor === this.hamilStart) {
          const dx = neighbor.x - node.x
          const dy = neighbor.y - node.y
          let wallCheck = true

          // Check maze walls using the same logic as above
          if (dy === 1) {
            // Moving Down
            if (
              (node.y + 1) % 2 === 0 &&
              this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[2]
            ) {
              wallCheck = false
            }
          } else if (dy === -1) {
            // Moving Up
            if (
              node.y % 2 === 0 &&
              this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[0]
            ) {
              wallCheck = false
            }
          } else if (dx === 1) {
            // Moving Right
            if (
              (node.x + 1) % 2 === 0 &&
              this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[3]
            ) {
              wallCheck = false
            }
          } else if (dx === -1) {
            // Moving Left
            if (
              node.x % 2 === 0 &&
              this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[1]
            ) {
              wallCheck = false
            }
          }

          if (wallCheck) {
            canConnectToStart = true
            node.nextNode = neighbor
            break
          }
        }
      }
      if (canConnectToStart) {
        return true
      }
      node.visited = false
      return false
    }

    const unvisitedGridNeighbors = node.neighbors.filter(neighbor => !neighbor.visited)
    const rankedPossibleMoves: [number, Spot, number][] = []

    if (unvisitedGridNeighbors.length > 0) {
      for (const neighbor of unvisitedGridNeighbors) {
        const dx = neighbor.x - node.x
        const dy = neighbor.y - node.y
        let newSnakeDirection = 0
        let wallCheck = true
        let movePriority = 3

        // User's wall indices: 0:Up, 1:Left, 2:Down, 3:Right
        // User's snake direction: 0:Down, 1:Right, 2:Up, 3:Left
        if (dy === 1) {
          // Trying to move Down
          if (
            (node.y + 1) % 2 === 0 &&
            this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[2]
          ) {
            wallCheck = false
          }
          if (wallCheck) {
            newSnakeDirection = 0 // Snake will be moving Down
            movePriority =
              currentMovingDirection === 1
                ? 0
                : currentMovingDirection === 0
                ? 1
                : currentMovingDirection === 3
                ? 2
                : 3
          }
        } else if (dy === -1) {
          // Trying to move Up
          if (
            node.y % 2 === 0 &&
            this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[0]
          ) {
            wallCheck = false
          }
          if (wallCheck) {
            newSnakeDirection = 2 // Snake will be moving Up
            movePriority =
              currentMovingDirection === 3
                ? 0
                : currentMovingDirection === 2
                ? 1
                : currentMovingDirection === 1
                ? 2
                : 3
          }
        } else if (dx === 1) {
          // Trying to move Right
          if (
            (node.x + 1) % 2 === 0 &&
            this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[3]
          ) {
            wallCheck = false
          }
          if (wallCheck) {
            newSnakeDirection = 1 // Snake will be moving Right
            movePriority =
              currentMovingDirection === 2
                ? 0
                : currentMovingDirection === 1
                ? 1
                : currentMovingDirection === 0
                ? 2
                : 3
          }
        } else if (dx === -1) {
          // Trying to move Left
          if (
            node.x % 2 === 0 &&
            this.mazeGrid[Math.floor(node.y / 2)][Math.floor(node.x / 2)].walls[1]
          ) {
            wallCheck = false
          }
          if (wallCheck) {
            newSnakeDirection = 3 // Snake will be moving Left
            movePriority =
              currentMovingDirection === 0
                ? 0
                : currentMovingDirection === 3
                ? 1
                : currentMovingDirection === 2
                ? 2
                : 3
          }
        }

        if (wallCheck) {
          rankedPossibleMoves.push([movePriority, neighbor, newSnakeDirection])
        }
      }
      // Sort moves by priority in ascending order, lower priority value first
      rankedPossibleMoves.sort((a, b) => a[0] - b[0])

      for (const move of rankedPossibleMoves) {
        const [, neighbor, newDirection] = move
        this.hamilPath.push(neighbor)
        node.nextNode = neighbor
        // Recursively attempt to continue the path
        if (await this.genCycleFromMaze(neighbor, newDirection)) {
          return true
        }

        this.hamilPath.pop()
        node.nextNode = null
      }
    }
    node.visited = false
    return false
  }

  draw() {
    const theme = getCurrentTheme()
    
    if (props.visualPath && this.snakePath && this.snakePath.length > 0) {
      context.fillStyle = theme.snakePath
      for (const spot of this.snakePath) {
        context.fillRect(
          spot.x * blockSize + blockSize * 0.25,
          spot.y * blockSize + blockSize * 0.25,
          blockSize * 0.5,
          blockSize * 0.5
        )
      }
    }

    if (props.visualCycle && this.hamilPath && this.hamilPath.length > 0 && this.hamilDone) {
      context.strokeStyle = theme.hamiltonianPath
      context.lineWidth = Math.max(1, blockSize / 15)
      context.beginPath()
      context.moveTo(
        this.hamilPath[0].x * blockSize + blockSize / 2,
        this.hamilPath[0].y * blockSize + blockSize / 2
      )
      
      for (let i = 1; i < this.hamilPath.length; i++) {
        const spot = this.hamilPath[i]
        context.lineTo(
          spot.x * blockSize + blockSize / 2,
          spot.y * blockSize + blockSize / 2
        )
      }

      if (this.hamilPath[this.hamilPath.length - 1].nextNode === this.hamilStart && this.hamilStart) {
        context.lineTo(
          this.hamilStart.x * blockSize + blockSize / 2,
          this.hamilStart.y * blockSize + blockSize / 2
        )
      }
      context.stroke()
    }
  }
}

// Game functions
function getCurrentTheme() {
  return isDarkTheme.value ? themeColors.dark : themeColors.light
}

function initializeCanvas() {
  if (!snakeCanvas.value) return

  const canvas = snakeCanvas.value
  context = canvas.getContext('2d')!
  const ratio = Math.ceil(window.devicePixelRatio) || 1

  const canvasWidth = window.innerWidth
  const canvasHeight = window.innerHeight

  let tempCols = Math.floor(canvasWidth / blockSize)
  columns = tempCols % 2 === 0 ? tempCols : tempCols - 1
  if (columns < 4) columns = 4

  let tempRows = Math.floor(canvasHeight / blockSize)
  rows = tempRows % 2 === 0 ? tempRows : tempRows - 1
  if (rows < 4) rows = 4

  blockSize = Math.max(
    1,
    Math.min(Math.floor(canvasWidth / columns), Math.floor(canvasHeight / rows))
  )

  canvas.width = columns * blockSize * ratio
  canvas.height = rows * blockSize * ratio
  canvas.style.width = `${columns * blockSize}px`
  canvas.style.height = `${rows * blockSize}px`
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  console.log(`Board: ${columns}x${rows}, BlockSize: ${blockSize}`)
}

async function startGame() {
  // Clear any existing intervals first
  if (intervalID) {
    clearInterval(intervalID)
    intervalID = 0
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
  }
  
  initializeCanvas()
  
  GM = new GameMaster()
  await GM.genMaze()

  if (GM.hamilDone) {
    const startNode = GM.hamilPath[0]
    snakeX = startNode.x * blockSize
    snakeY = startNode.y * blockSize
    snakeBody = []
    gameOver = false // Ensure game is not in game over state

    placeFood()
    
    // Start the game loops
    intervalID = setInterval(preUpdate, 1000 / props.fps)
    animationFrameId = requestAnimationFrame(gameDrawLoop)
  } else {
    console.error('Game cannot start: Hamiltonian cycle generation failed.')
    updateGameMessage('Error: Failed to generate game paths. Please refresh.', true)
  }
}

async function regenerateGamePaths() {
  // Stop the current game loop temporarily
  if (intervalID) {
    clearInterval(intervalID)
    intervalID = 0 // Reset to ensure it's properly cleared
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = 0 // Reset to ensure it's properly cleared
  }
  
  // Store current game state
  const currentScore = score
  const currentGameOver = gameOver
  const wasRunning = !gameOver && !currentGameOver // Check if game was actually running
  
  // Clear canvas before regeneration
  if (context) {
    context.clearRect(0, 0, columns * blockSize, rows * blockSize)
  }
  
  // Regenerate the maze and Hamiltonian path
  GM = new GameMaster()
  await GM.genMaze()
  
  if (GM.hamilDone) {
    // Reset to starting position with current score preserved
    const startNode = GM.hamilPath[0]
    snakeX = startNode.x * blockSize
    snakeY = startNode.y * blockSize
    snakeBody = [] // Reset snake body for safety
    score = currentScore // Preserve score
    gameOver = currentGameOver
    
    // Place new food
    placeFood()
    
    // Update snake path for visualization
    if (food) {
      const foodGridX = Math.floor(food[0] / blockSize)
      const foodGridY = Math.floor(food[1] / blockSize)
      if (foodGridX >= 0 && foodGridX < columns && foodGridY >= 0 && foodGridY < rows) {
        const foodNode = GM.grid[foodGridY][foodGridX]
        const currentNode = GM.grid[Math.floor(snakeY / blockSize)][Math.floor(snakeX / blockSize)]
        const currentNodeIndex = GM.hamilPath.indexOf(currentNode)
        const foodNodeIndex = GM.hamilPath.indexOf(foodNode)

        if (currentNodeIndex !== -1 && foodNodeIndex !== -1) {
          GM.snakePath = GM.hamilPath.slice(currentNodeIndex, foodNodeIndex + 1)
          if (currentNodeIndex > foodNodeIndex) {
            GM.snakePath = GM.hamilPath.slice(currentNodeIndex).concat(GM.hamilPath.slice(0, foodNodeIndex + 1))
          }
        }
      }
    }
    
    // Only restart the game loop if it was actually running before and game is not over
    if (wasRunning && !gameOver) {
      // Ensure we don't have any existing intervals before starting a new one
      if (intervalID) clearInterval(intervalID)
      intervalID = setInterval(preUpdate, 1000 / props.fps)
      
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(gameDrawLoop)
    } else {
      // Just draw the current state without starting the loop
      draw()
    }
  } else {
    console.error('Failed to regenerate game paths.')
    updateGameMessage('Error: Failed to regenerate game paths.', true)
  }
}

function gameDrawLoop() {
  draw()
  if (!gameOver) {
    animationFrameId = requestAnimationFrame(gameDrawLoop)
  }
}

function preUpdate() {
  const iterations = Math.min(Math.max(1, Math.floor(props.fps / 250)), 20)
  for (let i = 0; i < iterations; i++) {
    if (gameOver) break
    update()
  }
}

function update() {
    const currentTime = performance.now()
    const deltaTime = currentTime - lastTime
    frameCount++

    if (deltaTime >= 1000) {
        frameCount = 0
        lastTime = currentTime
    }

    if (gameOver || !GM.hamilDone) {
        return
    }

    // Move snake
    for (let i = snakeBody.length - 1; i > 0; i--) {
        snakeBody[i] = snakeBody[i - 1]
    }
    if (snakeBody.length) {
        snakeBody[0] = [snakeX, snakeY]
    }

  
    if (typeof snakeX === 'undefined' || typeof snakeY === 'undefined' || typeof food === 'undefined') {
        return
    }

    const currentGridX = Math.floor(snakeX / blockSize)
    const currentGridY = Math.floor(snakeY / blockSize)

    if (currentGridX < 0 || currentGridX >= columns || currentGridY < 0 || currentGridY >= rows) {
        return
    }

    const currentNode = GM.grid[currentGridY][currentGridX]
    const foodGridX = Math.floor(food[0] / blockSize)
    const foodGridY = Math.floor(food[1] / blockSize)

    if (foodGridX < 0 || foodGridX >= columns || foodGridY < 0 || foodGridY >= rows) {
        const newFoodX = Math.floor(Math.random() * columns) * blockSize
        const newFoodY = Math.floor(Math.random() * rows) * blockSize
        const newFoodNode = GM.grid[Math.floor(newFoodY / blockSize)][Math.floor(newFoodX / blockSize)]
        findAndMoveSnake(currentNode, newFoodNode)
    } else {
        const foodNode = GM.grid[foodGridY][foodGridX]
        findAndMoveSnake(currentNode, foodNode)
    }
  

  // Food consumption
  if (snakeX === food[0] && snakeY === food[1]) {
    let lastSnake = snakeBody.length > 0 ? snakeBody[snakeBody.length - 1] : [snakeX, snakeY]
    let lastNode = GM.grid[Math.floor(lastSnake[1] / blockSize)][Math.floor(lastSnake[0] / blockSize)]
    let lastNodeIndex = GM.hamilPath.indexOf(lastNode)

    if (lastNodeIndex === -1) {
      lastNodeIndex = GM.hamilPath.indexOf(GM.grid[Math.floor(snakeY / blockSize)][Math.floor(snakeX / blockSize)])
    }

    let newSnakeNodeIndex = (lastNodeIndex - 1 + GM.hamilPath.length) % GM.hamilPath.length
    let newSnakeNode = GM.hamilPath[newSnakeNodeIndex]

    snakeBody.push([newSnakeNode.x * blockSize, newSnakeNode.y * blockSize])
    placeFood()
    score++

    if (!gameOver && food) {
      const foodGridX = Math.floor(food[0] / blockSize)
      const foodGridY = Math.floor(food[1] / blockSize)
      if (foodGridX >= 0 && foodGridX < columns && foodGridY >= 0 && foodGridY < rows) {
        const foodNode = GM.grid[foodGridY][foodGridX]
        const currentGridX = Math.floor(snakeX / blockSize)
        const currentGridY = Math.floor(snakeY / blockSize)
        const currentNode = GM.grid[currentGridY][currentGridX]
        const currentNodeIndex = GM.hamilPath.indexOf(currentNode)
        const foodNodeIndex = GM.hamilPath.indexOf(foodNode)

        if (currentNodeIndex !== -1 && foodNodeIndex !== -1) {
          GM.snakePath = GM.hamilPath.slice(currentNodeIndex, foodNodeIndex + 1)
          if (currentNodeIndex > foodNodeIndex) {
            GM.snakePath = GM.hamilPath.slice(currentNodeIndex).concat(GM.hamilPath.slice(0, foodNodeIndex + 1))
          }
        }
      }
    }
  }

  if (!gameOver) checkGameOver()
}

function findAndMoveSnake(currentNode: Spot, foodNode: Spot) {
  const foodNum = GM.hamilPath.indexOf(foodNode)
  if (foodNum === -1) {
    console.error('Food node not found in Hamiltonian path')
    return
  }

  const currentNodeIndex = GM.hamilPath.indexOf(currentNode)
  if (currentNodeIndex === -1) {
    console.error('Current node not found in Hamiltonian path')
    return
  }

  let nextNode = findShortcut(currentNode, foodNode)
  if (!nextNode) {
    nextNode = currentNode.nextNode || GM.hamilPath[0]
  }

  let nextNum = GM.hamilPath.indexOf(nextNode)
  if (nextNum === -1) {
    console.error('Next node not found in Hamiltonian path')
    // Emergency fallback: use next node in cycle
    nextNum = GM.getEmergencyMove(currentNodeIndex)
    nextNode = GM.hamilPath[nextNum]
  }

  // Final safety check: ensure the next move won't cause collision
  const nextX = nextNode.x * blockSize
  const nextY = nextNode.y * blockSize
  
  // Check if next position would collide with snake body
  const wouldCollide = snakeBody.some(bodyPart => 
    bodyPart[0] === nextX && bodyPart[1] === nextY
  )
  
  if (wouldCollide) {
    // Emergency: fall back to Hamiltonian cycle
    console.warn('Collision detected, falling back to safe path')
    nextNum = GM.getEmergencyMove(currentNodeIndex)
    nextNode = GM.hamilPath[nextNum]
  }

  GM.snakePath = GM.hamilPath.slice(nextNum, foodNum + 1)
  if (nextNum > foodNum) {
    GM.snakePath = GM.hamilPath.slice(nextNum).concat(GM.hamilPath.slice(0, foodNum + 1))
  }

  snakeX = nextNode.x * blockSize
  snakeY = nextNode.y * blockSize
}

function draw() {
  const theme = getCurrentTheme()
  
  // Clear canvas with transparent background
  context.clearRect(0, 0, columns * blockSize, rows * blockSize)

  GM.draw()

  context.fillStyle = 'rgba(250,40,40, 0.7)'
  context.fillRect(food[0], food[1], blockSize, blockSize)

  /*
  context.fillStyle = 'rgba(40,180,60, 1)'
  if (typeof snakeX !== 'undefined' && typeof snakeY !== 'undefined') {
    context.fillRect(snakeX, snakeY, blockSize, blockSize)
  }

  context.fillStyle = 'rgba(40,200,60, 0.6)'
  for (let i = 0; i < snakeBody.length; i++) {
    context.fillRect(snakeBody[i][0], snakeBody[i][1], blockSize, blockSize)
  }*/
  // Start at the first segment
  const body = [[snakeX, snakeY], ...snakeBody];
  context.beginPath()
  context.moveTo(body[0][0] + blockSize / 2, body[0][1] + blockSize / 2)

    // Draw lines between segments
    for (let i = 1; i < body.length; i++) {
        let dist = Math.sqrt((body[i][0]-body[i-1][0])**2 + (body[i][1]-body[i-1][1])**2);
        if (dist <= blockSize * 1.5) {
            context.lineTo(body[i][0] + blockSize / 2, body[i][1] + blockSize / 2);
        } else {
            context.moveTo(body[i][0] + blockSize / 2, body[i][1] + blockSize / 2);
        }
    }
    context.lineWidth = blockSize / 1.1; // Thickness of the snake
    context.strokeStyle = "rgba(40, 200, 60, 1)"; // Snake color
    context.stroke();
    context.fillStyle = "rgba(40, 170, 50, 1)";
    context.fillRect(body[0][0] + 0.02*blockSize, body[0][1] + 0.02*blockSize, blockSize - 0.04*blockSize, blockSize - 0.04*blockSize);


  if (gameOver) {
    updateGameMessage(`Hur hände detta... den dog :((`, true)
  } else if (GM.hamilDone && snakeBody.length >= rows * columns) {
    updateGameMessage(`Wow! Den klarade det!!`, true)
    gameOver = true
  }
}

function checkIntersection(): boolean {
  if (typeof snakeX === 'undefined' || typeof snakeY === 'undefined') return false

  if (
    snakeX < 0 ||
    Math.round(snakeX) >= columns * blockSize ||
    snakeY < 0 ||
    Math.round(snakeY) >= rows * blockSize
  ) {
    return true
  }

  for (let i = 0; i < snakeBody.length; i++) {
    if (snakeX === snakeBody[i][0] && snakeY === snakeBody[i][1]) {
      return true
    }
  }
  return false
}

function getDistance(num: number, targetNum: number): number {
  if (!GM.grid || GM.grid.length === 0 || !GM.hamilPath || GM.hamilPath.length === 0) return Infinity
  return GM.getDistance(num, targetNum)
}

function findShortcut(currentNode: Spot, foodNode: Spot): Spot | null {
  if (!GM.hamilPath || GM.hamilPath.length === 0) return currentNode.nextNode

  const currentNodeIndex = GM.hamilPath.indexOf(currentNode)
  const foodIndex = GM.hamilPath.indexOf(foodNode)

  if (currentNodeIndex === -1 || foodIndex === -1) {
    console.error('Node not found in Hamiltonian path')
    return currentNode.nextNode || GM.hamilPath[0]
  }

  // Increment total moves for statistics
  GM.totalMoves++

  // Get default next node (Hamiltonian path)
  let nextNode = currentNode.nextNode
  if (!nextNode) {
    nextNode = GM.hamilPath[(currentNodeIndex + 1) % GM.hamilPath.length]
  }
  
  const nextNodeIndex = GM.hamilPath.indexOf(nextNode)
  const hamiltonianDistToFood = getDistance(nextNodeIndex, foodIndex)

  // Initialize debug info
  const maxSnakeLength = rows * columns
  const snakeRatio = (snakeBody.length + 1) / maxSnakeLength
  const minRequiredSavings = Math.min(Math.max(1, Math.floor((snakeBody.length + 1) * 0.05)), 7) // Reduced threshold
  
  // Simplified threshold: allow shortcuts for small snakes
  const allowShortcuts = snakeRatio < 0.8 // Allow shortcuts until 80% full
  
  let bestNode = nextNode
  let decisionType: 'shortcut' | 'hamiltonian' | 'skip' = 'hamiltonian'
  let decisionReason = 'Following Hamiltonian path (default)'

  let validNeighbors: number = 0
  let snakeBodyInTot: number = rows * columns - snakeBody.length // Start with max possible distance
  if (allowShortcuts) {
    // Get all valid neighbors and calculate their potential savings
    const shortcutCandidates = currentNode.neighbors
      .map(neighbor => {
        const neighborIndex = GM.hamilPath.indexOf(neighbor)
        if (neighborIndex === -1 || neighborIndex === currentNodeIndex) return null
        
        const shortcutDistToFood = getDistance(neighborIndex, foodIndex)
        const savings = hamiltonianDistToFood - shortcutDistToFood
        
        return {
          node: neighbor,
          index: neighborIndex,
          distanceToFood: shortcutDistToFood,
          savings: savings
        }
      })
      .filter(candidate => candidate !== null && candidate.savings >= minRequiredSavings)
      .sort((a, b) => b!.savings - a!.savings) // Sort by savings (best first)

    // Test each candidate in order of savings
    for (const candidate of shortcutCandidates) {
      const { node: neighbor, index: neighborIndex, savings, distanceToFood } = candidate!
      
      // Is this shortcut safe?
      const {safetyCheckPassed, snakeBodyIn} = GM.isShortcutSafe(currentNodeIndex, neighborIndex)
      if (snakeBodyInTot > snakeBodyIn) {
        // Track the closest body part in the path
        snakeBodyInTot = snakeBodyIn
      }

      // Store analysis for debug
      validNeighbors++
      
      // Take the first safe shortcut we find
      if (safetyCheckPassed) {
        decisionType = 'shortcut'
        decisionReason = `Taking shortcut: saves ${savings} steps (${hamiltonianDistToFood} → ${distanceToFood})`
        GM.shortcutsTaken++
        bestNode = neighbor
        break
      } else if (!safetyCheckPassed) {
        decisionReason = `Best shortcut fails safety check (would save ${savings} steps)`
      } else {
        decisionReason = `Best shortcut fails path check (would save ${savings} steps)`
      }
    }
    
    if (shortcutCandidates.length === 0) {
      decisionReason = `No shortcuts available (savings ≥${minRequiredSavings} needed)`
    }
  } else {
    decisionType = 'skip'
    decisionReason = `Snake too large for shortcuts (${(snakeRatio * 100).toFixed(1)}% full)`
  }

  // Update debug info if debug mode is enabled
  if (props.debugMode) {
    debugInfo.value = {
      snakeLength: snakeBody.length + 1,
      snakeRatio,
      maxSnakeLength,
      shortcutThreshold: allowShortcuts ? 1 : 0,
      lengthCheckPassed: allowShortcuts,
      minDistToFood: hamiltonianDistToFood,
      minRequiredSavings,
      validNeighbors: validNeighbors,
      snakeBodyIn: snakeBodyInTot,
      shortcutsTaken: GM.shortcutsTaken,
      totalMoves: GM.totalMoves,
      shortcutRate: GM.totalMoves > 0 ? (GM.shortcutsTaken / GM.totalMoves) * 100 : 0,
      lastDecision: {
        type: decisionType,
        reason: decisionReason
      }
    }
  }
  
  return bestNode
}

function checkGameOver() {
  const intersects = checkIntersection()
  if (intersects) {
    gameOver = true
  }
  
  if (GM.hamilDone && snakeBody.length + 1 >= rows * columns) {
    gameOver = true
  }

  if (gameOver) {
    if (intervalID) clearInterval(intervalID)
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    draw()
  }
}

function placeFood() {
  if (gameOver) return
  // Get free spaces not occupied by snake
  const freeSpaces: number[][] = GM.grid.flat().map(cell => [cell.x, cell.y])
    .filter(pos => {
      const x = pos[0] * blockSize
      const y = pos[1] * blockSize
      return !snakeBody.some(body => body[0] === x && body[1] === y) &&
             !(typeof snakeX !== 'undefined' && typeof snakeY !== 'undefined' && snakeX === x && snakeY === y)
    })

  const randomIndex = Math.floor(Math.random() * freeSpaces.length)
  const [foodX, foodY] = freeSpaces[randomIndex]

  food = [foodX * blockSize, foodY * blockSize]
}

function updateGameMessage(message: string, show: boolean) {
  gameMessage.value = message
  showMessage.value = show
}

// Lifecycle
onMounted(() => {
  // Set global visualization flags on mount
  if (typeof window !== 'undefined') {
    ;(window as any).visualCycle = props.visualCycle
    ;(window as any).visualPath = props.visualPath
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeChange = (e: MediaQueryListEvent) => {
      isDarkTheme.value = e.matches
    }
    mediaQuery.addEventListener('change', handleThemeChange)
    
    // Clean up listener on unmount
    onUnmounted(() => {
      mediaQuery.removeEventListener('change', handleThemeChange)
    })
  }
  
  if (props.autoStart) {
    startGame()
  }
})

onUnmounted(() => {
  if (intervalID) {
    clearInterval(intervalID)
    intervalID = 0
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
  }
})

// Expose methods for external control
defineExpose({
  startGame,
  stopGame: () => {
    gameOver = true
    if (intervalID) {
      clearInterval(intervalID)
      intervalID = 0
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
    }
  }
})
</script>

<style lang="scss" scoped>
.hamiltonian-snake {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.3s ease;
  background-color: transparent;

  .background-pattern {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    z-index: -1;
    opacity: 0.1;
    transition: opacity 0.3s ease;

    .pattern-text {
      font-size: clamp(3rem, 8vw, 8rem);
      font-weight: 900;
      font-family: 'Arial Black', Arial, sans-serif;
      letter-spacing: 0.2em;
      color: #333;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }

    .pattern-subtext {
      font-size: clamp(1rem, 3vw, 2rem);
      font-weight: 600;
      color: #666;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  }

  &.dark-theme .background-pattern {
    .pattern-text {
      color: #ccc;
    }

    .pattern-subtext {
      color: #999;
    }
  }

  canvas {
    background-color: transparent;
    transition: border-color 0.3s ease;
    pointer-events: none; /* Make canvas non-interactive */
  }

  .game-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    font-size: 24px;
    text-align: center;
    border-radius: 10px;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;

    &.show {
      opacity: 1;
      visibility: visible;
    }
  }

  &.dark-theme .game-message {
    background-color: rgba(255, 255, 255, 0.9);
    color: #333;
  }

  .debug-overlay {
    position: absolute;
    top: 10px;
    left: 10px;
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    max-width: 400px;
    overflow-y: visible;
    z-index: 2000;
    border: 1px solid #333;
    transition: all 0.3s ease;

    h3 {
      margin: 0 0 15px 0;
      color: #4CAF50;
      font-size: 14px;
      border-bottom: 1px solid #4CAF50;
      padding-bottom: 5px;
    }

    h4 {
      margin: 10px 0 5px 0;
      color: #FFC107;
      font-size: 12px;
    }

    .debug-section {
      margin-bottom: 15px;
      border-left: 2px solid #2196F3;
      padding-left: 10px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .debug-row {
      margin: 3px 0;
      line-height: 1.4;

      &.decision {
        font-weight: bold;
        padding: 5px;
        border-radius: 4px;

        &.shortcut {
          background-color: rgba(76, 175, 80, 0.3);
          border: 1px solid #4CAF50;
        }

        &.hamiltonian {
          background-color: rgba(33, 150, 243, 0.3);
          border: 1px solid #2196F3;
        }

        &.skip {
          background-color: rgba(255, 193, 7, 0.3);
          border: 1px solid #FFC107;
        }
      }
    }

    .neighbor-info {
      font-size: 11px;
      display: block;
      margin: 2px 0;
      padding: 2px 5px;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
  }

  &.dark-theme .debug-overlay {
    background-color: rgba(255, 255, 255, 0.9);
    color: #333;
    border: 1px solid #ccc;

    h3 {
      color: #2E7D32;
      border-bottom: 1px solid #2E7D32;
    }

    h4 {
      color: #F57C00;
    }

    .debug-section {
      border-left: 2px solid #1976D2;
    }

    .debug-row.decision {
      &.shortcut {
        background-color: rgba(76, 175, 80, 0.2);
        border: 1px solid #2E7D32;
      }

      &.hamiltonian {
        background-color: rgba(33, 150, 243, 0.2);
        border: 1px solid #1976D2;
      }

      &.skip {
        background-color: rgba(255, 193, 7, 0.2);
        border: 1px solid #F57C00;
      }
    }

    .neighbor-info {
      background-color: rgba(0, 0, 0, 0.1);
    }
  }
}
</style>
