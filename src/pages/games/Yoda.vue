<template>
  <div class="game-container">
    <div class="stats">
      <p>{{ points }} | {{ velocity.toFixed(2) }} varv/s</p>
    </div>

    <div class="spinner-wrapper" @pointerdown="handleClick" @contextmenu.prevent>
      <div class="spinner-object" :style="{ transform: `rotate(${rotation}deg)` }">
        <img
          class="spinner-image"
          src="/assets/yoda/yoda.png"
          alt="Spinning Yoda"
          draggable="false"
        />
      </div>
    </div>

    <div class="instructions">Klicka på Yoda eller tryck mellanslag sa snabbt du kan!</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
themeStore.init()

const rotation = ref(0)
const velocity = ref(0)
const points = ref(0)

const ROTATION_HALF_LIFE_MS = 5000
const DECAY_RATE_PER_MS = -Math.log(2) / ROTATION_HALF_LIFE_MS
const TARGET_STABILITY_TURNS_PER_SEC = 4
const BASE_SPEED_DEG_PER_MS = 0.006

const MIN_INPUT_INTERVAL_MS = 1000 / 12
const CLICK_ANGLE_BONUS_DEG = 1
const CLICK_SPEED_BONUS_DEG_PER_MS = 0.008
const CLICK_STABILITY_MULTIPLIER = Math.exp(
  (-DECAY_RATE_PER_MS * 1000) / TARGET_STABILITY_TURNS_PER_SEC,
)

const SPRING_STIFFNESS_SQRT_PER_MS = 0.001
const SPRING_GRACE_MS = 200
const MIN_REVERSE_SPEED_DEG_PER_MS = (-0.11 * 360) / 1000
const RIGHT_CLICK_BRAKE_DEG_PER_MS = 0.001
const SPACEBAR_REPEAT_MS = 250

type SpinSnapshot = {
  timeMs: number
  angleDeg: number
  speedDegPerMs: number
  turns: number
  springOffsetDeg: number
}

let animationFrame: number | null = null
let isSpacebarHeld = false
let spacebarHoldInterval: ReturnType<typeof setInterval> | null = null

let anchor: SpinSnapshot = {
  timeMs: 0,
  angleDeg: 0,
  speedDegPerMs: BASE_SPEED_DEG_PER_MS,
  turns: 0,
  springOffsetDeg: 0,
}

const normalizeAngle = (angleDeg: number) => ((angleDeg % 360) + 360) % 360

const turnsFromAbsoluteAngle = (angleDeg: number) =>
  angleDeg >= 0 ? Math.floor(angleDeg / 360) : -Math.floor(-angleDeg / 360)

const integrateDecayToBaseline = (dtMs: number, startSpeedDegPerMs: number) => {
  const startSpeedNoBaseline = startSpeedDegPerMs - BASE_SPEED_DEG_PER_MS
  const expTerm = Math.exp(DECAY_RATE_PER_MS * dtMs)
  const endSpeedNoBaseline = expTerm * startSpeedNoBaseline
  const endSpeedDegPerMs = endSpeedNoBaseline + BASE_SPEED_DEG_PER_MS
  const deltaNoBaselineDeg = (startSpeedNoBaseline / DECAY_RATE_PER_MS) * (expTerm - 1)
  const deltaDeg = deltaNoBaselineDeg + dtMs * BASE_SPEED_DEG_PER_MS

  return { deltaDeg, endSpeedDegPerMs }
}

const integrateSpringRecovery = (
  dtMs: number,
  startSpeedDegPerMs: number,
  startOffsetDeg: number,
) => {
  if (dtMs <= SPRING_GRACE_MS) {
    const deltaDeg = startSpeedDegPerMs * dtMs
    return {
      deltaDeg,
      endSpeedDegPerMs: startSpeedDegPerMs,
      endOffsetDeg: startOffsetDeg + deltaDeg,
    }
  }

  const graceDeltaDeg = startSpeedDegPerMs * SPRING_GRACE_MS
  const remainingDtMs = dtMs - SPRING_GRACE_MS
  const offsetAtSpringStartDeg = startOffsetDeg + graceDeltaDeg

  if (Math.abs(offsetAtSpringStartDeg) < 1e-9) {
    const res = integrateDecayToBaseline(remainingDtMs, startSpeedDegPerMs)
    return {
      deltaDeg: graceDeltaDeg + res.deltaDeg,
      endSpeedDegPerMs: res.endSpeedDegPerMs,
      endOffsetDeg: 0,
    }
  }

  const phase = Math.atan(
    -startSpeedDegPerMs / SPRING_STIFFNESS_SQRT_PER_MS / offsetAtSpringStartDeg,
  )
  const amplitude = offsetAtSpringStartDeg / Math.cos(phase)
  const msUntilSpringRelease = (Math.PI / 2 - phase) / SPRING_STIFFNESS_SQRT_PER_MS

  if (msUntilSpringRelease < remainingDtMs) {
    const decayFromSpringExit = integrateDecayToBaseline(
      remainingDtMs - msUntilSpringRelease,
      -SPRING_STIFFNESS_SQRT_PER_MS * amplitude,
    )
    return {
      deltaDeg: graceDeltaDeg - offsetAtSpringStartDeg + decayFromSpringExit.deltaDeg,
      endSpeedDegPerMs: decayFromSpringExit.endSpeedDegPerMs,
      endOffsetDeg: 0,
    }
  }

  const endOffsetDeg = amplitude * Math.cos(SPRING_STIFFNESS_SQRT_PER_MS * remainingDtMs + phase)
  const endSpeedDegPerMs =
    -SPRING_STIFFNESS_SQRT_PER_MS *
    amplitude *
    Math.sin(SPRING_STIFFNESS_SQRT_PER_MS * remainingDtMs + phase)

  return {
    deltaDeg: graceDeltaDeg + endOffsetDeg - offsetAtSpringStartDeg,
    endSpeedDegPerMs,
    endOffsetDeg,
  }
}

const sampleSpin = (nowMs: number): SpinSnapshot => {
  const elapsedMs = Math.max(0, nowMs - anchor.timeMs)

  const integrated =
    anchor.springOffsetDeg < 0 || anchor.speedDegPerMs < 0
      ? integrateSpringRecovery(elapsedMs, anchor.speedDegPerMs, anchor.springOffsetDeg)
      : {
          ...integrateDecayToBaseline(elapsedMs, anchor.speedDegPerMs),
          endOffsetDeg: 0,
        }

  const absoluteAngleDeg = anchor.angleDeg + integrated.deltaDeg
  const turns = anchor.turns + turnsFromAbsoluteAngle(absoluteAngleDeg)

  return {
    timeMs: nowMs,
    angleDeg: normalizeAngle(absoluteAngleDeg),
    speedDegPerMs: integrated.endSpeedDegPerMs,
    turns,
    springOffsetDeg: integrated.endOffsetDeg,
  }
}

const publish = (snapshot: SpinSnapshot) => {
  rotation.value = snapshot.angleDeg
  velocity.value = (snapshot.speedDegPerMs * 1000) / 360
  points.value = snapshot.turns
}

const applyInput = (isReverse: boolean) => {
  const nowMs = performance.now()
  const current = sampleSpin(nowMs)
  publish(current)

  if (nowMs - anchor.timeMs < MIN_INPUT_INTERVAL_MS) {
    return
  }

  anchor = {
    timeMs: nowMs,
    angleDeg: isReverse ? current.angleDeg : current.angleDeg + CLICK_ANGLE_BONUS_DEG,
    speedDegPerMs: isReverse
      ? Math.max(current.speedDegPerMs - RIGHT_CLICK_BRAKE_DEG_PER_MS, MIN_REVERSE_SPEED_DEG_PER_MS)
      : (current.speedDegPerMs + CLICK_SPEED_BONUS_DEG_PER_MS) * CLICK_STABILITY_MULTIPLIER,
    turns: current.turns,
    springOffsetDeg: current.springOffsetDeg,
  }

  publish(sampleSpin(nowMs))
}

const handleClick = (event: PointerEvent) => {
  if (event.pointerType === 'mouse' && event.button === 2) {
    event.preventDefault()
    applyInput(true)
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) return
  applyInput(false)
}

const stopSpacebarHold = () => {
  isSpacebarHeld = false
  if (spacebarHoldInterval !== null) {
    clearInterval(spacebarHoldInterval)
    spacebarHoldInterval = null
  }
}

const isEditableTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  const tagName = el?.tagName

  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    Boolean(el?.isContentEditable)
  )
}

const handleSpacebarDown = (event: KeyboardEvent) => {
  if (event.code !== 'Space') return
  if (isEditableTarget(event.target)) return

  event.preventDefault()
  if (isSpacebarHeld) return

  isSpacebarHeld = true
  applyInput(false)
  spacebarHoldInterval = setInterval(() => {
    applyInput(false)
  }, SPACEBAR_REPEAT_MS)
}

const handleSpacebarUp = (event: KeyboardEvent) => {
  if (event.code !== 'Space') return
  stopSpacebarHold()
}

const tick = (timestamp: number) => {
  publish(sampleSpin(timestamp))
  animationFrame = requestAnimationFrame(tick)
}

onMounted(() => {
  const nowMs = performance.now()
  anchor = {
    timeMs: nowMs,
    angleDeg: 0,
    speedDegPerMs: BASE_SPEED_DEG_PER_MS,
    turns: 0,
    springOffsetDeg: 0,
  }

  publish(sampleSpin(nowMs))
  animationFrame = requestAnimationFrame(tick)
  window.addEventListener('keydown', handleSpacebarDown)
  window.addEventListener('keyup', handleSpacebarUp)
  window.addEventListener('blur', stopSpacebarHold)
})

onUnmounted(() => {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
  }

  stopSpacebarHold()
  window.removeEventListener('keydown', handleSpacebarDown)
  window.removeEventListener('keyup', handleSpacebarUp)
  window.removeEventListener('blur', stopSpacebarHold)
})
</script>

<style lang="scss" scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
  background:
    radial-gradient(circle at 15% 15%, rgba(45, 207, 105, 0.14), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(12, 141, 59, 0.18), transparent 50%),
    var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
  user-select: none;
  overflow: hidden;
}

.stats {
  text-align: center;
  margin-bottom: 2rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  p {
    font-size: clamp(1rem, 4vw, 1.5rem);
    color: var(--theme-text-secondary);
    margin-top: 0px;
  }
}

.spinner-wrapper {
  cursor: pointer;
  padding: clamp(0.8rem, 3vw, 2rem);
  border-radius: 999px;
  touch-action: manipulation;
  transition: transform 0.1s ease;

  &:active .spinner-object {
    filter: brightness(1.08);
  }

  &:active {
    transform: scale(0.985);
  }
}

.spinner-object {
  width: min(78vw, 520px);
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  will-change: transform;
}

.spinner-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 20px 26px rgba(0, 0, 0, 0.35));
}

.instructions {
  margin-top: 3rem;
  color: var(--theme-text-secondary);
  opacity: 0.85;
  font-style: italic;
  text-align: center;
}

@media (max-width: 600px) {
  .stats {
    margin-bottom: 1.4rem;
  }

  .instructions {
    margin-top: 1.6rem;
  }
}
</style>
