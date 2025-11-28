<template>
  <div class="tower-drop-container" :class="{ 'dark-mode': themeStore.isDarkMode }">
    <h1 class="game-header">Tower Drop</h1>
    <div class="game-layout">
      <div class="sidebar left">
        <div class="game-info">
          <div class="info-item">
            <span class="info-label">Score</span>
            <span class="info-value">{{ score }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Height</span>
            <span class="info-value">{{ -Math.floor(cameraY / 40) }} m</span>
          </div>
        </div>
      </div>

      <div class="canvas-outer-wrapper">
        <canvas ref="canvasRef"></canvas>
        <div v-if="isGameOver" class="game-over-overlay">
          <div class="game-over-content">
            <h2>Game Over</h2>
            <p>Your final score: {{ score }}</p>
            <p>Tower height: {{ Math.floor(cameraY / 40) }} m</p>
            <button @click="resetGame">Play Again</button>
          </div>
        </div>
      </div>

      <div class="sidebar right">
        <div class="sidebar-btn-container">
          <button @click="resetGame" class="sidebar-btn">Reset</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import * as Matter from 'matter-js'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const isGameOver = ref(false)
let blockIdCounter = 0

let engine: Matter.Engine
let runner: Matter.Runner
let world: Matter.World
let context: CanvasRenderingContext2D | null

let currentBlock: Matter.Body | null
let platformDirection = 1
const platformSpeed = computed(() => 2 + score.value / 50)

let canvasWidth = 800
let canvasHeight = 600
let resizeHandler: (() => void) | null = null

// Camera and view properties
const cameraY = ref(0)
const targetCameraY = ref(0)
const cameraZoom = ref(1)
const targetCameraZoom = ref(1)

const BLOCK_HEIGHT = 40

interface CustomBody extends Matter.Body {
  blockId?: number
}

const blockColors = [
  '#FF6B6B',
  '#FFD166',
  '#06D6A0',
  '#118AB2',
  '#073B4C',
  '#F78C6B',
  '#FCBF49',
  '#90BE6D',
]
const getRandomColor = () => blockColors[Math.floor(Math.random() * blockColors.length)]

const createBlock = (
  x: number,
  y: number,
  width: number,
  height: number,
  isStatic = false,
  label = 'block',
) => {
  const color = isStatic ? (themeStore.isDarkMode ? '#444' : '#AAA') : getRandomColor()
  const block: CustomBody = Matter.Bodies.rectangle(x, y, width, height, {
    isStatic,
    label,
    density: 0.005,
    friction: 0.8,
    restitution: 0.1,
    render: { fillStyle: color },
  })
  block.blockId = blockIdCounter++
  return block
}

const adjustCanvasSize = () => {
  if (!canvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const parent = canvasRef.value.parentElement
  if (!parent) return

  const newWidth = parent.clientWidth
  const newHeight = parent.clientHeight

  if (newWidth === canvasWidth && newHeight === canvasHeight) return

  canvasWidth = newWidth
  canvasHeight = newHeight

  const canvas = canvasRef.value
  canvas.width = canvasWidth * dpr
  canvas.height = canvasHeight * dpr
  canvas.style.width = `${canvasWidth}px`
  canvas.style.height = `${canvasHeight}px`

  context?.scale(dpr, dpr)

  if (world) {
    const ground = Matter.Composite.allBodies(world).find((b) => b.label === 'ground')
    if (ground) {
      Matter.Body.setPosition(ground, { x: canvasWidth / 2, y: canvasHeight - 20 })
      Matter.Body.setVertices(ground, [
        { x: 0, y: canvasHeight - 40 },
        { x: canvasWidth, y: canvasHeight - 40 },
        { x: canvasWidth, y: canvasHeight },
        { x: 0, y: canvasHeight },
      ])
    }
  }
}

const setup = () => {
  if (!canvasRef.value) return

  isGameOver.value = false
  score.value = 0
  cameraY.value = 0
  targetCameraY.value = 0
  cameraZoom.value = 1
  targetCameraZoom.value = 1

  const canvas = canvasRef.value
  context = canvas.getContext('2d')

  adjustCanvasSize()

  engine = Matter.Engine.create()
  world = engine.world
  engine.gravity.y = 1

  runner = Matter.Runner.create()
  Matter.Runner.run(runner, engine)

  const ground = createBlock(canvasWidth / 2, canvasHeight - 20, canvasWidth, 40, true, 'ground')
  Matter.Composite.add(world, ground)

  spawnNewBlock()

  Matter.Events.on(engine, 'beforeUpdate', gameLoop)
  Matter.Events.on(engine, 'collisionStart', handleCollision)

  window.addEventListener('keydown', handleKeyPress)
  canvas.addEventListener('click', dropBlock)

  draw()
}

const draw = () => {
  if (!context || !world) return

  // Smooth camera movement
  cameraY.value += (targetCameraY.value - cameraY.value) * 0.02
  cameraZoom.value += (targetCameraZoom.value - cameraZoom.value) * 0.02

  context.save()
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.fillStyle = themeStore.isDarkMode ? '#1a1a1a' : '#f0f0f0'
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  // Apply camera zoom and translation
  context.translate(canvasWidth / 2, canvasHeight / 2)
  context.scale(cameraZoom.value, cameraZoom.value)
  context.translate(-canvasWidth / 2, -canvasHeight / 2)
  context.translate(0, cameraY.value)

  const bodies = Matter.Composite.allBodies(world)

  for (const body of bodies) {
    context.fillStyle = body.render.fillStyle || '#ccc'
    context.strokeStyle = themeStore.isDarkMode ? '#EFEFEF' : '#333'
    context.lineWidth = 2 / cameraZoom.value // Keep line width consistent when zooming

    context.beginPath()
    const vertices = body.vertices
    if (vertices && vertices.length > 0) {
      context.moveTo(vertices[0].x, vertices[0].y)
      for (let j = 1; j < vertices.length; j += 1) {
        context.lineTo(vertices[j].x, vertices[j].y)
      }
      context.closePath()
      context.fill()
      context.stroke()
    }
  }

  context.restore()

  requestAnimationFrame(draw)
}

const spawnNewBlock = () => {
  if (isGameOver.value) return
  const blockWidth = Math.max(40, 150 - score.value / 4)
  const blockHeight = BLOCK_HEIGHT
  const startX = Math.random() * (canvasWidth - blockWidth) + blockWidth / 2
  currentBlock = createBlock(startX, 50 - cameraY.value, blockWidth, blockHeight)
  Matter.Body.setStatic(currentBlock, true)
  Matter.Composite.add(world, currentBlock)
}

const gameLoop = () => {
  if (isGameOver.value) return

  // Move current block
  if (currentBlock) {
    let x = currentBlock.position.x + platformDirection * platformSpeed.value
    const blockWidth = currentBlock.bounds.max.x - currentBlock.bounds.min.x
    if (x > canvasWidth - blockWidth / 2) {
      x = canvasWidth - blockWidth / 2
      platformDirection *= -1
    } else if (x < blockWidth / 2) {
      x = blockWidth / 2
      platformDirection *= -1
    }
    Matter.Body.setPosition(currentBlock, { x, y: currentBlock.position.y })
  }
}

const dropBlock = () => {
  if (!currentBlock || isGameOver.value) return
  Matter.Body.setStatic(currentBlock, false)
  const droppedBlock = currentBlock as CustomBody
  droppedBlock.label = `dropped-${droppedBlock.blockId}`
  score.value += 10

  // Check stack height and adjust camera
  if (Matter.Composite.allBodies(world).length > 5) {
    targetCameraY.value += BLOCK_HEIGHT // Move camera up by one block height
  }

  // Freeze blocks that are now off-screen
  freezeOffscreenBlocks()

  currentBlock = null
  setTimeout(spawnNewBlock, 500)
}

const freezeOffscreenBlocks = () => {
  const droppedBlocks = Matter.Composite.allBodies(world).filter((b) =>
    b.label.startsWith('dropped-'),
  ) as CustomBody[]

  const highestBlockId = Math.max(0, ...droppedBlocks.map((b) => b.blockId || 0))
  const staticThreshold = Math.max(0, highestBlockId - 5) // Keep last 5 blocks dynamic

  for (const block of droppedBlocks) {
    if (block.isStatic) continue

    // Freeze blocks that are part of the stable tower base
    if (block.blockId !== undefined && block.blockId < staticThreshold) {
      Matter.Body.setStatic(block, true)
    }

    // Remove blocks that fall off the top of the screen
    const ground = Matter.Composite.allBodies(world).find((b) => b.label === 'ground')
    if (ground) {
      if (block.position.y > ground.position.y) {
        endGame()
      }
    }
  }
}

const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
  if (isGameOver.value) return
  const pairs = event.pairs
  for (const pair of pairs) {
    const { bodyA, bodyB } = pair
    // Game over if a dropped block hits the ground
    if (
      (bodyA.label.startsWith('dropped-') && bodyB.label === 'ground') ||
      (bodyB.label.startsWith('dropped-') && bodyA.label === 'ground')
    ) {
      // Make sure it's not the very first block
      const droppedCount = Matter.Composite.allBodies(world).filter((b) =>
        b.label.startsWith('dropped-'),
      ).length
      if (droppedCount > 1) {
        endGame()
        return
      }
    }
  }
}

const endGame = () => {
  isGameOver.value = true
  if (runner) Matter.Runner.stop(runner)

  // Zoom out to show the full tower
  const allBodies = Matter.Composite.allBodies(world)
  if (allBodies.length > 1) {
    const bounds = Matter.Bounds.create(allBodies.map((b) => b.vertices).flat())
    const towerHeight = bounds.max.y - bounds.min.y
    const towerWidth = bounds.max.x - bounds.min.x

    const zoomY = canvasHeight / towerHeight
    const zoomX = canvasWidth / towerWidth
    targetCameraZoom.value = Math.min(zoomX, zoomY) * 0.9 // 90% of fit

    // Center the view on the tower
    const towerCenterY = (bounds.min.y + bounds.max.y) / 2
    targetCameraY.value = canvasHeight / 2 - towerCenterY * targetCameraZoom.value
  }
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.code === 'Space') {
    event.preventDefault()
    dropBlock()
  }
}

const resetGame = () => {
  if (runner) Matter.Runner.stop(runner)
  if (world) Matter.World.clear(world, false)
  if (engine) Matter.Engine.clear(engine)
  blockIdCounter = 0
  setup()
}

watch(
  () => themeStore.isDarkMode,
  () => {
    if (world) {
      const ground = Matter.Composite.allBodies(world).find((b) => b.label === 'ground')
      if (ground) {
        ground.render.fillStyle = themeStore.isDarkMode ? '#444' : '#AAA'
      }
    }
  },
)

onMounted(() => {
  setup()
  resizeHandler = () => adjustCanvasSize()
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (runner) Matter.Runner.stop(runner)
  if (world) Matter.World.clear(world, false)
  if (engine) Matter.Engine.clear(engine)
  window.removeEventListener('keydown', handleKeyPress)
  if (canvasRef.value) canvasRef.value.removeEventListener('click', dropBlock)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped lang="scss">
@use '@/pages/minigames/TowerDrop.scss';
</style>
