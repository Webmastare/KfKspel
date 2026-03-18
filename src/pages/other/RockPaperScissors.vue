<template>
  <div class="game-container">
    <canvas ref="canvasRef" class="main-canvas"></canvas>

    <div class="ui-bar">
      <button class="icon-btn" @click="decreaseSpeed" title="Minska hastighet">⏪</button>
      <button class="main-btn" @click="toggleSettings">Inställningar</button>
      <button class="icon-btn" @click="increaseSpeed" title="Öka hastighet">⏩</button>
      <div class="divider"></div>
      <button class="main-btn" @click="toggleChart">📊 Statistik</button>
    </div>

    <div v-if="isSettingsOpen" class="overlay-backdrop" @click.self="toggleSettings">
      <div class="overlay-modal">
        <h2>Inställningar</h2>

        <div class="setting-group">
          <label>Antal objekt: {{ totalItems }}</label>
          <input type="range" min="10" max="500" step="10" v-model.number="totalItems" />
        </div>

        <div class="setting-group">
          <label>Simuleringshastighet: {{ simSpeed.toFixed(1) }}x</label>
          <input type="range" min="0.1" max="20" step="0.1" v-model.number="simSpeed" />
        </div>

        <button class="action-btn" @click="resetSimulation">Starta om</button>
        <button class="close-btn" @click="toggleSettings">Stäng</button>
      </div>
    </div>

    <div v-show="isChartOpen" class="overlay-backdrop" @click.self="toggleChart">
      <div class="overlay-modal chart-modal">
        <h2>Populationshistorik</h2>
        <div class="chart-container">
          <canvas ref="chartCanvasRef"></canvas>
        </div>
        <button class="close-btn" @click="toggleChart">Stäng</button>
      </div>
    </div>

    <div v-if="isGameOver" class="overlay-backdrop" @click.self>
      <div class="overlay-modal winner-modal">
        <h2>Simuleringen är klar</h2>
        <p class="winner-text">Vinnare: {{ winnerLabel }}</p>
        <button class="action-btn" @click="resetSimulation">Starta om simulering</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { useThemeStore } from '@/stores/theme'

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
)

// Types
type ItemType = 'r' | 'p' | 's'

interface Item {
  x: number
  y: number
  dx: number
  dy: number
  type: ItemType
}

// State
const canvasRef = ref<HTMLCanvasElement | null>(null)
const chartCanvasRef = ref<HTMLCanvasElement | null>(null)

const isSettingsOpen = ref(false)
const isChartOpen = ref(false)
const isGameOver = ref(false)

const totalItems = ref(100)
const simSpeed = ref(1.0)

const itemSize = 30
const speedWeight = 2 // Base movement speed
let items: Item[] = []
let animationFrameId: number | null = null
let updateCalls = 0
const winnerType = ref<ItemType | null>(null)

const themeStore = useThemeStore()

interface ThemePalette {
  canvasBg: string
  chartText: string
  chartGrid: string
}

const palette = ref<ThemePalette>({
  canvasBg: '#f8f9fa',
  chartText: '#212529',
  chartGrid: 'rgba(0, 0, 0, 0.1)',
})

// Chart state
let chartInstance: Chart | null = null
const rockData: number[] = []
const paperData: number[] = []
const scissorData: number[] = []
const labels: number[] = []

const itemCoding: Record<ItemType, string> = { r: '🪨', p: '📜', s: '✂️' }
const typeMap: Record<number, ItemType> = { 0: 'r', 1: 'p', 2: 's' }
const typeLabelMap: Record<ItemType, string> = {
  r: 'Sten 🪨',
  p: 'Papper 📜',
  s: 'Sax ✂️',
}

const rules: Record<ItemType, ItemType> = {
  r: 's', // rock beats scissors
  p: 'r', // paper beats rock
  s: 'p', // scissors beats paper
}

const winnerLabel = computed(() => (winnerType.value ? typeLabelMap[winnerType.value] : '-'))

const randomType = (): ItemType => {
  const types: ItemType[] = ['r', 'p', 's']
  return types[Math.floor(Math.random() * types.length)] || 'r'
}

const createRandomItem = (type: ItemType = randomType()): Item => {
  const width = window.innerWidth
  const height = window.innerHeight

  return {
    x: Math.random() * (width - itemSize),
    y: Math.random() * (height - itemSize),
    dx: (Math.random() * 2 - 1) * speedWeight,
    dy: (Math.random() * 2 - 1) * speedWeight,
    type,
  }
}

const syncTotalItems = (targetTotal: number) => {
  const safeTarget = Math.max(10, targetTotal)
  const diff = safeTarget - items.length

  if (diff > 0) {
    for (let i = 0; i < diff; i++) {
      items.push(createRandomItem())
    }
    return
  }

  if (diff < 0) {
    for (let i = 0; i < Math.abs(diff); i++) {
      if (items.length === 0) break
      const randomIndex = Math.floor(Math.random() * items.length)
      items.splice(randomIndex, 1)
    }
  }
}

const getCurrentCounts = () => {
  const counts = { r: 0, p: 0, s: 0 }
  for (const item of items) {
    counts[item.type]++
  }
  return counts
}

const applyChartDataBindings = () => {
  if (!chartInstance) return

  chartInstance.data.labels = labels
  if (chartInstance.data.datasets[0]) chartInstance.data.datasets[0].data = rockData
  if (chartInstance.data.datasets[1]) chartInstance.data.datasets[1].data = paperData
  if (chartInstance.data.datasets[2]) chartInstance.data.datasets[2].data = scissorData
}

const resetChartHistory = () => {
  labels.length = 0
  rockData.length = 0
  paperData.length = 0
  scissorData.length = 0
  updateCalls = 0

  if (!chartInstance) return
  applyChartDataBindings()
  chartInstance.update('none')
}

const pushChartSnapshot = (counts: { r: number; p: number; s: number }) => {
  labels.push(updateCalls / 30)
  rockData.push(counts.r)
  paperData.push(counts.p)
  scissorData.push(counts.s)

  if (labels.length > 50) {
    labels.shift()
    rockData.shift()
    paperData.shift()
    scissorData.shift()
  }
}

const rebuildChartForTheme = () => {
  if (!chartCanvasRef.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const nextChart = initChart()
  if (nextChart && nextChart.options.scales?.y) {
    nextChart.options.scales.y.max = items.length
    nextChart.update('none')
  }
}

const updateThemePalette = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const styles = window.getComputedStyle(document.documentElement)
  const readVar = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim()
    return value || fallback
  }

  palette.value = {
    canvasBg: readVar('--theme-bg-primary', '#f8f9fa'),
    chartText: readVar('--theme-text-primary', '#212529'),
    chartGrid: readVar('--theme-border-light', 'rgba(0, 0, 0, 0.1)'),
  }

  if (chartInstance) rebuildChartForTheme()
}

// UI Toggles
const toggleSettings = () => (isSettingsOpen.value = !isSettingsOpen.value)
const toggleChart = () => (isChartOpen.value = !isChartOpen.value)
const decreaseSpeed = () => (simSpeed.value = Math.max(0.1, +(simSpeed.value - 0.2).toFixed(1)))
const increaseSpeed = () => (simSpeed.value = Math.min(5, +(simSpeed.value + 0.2).toFixed(1)))

// Resize observer to handle responsive canvas & DPR
const handleResize = () => {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight

  // Set actual size in memory (scaled to account for extra pixel density)
  canvas.width = width * dpr
  canvas.height = height * dpr

  // Set visual display size
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  // Normalize coordinate system
  ctx.scale(dpr, dpr)
}

// Initialization
const initSimulation = () => {
  items = []
  winnerType.value = null
  isGameOver.value = false
  const itemsPerType = Math.floor(totalItems.value / 3)

  for (let i = 0; i < totalItems.value; i++) {
    items.push(createRandomItem(typeMap[Math.min(2, Math.floor(i / itemsPerType))] || 'r'))
  }

  resetChartHistory()
}

const resetSimulation = () => {
  initSimulation()
  startSimulationLoop()
  isSettingsOpen.value = false
}

const stopSimulationLoop = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const startSimulationLoop = () => {
  stopSimulationLoop()
  animationFrameId = requestAnimationFrame(update)
}

// Collision Logic
const resolveCollision = (obj1: Item, obj2: Item) => {
  // Key in rules is the winner, value is the loser
  if (obj1.type === rules[obj2.type]) {
    // obj2 is the key and if obj1.type is the value, then obj2 beats obj1
    obj1.type = obj2.type
    bounce(obj1, obj2)
  } else if (obj2.type === rules[obj1.type]) {
    // obj1 is the key and if obj2.type is the value, then obj1 beats obj2
    obj2.type = obj1.type
    bounce(obj1, obj2)
  }
}

const bounce = (obj1: Item, obj2: Item) => {
  obj1.dx = (Math.random() * 2 - 1) * speedWeight
  obj1.dy = (Math.random() * 2 - 1) * speedWeight
  obj2.dx = (Math.random() * 2 - 1) * speedWeight
  obj2.dy = (Math.random() * 2 - 1) * speedWeight
}

// Main Game Loop
const update = () => {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = window.innerWidth
  const height = window.innerHeight

  // Clear Canvas
  ctx.clearRect(0, 0, width, height)

  // Background
  ctx.fillStyle = palette.value.canvasBg
  ctx.fillRect(0, 0, width, height)

  ctx.font = `${itemSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Update positions and resolve collisions
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue

    // Apply simulation speed multiplier
    item.x += item.dx * simSpeed.value
    item.y += item.dy * simSpeed.value

    // Boundary Checks
    if (item.x + itemSize / 2 > width) {
      item.x = width - itemSize / 2
      item.dx = -Math.abs(item.dx)
    } else if (item.x - itemSize / 2 < 0) {
      item.x = itemSize / 2
      item.dx = Math.abs(item.dx)
    }

    if (item.y + itemSize / 2 > height) {
      item.y = height - itemSize / 2
      item.dy = -Math.abs(item.dy)
    } else if (item.y - itemSize / 2 < 0) {
      item.y = itemSize / 2
      item.dy = Math.abs(item.dy)
    }

    // Check Collisions (naive O(n^2) approach for simplicity, fine for < 500 items)
    for (let j = i + 1; j < items.length; j++) {
      const other = items[j]
      if (!other) continue
      const dist = Math.hypot(item.x - other.x, item.y - other.y)
      if (dist < itemSize * 0.8) {
        // 0.8 adds a slight overlap tolerance before converting
        resolveCollision(item, other)
      }
    }
  }

  // Count and draw from final state after collisions
  const counts = getCurrentCounts()
  for (const item of items) {
    ctx.fillText(itemCoding[item.type], item.x, item.y)
  }

  // Update Chart Periodically
  updateCalls++
  if (updateCalls % 30 === 0 && chartInstance) {
    pushChartSnapshot(counts)

    chartInstance.update('none') // Update without animation for performance
  }

  const aliveTypes = (Object.keys(counts) as ItemType[]).filter((type) => counts[type] > 0)
  if (aliveTypes.length <= 1) {
    winnerType.value = aliveTypes[0] || null
    isGameOver.value = true
    stopSimulationLoop()
    return
  }

  animationFrameId = requestAnimationFrame(update)
}

// Chart Initialization
const initChart = (): Chart | null => {
  if (!chartCanvasRef.value) return null

  chartInstance = new Chart(chartCanvasRef.value, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Sten 🪨', data: rockData, borderColor: '#6c757d', tension: 0.3, pointRadius: 0 },
        {
          label: 'Papper 📜',
          data: paperData,
          borderColor: '#198754',
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Sax ✂️',
          data: scissorData,
          borderColor: '#dc3545',
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: palette.value.chartText,
          },
        },
      },
      scales: {
        x: {
          display: false,
          ticks: {
            color: palette.value.chartText,
          },
          grid: {
            color: palette.value.chartGrid,
          },
        },
        y: {
          min: 0,
          max: totalItems.value,
          ticks: {
            color: palette.value.chartText,
          },
          grid: {
            color: palette.value.chartGrid,
          },
        },
      },
    },
  })

  applyChartDataBindings()
  return chartInstance
}

watch(totalItems, (newVal) => {
  syncTotalItems(newVal)

  const counts = getCurrentCounts()
  resetChartHistory()
  pushChartSnapshot(counts)

  if (chartInstance && chartInstance.options.scales?.y) {
    chartInstance.options.scales.y.max = items.length
    chartInstance.update('none')
  }

  const aliveTypes = (Object.keys(counts) as ItemType[]).filter((type) => counts[type] > 0)
  if (isGameOver.value && aliveTypes.length > 1) {
    isGameOver.value = false
    winnerType.value = null
    startSimulationLoop()
  }
})

watch(
  () => themeStore.currentTheme(),
  () => {
    updateThemePalette()
  },
)

// Lifecycle
onMounted(() => {
  themeStore.init()
  window.addEventListener('resize', handleResize)
  updateThemePalette()
  handleResize()
  initSimulation()
  initChart()
  startSimulationLoop()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopSimulationLoop()
  if (chartInstance) chartInstance.destroy()
})
</script>

<style scoped lang="scss">
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--theme-bg-primary);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.main-canvas {
  display: block;
}

/* UI Bar overlay at bottom center */
.ui-bar {
  position: absolute;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: color-mix(in srgb, var(--theme-bg-secondary) 85%, transparent);
  backdrop-filter: blur(10px);
  border-radius: 50px;
  box-shadow: var(--theme-shadow-md);
  z-index: 10;
}

.divider {
  width: 2px;
  height: 24px;
  background: var(--theme-border-light);
  margin: 0 8px;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font-weight: 600;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.95);
  }
}

.main-btn {
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;

  &:hover {
    background: var(--theme-button-primary-hover);
  }
}

.icon-btn {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-light);
  color: var(--theme-text-primary);

  &:hover {
    background: var(--theme-bg-elevated);
  }
}

/* Modals / Overlays */
.overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--theme-bg-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.overlay-modal {
  background: var(--theme-modal-bg);
  color: var(--theme-modal-text);
  padding: 30px;
  border-radius: 16px;
  box-shadow: var(--theme-shadow-lg);
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  h2 {
    margin: 0;
    font-size: 20px;
    color: var(--theme-modal-text);
    text-align: center;
  }
}

.chart-modal {
  max-width: 600px;
}

.winner-modal {
  max-width: 420px;
}

.winner-text {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--theme-text-primary);
}

.chart-container {
  height: 300px;
  position: relative;
  width: 100%;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text-secondary);
  }

  input[type='range'] {
    width: 100%;
    cursor: pointer;
  }
}

.action-btn {
  background: var(--theme-button-success-bg);
  color: var(--theme-text-on-dark);
  padding: 12px;
  border-radius: 8px;
  font-size: 16px;
  margin-top: 10px;

  &:hover {
    background: var(--theme-button-success-hover);
  }
}

.close-btn {
  background: var(--theme-button-secondary-bg);
  color: var(--theme-button-secondary-text);
  padding: 12px;
  border-radius: 8px;
  font-size: 16px;

  &:hover {
    background: var(--theme-button-secondary-hover);
  }
}
</style>
