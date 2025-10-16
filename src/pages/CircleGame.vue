<template>
  <div id="app-container">
    <h1 class="game-header">Kan du måla en perfekt cirkel?</h1>
    <div class="score-display">
      <div class="current-score">
        <span class="score-label">Nuvarande:</span>
        <span class="score-value"
          >{{ roundnessScore !== null ? roundnessScore.toFixed(2) : '--.--' }}%</span
        >
      </div>
      <div class="best-score">
        <span class="score-label">Bästa:</span>
        <span class="score-value">{{ bestScore.toFixed(2) }}%</span>
      </div>
    </div>
    <div class="info-panel">
      <div class="draw-mode-toggle">
        <label for="drawModeCheckbox">
          <input
            id="drawModeCheckbox"
            type="checkbox"
            :checked="drawMode === 'center'"
            @change="toggleDrawMode"
          />
          Använd centrumläge
        </label>
      </div>
    </div>
    <div class="game-container">
      <canvas
        ref="canvasRef"
        class="game-canvas"
        @mousedown="startDrawing"
        @mousemove="onMove"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        @touchstart.prevent="startDrawing"
        @touchmove.prevent="onMove"
        @touchend.prevent="stopDrawing"
      ></canvas>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      <div v-if="newBestScore" class="new-best-message">Nytt rekord!</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const dpr = ref(window.devicePixelRatio || 1)

interface Point {
  x: number
  y: number
}

const drawMode = ref<'free' | 'center'>('center')
const isDrawing = ref(false)
const circleDots = ref<Array<Point>>([])
const roundnessScore = ref<number | null>(null)
const centroid = ref<Point | null>(null)
const center = ref<Point | null>(null)
const radius = ref<number | null>(null)
const errorMessage = ref<string | null>(null)
const drawingDirection = ref<'clockwise' | 'counterclockwise' | null>(null)
const directionViolations = ref(0)
const bestScore = ref<number>(0)
const newBestScore = ref(false)
const directionError = ref(false)

/** Load best score from localStorage */
function loadBestScore() {
  const saved = localStorage.getItem('circleGameBestScore')
  if (saved) {
    bestScore.value = parseFloat(saved)
  }
}

/** Save best score to localStorage */
function saveBestScore(score: number) {
  localStorage.setItem('circleGameBestScore', score.toString())
  bestScore.value = score
}

/** Check if current score is a new best */
function checkNewBest(score: number) {
  if (score > bestScore.value) {
    saveBestScore(score)
    newBestScore.value = true
    setTimeout(() => {
      newBestScore.value = false
    }, 3000) // Hide message after 3 seconds
  }
}

/** Toggle between free and center draw modes */
function toggleDrawMode() {
  drawMode.value = drawMode.value === 'free' ? 'center' : 'free'
  errorMessage.value = null
  directionError.value = false
}

/** Calculate angular momentum to determine drawing direction */
function calculateAngularMomentum(): number {
  if (circleDots.value.length < 10) return 0

  // Get the center point based on current mode
  const centerPoint =
    drawMode.value === 'center'
      ? center.value
      : circleDots.value.length > 5
        ? calculateCurrentCentroid()
        : center.value

  if (!centerPoint) return 0

  let totalAngularMomentum = 0
  const recentPoints = circleDots.value.slice(-8) // Use last 8 points

  for (let i = 1; i < recentPoints.length; i++) {
    const prev = recentPoints[i - 1]
    const curr = recentPoints[i]

    if (prev && curr) {
      // Calculate vectors from center to points
      const r1 = { x: prev.x - centerPoint.x, y: prev.y - centerPoint.y }
      const r2 = { x: curr.x - centerPoint.x, y: curr.y - centerPoint.y }

      // Skip if points are too close to center (avoid division by small numbers)
      const dist1 = Math.hypot(r1.x, r1.y)
      const dist2 = Math.hypot(r2.x, r2.y)

      if (dist1 > 10 && dist2 > 10) {
        // Calculate cross product (z-component of r1 × r2)
        // This gives us the angular momentum contribution
        const crossProduct = r1.x * r2.y - r1.y * r2.x
        totalAngularMomentum += crossProduct
      }
    }
  }

  return totalAngularMomentum
}

/** Calculate current centroid for direction checking */
function calculateCurrentCentroid(): Point {
  const sum = circleDots.value.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  })
  return {
    x: sum.x / circleDots.value.length,
    y: sum.y / circleDots.value.length,
  }
}

/** Check if the current drawing direction is consistent */
function validateDrawingDirection(): boolean {
  if (circleDots.value.length < 10) return true

  const angularMomentum = calculateAngularMomentum()

  // Determine direction from angular momentum
  // Positive = counterclockwise, Negative = clockwise
  const currentDirection = angularMomentum > 0 ? 'counterclockwise' : 'clockwise'

  // If this is the first time determining direction
  if (drawingDirection.value === null && Math.abs(angularMomentum) > 1000) {
    drawingDirection.value = currentDirection
    return true
  }

  // If we have an established direction, check for violations
  if (drawingDirection.value !== null && Math.abs(angularMomentum) > 500) {
    const isConsistent = drawingDirection.value === currentDirection

    if (!isConsistent) {
      directionViolations.value++

      // Allow 2 direction violations before stopping
      if (directionViolations.value >= 2) {
        directionError.value = true
        return false
      }
    } else {
      // Reset violations if direction is consistent
      directionViolations.value = Math.max(0, directionViolations.value - 1)
    }
  }

  return true
}

/** Calculate quality score for each point (0 = bad, 1 = good) */
function calculatePointQualities(centerPoint: Point | null): number[] {
  if (!centerPoint || circleDots.value.length < 3) {
    return circleDots.value.map(() => 0.5)
  }

  // Calculate distances from center for all points
  const distances = circleDots.value.map((point) =>
    Math.hypot(point.x - centerPoint.x, point.y - centerPoint.y),
  )

  // Calculate average radius
  const avgRadius = distances.reduce((sum, dist) => sum + dist, 0) / distances.length

  // Calculate standard deviation
  const variance =
    distances.reduce((sum, dist) => sum + (dist - avgRadius) ** 2, 0) / distances.length
  const stddev = Math.sqrt(variance)

  // Normalize each point's quality based on how close it is to the average radius
  return distances.map((distance) => {
    const deviation = Math.abs(distance - avgRadius)
    const normalizedDeviation = stddev > 0 ? deviation / stddev : 0
    // Quality ranges from 0 (bad) to 1 (good)
    return Math.max(0, Math.min(1, 1 - normalizedDeviation / 2))
  })
}

/** Check if the circle is closed */
function checkCircleClosure(): boolean {
  if (circleDots.value.length < 10) return false

  const firstPoint = circleDots.value[0]
  const lastPoint = circleDots.value[circleDots.value.length - 1]

  if (!firstPoint || !lastPoint) return false

  // Calculate the distance between first and last point
  const closureDistance = Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y)

  // Calculate average distance between consecutive points to get a sense of scale
  let totalDistance = 0
  for (let i = 1; i < circleDots.value.length; i++) {
    const prev = circleDots.value[i - 1]
    const curr = circleDots.value[i]
    if (prev && curr) {
      totalDistance += Math.hypot(curr.x - prev.x, curr.y - prev.y)
    }
  }
  const avgSegmentDistance = totalDistance / (circleDots.value.length - 1)

  // Also calculate approximate radius to scale the closure threshold
  const centerPoint = drawMode.value === 'center' ? center.value : centroid.value
  if (!centerPoint) return false

  const avgRadius =
    circleDots.value.reduce((sum, point) => {
      return sum + Math.hypot(point.x - centerPoint.x, point.y - centerPoint.y)
    }, 0) / circleDots.value.length

  // Circle is considered closed if the closure distance is less than 50% of the radius
  // or less than 5 times the average segment distance
  const closureThreshold = Math.min(avgRadius * 0.5, avgSegmentDistance * 5)

  return closureDistance <= closureThreshold
}

/** Gets the correct coordinates for both mouse and touch events */
function getCoordinates(event: MouseEvent | TouchEvent): Point | null {
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    if (event instanceof MouseEvent) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    } else if (event.touches && event.touches.length > 0) {
      return { x: event.touches[0]!.clientX - rect.left, y: event.touches[0]!.clientY - rect.top }
    }
  }
  return null
}

function startDrawing(event: MouseEvent | TouchEvent) {
  if (!ctx.value || !canvasRef.value) return
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  isDrawing.value = true
  circleDots.value = []
  drawingDirection.value = null
  directionViolations.value = 0
  errorMessage.value = null
  directionError.value = false
  newBestScore.value = false
  const coords = getCoordinates(event)
  if (coords) {
    circleDots.value.push(coords)
  }
}

function stopDrawing() {
  if (!ctx.value) return
  isDrawing.value = false

  // If there was a direction error, don't overwrite the error message
  if (directionError.value) {
    errorMessage.value = 'Fel riktning! Rita i samma riktning hela tiden.'
    roundnessScore.value = null
    return
  }

  // Check if the circle is almost closed
  if (circleDots.value.length < 10) {
    errorMessage.value = 'Rita mer för att skapa en cirkel'
    return
  }

  const isCircleClosed = checkCircleClosure()
  if (!isCircleClosed) {
    errorMessage.value = 'Cirkel inte sluten'
    roundnessScore.value = null
    return
  }

  errorMessage.value = null
  // Circle is valid, calculate final score
  if (drawMode.value === 'free') {
    calculateCentroidRoundness()
  } else {
    calculateCenterRoundness()
  }

  // Check for new best score
  if (roundnessScore.value !== null) {
    checkNewBest(roundnessScore.value)
  }
}

function onMove(event: MouseEvent | TouchEvent) {
  if (!isDrawing.value) return
  draw(event)
}

function draw(event: MouseEvent | TouchEvent) {
  if (!ctx.value || !canvasRef.value) return
  if (!isDrawing.value || !ctx.value) return

  const coords = getCoordinates(event)
  if (coords) {
    // Check if the new point is far enough from the last point to avoid noise
    const lastPoint = circleDots.value[circleDots.value.length - 1]
    if (!lastPoint || Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y) > 3) {
      circleDots.value.push(coords)

      // Validate drawing direction
      if (!validateDrawingDirection()) {
        stopDrawing()
        return
      }
    }
  }
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  // Calculate roundness first to get point quality data
  let pointQualities: number[] = []
  if (drawMode.value === 'free') {
    calculateCentroidRoundness()
    pointQualities = calculatePointQualities(centroid.value)
  } else if (drawMode.value === 'center') {
    calculateCenterRoundness()
    pointQualities = calculatePointQualities(center.value)
  }

  // Draw smooth curves with color coding based on point quality
  ctx.value.lineWidth = 4
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'

  if (circleDots.value.length > 2) {
    for (let i = 1; i < circleDots.value.length - 1; i++) {
      const prevDot = circleDots.value[i - 1]
      const currDot = circleDots.value[i]
      const nextDot = circleDots.value[i + 1]

      if (prevDot && currDot && nextDot) {
        ctx.value.beginPath()

        // Color based on point quality (green = good, red = bad deviation)
        const quality = pointQualities[i] || 0.5
        const red = Math.round(255 * (1 - quality))
        const green = Math.round(255 * quality)
        ctx.value.strokeStyle = `rgb(${red}, ${green}, 0)`

        // Create smooth curve using quadratic curves
        const cp1x = prevDot.x + (currDot.x - prevDot.x) * 0.5
        const cp1y = prevDot.y + (currDot.y - prevDot.y) * 0.5
        const cp2x = currDot.x + (nextDot.x - currDot.x) * 0.5
        const cp2y = currDot.y + (nextDot.y - currDot.y) * 0.5

        ctx.value.moveTo(cp1x, cp1y)
        ctx.value.quadraticCurveTo(currDot.x, currDot.y, cp2x, cp2y)
        ctx.value.stroke()
      }
    }

    // Draw first and last segments as simple lines
    if (circleDots.value.length >= 2) {
      const first = circleDots.value[0]
      const second = circleDots.value[1]
      if (first && second) {
        ctx.value.beginPath()
        const quality = pointQualities[1] || 0.5
        const red = Math.round(255 * (1 - quality))
        const green = Math.round(255 * quality)
        ctx.value.strokeStyle = `rgb(${red}, ${green}, 0)`
        ctx.value.moveTo(first.x, first.y)
        ctx.value.lineTo(second.x, second.y)
        ctx.value.stroke()
      }

      const secondLast = circleDots.value[circleDots.value.length - 2]
      const last = circleDots.value[circleDots.value.length - 1]
      if (secondLast && last) {
        ctx.value.beginPath()
        const quality = pointQualities[circleDots.value.length - 1] || 0.5
        const red = Math.round(255 * (1 - quality))
        const green = Math.round(255 * quality)
        ctx.value.strokeStyle = `rgb(${red}, ${green}, 0)`
        ctx.value.moveTo(secondLast.x, secondLast.y)
        ctx.value.lineTo(last.x, last.y)
        ctx.value.stroke()
      }
    }
  }

  // Draw center point if available
  if (drawMode.value === 'free') {
    if (centroid.value) {
      ctx.value.beginPath()
      ctx.value.arc(centroid.value.x, centroid.value.y, 5, 0, Math.PI * 2)
      ctx.value.fillStyle = 'red'
      ctx.value.fill()
    }
  } else if (drawMode.value === 'center') {
    if (center.value) {
      ctx.value.beginPath()
      ctx.value.arc(center.value.x, center.value.y, 5, 0, Math.PI * 2)
      ctx.value.fillStyle = 'red'
      ctx.value.fill()
    }
  }
}

function calculateCenterRoundness() {
  if (circleDots.value.length < 3) {
    roundnessScore.value = null
    radius.value = null
    return
  }

  const distances = circleDots.value.map((dot) => {
    if (!center.value) return 0
    return Math.hypot(dot.x - center.value.x, dot.y - center.value.y)
  })

  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length
  radius.value = Math.round(avgDistance * 100) / 100

  // Calculate coefficient of variation
  const variance =
    distances.reduce((sum, dist) => sum + (dist - avgDistance) ** 2, 0) / distances.length
  const stddev = Math.sqrt(variance)
  const coefficientOfVariation = stddev / avgDistance

  // Perfect circle CV = 0
  let score = Math.max(0, 100 * Math.exp(-coefficientOfVariation))

  // Additional penalty for angular irregularities
  const angularPenalty = calculateAngularPenalty()
  score *= 1 - angularPenalty

  roundnessScore.value = Math.round(score * 100) / 100
}

/** Calculate penalty for angular irregularities */
function calculateAngularPenalty(): number {
  if (circleDots.value.length < 6) return 0

  const centerPoint = drawMode.value === 'center' ? center.value : centroid.value
  if (!centerPoint) return 0

  // Calculate angles from center to each point
  const angles = circleDots.value.map((point) =>
    Math.atan2(point.y - centerPoint.y, point.x - centerPoint.x),
  )

  // Calculate expected angular spacing for uniform distribution
  const expectedSpacing = (2 * Math.PI) / angles.length

  // Calculate actual angular differences
  let totalAngularDeviation = 0
  for (let i = 1; i < angles.length; i++) {
    const currentAngle = angles[i]
    const prevAngle = angles[i - 1]
    if (currentAngle !== undefined && prevAngle !== undefined) {
      let diff = currentAngle - prevAngle
      // Normalize angle difference to [-π, π]
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI

      const deviation = Math.abs(Math.abs(diff) - expectedSpacing)
      totalAngularDeviation += deviation
    }
  }

  // Normalize penalty (0 = perfect, 1 = very bad)
  const averageDeviation = totalAngularDeviation / (angles.length - 1)
  return Math.min(1, averageDeviation / expectedSpacing)
}

function calculateCentroidRoundness() {
  if (circleDots.value.length < 3) {
    roundnessScore.value = null
    centroid.value = null
    radius.value = null
    return
  }

  // Get centroid of the drawn points
  centroid.value = circleDots.value.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  })
  centroid.value.x /= circleDots.value.length
  centroid.value.y /= circleDots.value.length

  // Calculate the radius from the center to each point
  const radii = circleDots.value.map((p) => {
    const dx = p.x - centroid.value!.x
    const dy = p.y - centroid.value!.y
    return Math.sqrt(dx * dx + dy * dy)
  })

  // Calculate avg radius
  radius.value = radii.reduce((sum, r) => sum + r, 0) / radii.length

  // Calculate coefficient of variation (CV) - more sensitive to deviations
  const variance = radii.reduce((sum, r) => sum + (r - radius.value!) ** 2, 0) / radii.length
  const stddev = Math.sqrt(variance)
  const coefficientOfVariation = stddev / radius.value!

  // Perfect circle CV = 0
  let score = Math.max(0, 100 * Math.exp(-coefficientOfVariation))

  // Additional penalty for angular irregularities
  const angularPenalty = calculateAngularPenalty()
  score *= 1 - angularPenalty

  roundnessScore.value = Math.round(score * 100) / 100
}

function resizeCanvas() {
  if (canvasRef.value) {
    dpr.value = window.devicePixelRatio || 1
    canvasRef.value.width = window.innerWidth * dpr.value
    canvasRef.value.height = 0.7 * window.innerHeight * dpr.value
    canvasRef.value.style.width = `${window.innerWidth}px`
    canvasRef.value.style.height = `${0.7 * window.innerHeight}px`
    if (ctx.value) {
      ctx.value.setTransform(dpr.value, 0, 0, dpr.value, 0, 0)
      ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
    }
    center.value = {
      x: canvasRef.value.width / 2 / dpr.value,
      y: canvasRef.value.height / 2 / dpr.value,
    }
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    ctx.value = canvas.getContext('2d')
    if (ctx.value) {
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
    }
  }
  loadBestScore()
})
</script>

<style scoped lang="scss">
@use '@/styles/generalGames.scss';

#app-container {
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: 100vh;
  padding: 20px;
}

.game-header {
  @extend .game-header;
  margin-bottom: 1rem;
}

.score-display {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;

  .current-score,
  .best-score {
    text-align: center;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    background: var(--theme-bg-secondary);
    border: 1px solid var(--theme-border);

    .score-label {
      display: block;
      font-size: 0.9rem;
      color: var(--theme-text-secondary);
      margin-bottom: 0.25rem;
    }

    .score-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--theme-text-primary);
    }
  }

  .best-score {
    .score-value {
      color: #ffd700;
    }
  }
}

.info-panel {
  text-align: center;
  margin-bottom: 1.5rem;

  .draw-mode-toggle {
    margin: 0.5rem 0;

    label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      font-size: 1rem;
      cursor: pointer;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: var(--theme-bg-secondary);
      border: 1px solid var(--theme-border);
      transition: all 0.2s ease;

      &:hover {
        background: var(--theme-bg-tertiary);
        border-color: var(--theme-border-hover, var(--theme-border));
      }
    }

    input[type='checkbox'] {
      width: 1.2rem;
      height: 1.2rem;
      cursor: pointer;
      accent-color: var(--theme-accent, #007acc);
    }
  }
}

.game-container {
  position: relative;
  width: 100%;
  max-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--theme-bg-tertiary);
  filter: brightness(0.8);
  border: 2px solid var(--theme-border);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;

  .error-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ff4444;
    font-weight: 600;
    margin: 0.5rem 0;
    padding: 0.75rem 1.5rem;
    background: rgba(255, 68, 68, 0.15);
    border-radius: 8px;
    border: 2px solid rgba(255, 68, 68, 0.4);
    font-size: 1.1rem;
    box-shadow: 0 4px 12px rgba(255, 68, 68, 0.2);
    z-index: 10;
  }

  .new-best-message {
    position: absolute;
    top: 30%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ffd700;
    font-weight: 700;
    font-size: 1.5rem;
    padding: 1rem 2rem;
    background: rgba(255, 215, 0, 0.15);
    border-radius: 12px;
    border: 2px solid rgba(255, 215, 0, 0.5);
    box-shadow: 0 6px 16px rgba(255, 215, 0, 0.3);
    z-index: 10;
    animation: celebration 0.6s ease-in-out;
  }

  @keyframes celebration {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }

  .game-canvas {
    border: 2px solid var(--theme-border);
    width: 100%;
    height: 100%;
  }
}
</style>
