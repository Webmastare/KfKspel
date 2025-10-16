<template>
  <div id="app-container">
    <h1 class="game-header">Kan du måla en perfekt cirkel?</h1>
    <h3 class="subtitle"></h3>
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
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <span>{{ roundnessScore !== null ? roundnessScore.toFixed(2) : '--.--' }}%</span>
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

/** Toggle between free and center draw modes */
function toggleDrawMode() {
  drawMode.value = drawMode.value === 'free' ? 'center' : 'free'
  errorMessage.value = null
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

/** Check if the circle is approximately closed (80% or more) */
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

  // Circle is considered closed if the closure distance is less than 20% of the radius
  // or less than 5 times the average segment distance
  const closureThreshold = Math.min(avgRadius * 0.2, avgSegmentDistance * 5)

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
  const coords = getCoordinates(event)
  if (coords) {
    circleDots.value.push(coords)
  }
}

function stopDrawing() {
  if (!ctx.value) return
  isDrawing.value = false

  // Check if the circle is almost closed (80% or more)
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
        errorMessage.value = 'Fel riktning! Rita i samma riktning hela tiden.'
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

  // Draw lines with color coding based on point quality
  ctx.value.lineWidth = 2
  circleDots.value.forEach((dot, index) => {
    if (index === 0) {
      ctx.value?.moveTo(dot.x, dot.y)
    } else {
      const prevDot = circleDots.value[index - 1]
      if (prevDot) {
        ctx.value?.beginPath()
        ctx.value?.moveTo(prevDot.x, prevDot.y)
        ctx.value?.lineTo(dot.x, dot.y)

        // Color based on point quality (green = good, red = bad deviation)
        const quality = pointQualities[index] || 0.5
        const red = Math.round(255 * (1 - quality))
        const green = Math.round(255 * quality)
        ctx.value!.strokeStyle = `rgb(${red}, ${green}, 0)`
        ctx.value?.stroke()
      }
    }
  })

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
  // Perfect circle = all points equidistant from center and no variation
  const distances = circleDots.value.map((dot) => {
    if (!center.value) return 0
    return Math.hypot(dot.x - center.value.x, dot.y - center.value.y)
  })
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length
  const variance =
    distances.reduce((sum, dist) => sum + (dist - avgDistance) ** 2, 0) / distances.length
  const stddev = Math.sqrt(variance)
  const score = Math.max(0, 100 - (stddev / avgDistance) * 100)
  roundnessScore.value = Math.round(score * 100) / 100
  radius.value = Math.round(avgDistance * 100) / 100
}

function calculateCentroidRoundness() {
  if (circleDots.value.length < 3) {
    roundnessScore.value = null
    centroid.value = null
    radius.value = null
    return
  }
  // Perfect circle = all points equidistant from center and no variation
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

  // Standard deviation of the radii. A smaller deviation => points are more uniformly distant from the center.
  const deviation = Math.sqrt(
    radii.map((r) => (r - radius.value!) ** 2).reduce((sum, r) => sum + r, 0) / radii.length,
  )

  // 100% if deviation is 0, and decreases as the ratio of deviation to average radius increases.
  const newScore = Math.max(0, 100 * (1 - deviation / radius.value))
  roundnessScore.value = Math.round(newScore * 100) / 100 // Round to 2 decimals
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
  margin-bottom: 0rem;
}
.subtitle {
  text-align: center;
  margin-bottom: 1rem;
  font-weight: 400;
  font-size: 1.2rem;
  color: var(--theme-text-secondary);
}

.info-panel {
  text-align: center;
  margin-bottom: 1rem;

  .draw-mode-toggle {
    margin: 0.5rem 0;

    label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
    }

    input[type='checkbox'] {
      width: 1.2rem;
      height: 1.2rem;
      cursor: pointer;
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

  span {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -100%);
    font-size: 1.2rem;
    font-weight: 600;
    pointer-events: none;
    user-select: none;
    z-index: 10;
  }

  .error-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%);
    color: #ff4444;
    font-weight: 600;
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
    border: 1px solid rgba(255, 68, 68, 0.3);
  }

  .game-canvas {
    border: 2px solid var(--theme-border);
    width: 100%;
    height: 100%;
  }
}
</style>
