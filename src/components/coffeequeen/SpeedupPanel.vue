<template>
  <div class="speed-controls">
    <div class="speed-header">
      <span class="speedup-buffer-text"
        >Buffer: {{ formatDuration(bufferCurrentSeconds) }} /
        {{ formatDuration(bufferMaxSeconds) }}</span
      >
      <button class="speed-controls-open" @click="showSpeedupModal = true">Speedup Menu</button>
    </div>
    <div class="speed-controls-buttons">
      <button
        v-for="speed in speedOptions"
        :key="`speed-${speed}`"
        :class="{ active: currentSpeed === speed }"
        :disabled="!canSelectSpeed(speed)"
        @click="emit('set-speed', speed)"
      >
        {{ speed }}x
      </button>
    </div>
  </div>

  <div v-if="showSpeedupModal" class="shop-modal-overlay" @click.self="showSpeedupModal = false">
    <div class="shop-modal speedup-modal">
      <h2>Speedup Control Center</h2>
      <button class="top-close-button" @click="showSpeedupModal = false">×</button>

      <div class="speedup-modal__section">
        <div class="speedup-buffer-panel__header">
          <span>Speedup Buffer</span>
          <span
            >{{ formatDuration(bufferCurrentSeconds) }} /
            {{ formatDuration(bufferMaxSeconds) }}</span
          >
        </div>
        <div class="speedup-buffer-panel__bar-track">
          <div class="speedup-buffer-panel__bar-fill" :style="{ width: `${bufferFillPercent}%` }" />
        </div>
        <div class="speedup-buffer-panel__stats">
          <span>Online: +1s / {{ onlineRefillIntervalSeconds.toFixed(0) }}s</span>
          <span>Offline: +1s / {{ offlineRefillIntervalSeconds.toFixed(0) }}s</span>
          <span
            >Full in: {{ secondsUntilFull <= 0 ? 'Full' : formatDuration(secondsUntilFull) }}</span
          >
        </div>
      </div>

      <div class="speedup-modal__section">
        <h3>Time Travel</h3>
        <p>Spend buffer to instantly simulate production.</p>
        <div class="speedup-modal__settings">
          <div class="speedup-modal__preset-buttons">
            <button @click="setTimeTravelMinutes(1)">1m</button>
            <button @click="setTimeTravelMinutes(5)">5m</button>
            <button @click="setTimeTravelMinutes(10)">10m</button>
            <button @click="setTimeTravelMinutes(30)">30m</button>
          </div>

          <div class="speedup-modal__travel-controls">
            <button @click="adjustTimeTravelMinutes(-1)">-1m</button>
            <input
              id="time-travel-minutes"
              v-model.number="timeTravelMinutes"
              type="number"
              min="1"
              step="1"
            />
            <button @click="adjustTimeTravelMinutes(1)">+1m</button>
          </div>

          <div class="speedup-modal__travel-info">
            <span>Selected: {{ formatDuration(timeTravelSeconds) }}</span>
            <span>Available: {{ formatDuration(bufferCurrentSeconds) }}</span>
          </div>

          <button
            class="speedup-modal__travel-submit"
            :disabled="!canConsumeTimeTravel"
            @click="consumeTimeTravel"
          >
            Time Travel Now
          </button>
        </div>
      </div>

      <button class="close-button" @click="showSpeedupModal = false">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDuration } from '@/components/coffeequeen/number-format'

interface Props {
  currentSpeed: number
  speedOptions: number[]
  bufferCurrentSeconds: number
  bufferMaxSeconds: number
  bufferFillPercent: number
  secondsUntilFull: number
  onlineRefillIntervalSeconds: number
  offlineRefillIntervalSeconds: number
}

interface Emits {
  (e: 'set-speed', speed: number): void
  (e: 'consume-time-travel', seconds: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showSpeedupModal = ref(false)
const timeTravelMinutes = ref(5)

const timeTravelSeconds = computed(() => Math.max(0, Math.floor(timeTravelMinutes.value || 0)) * 60)
const canConsumeTimeTravel = computed(
  () => timeTravelSeconds.value > 0 && props.bufferCurrentSeconds >= timeTravelSeconds.value,
)

function canSelectSpeed(speed: number) {
  if (speed <= 1) return true
  return props.bufferCurrentSeconds > 0
}

function setTimeTravelMinutes(minutes: number) {
  const newMinutes = Math.max(1, Math.floor(minutes))
  if (newMinutes * 60 > props.bufferCurrentSeconds) {
    timeTravelMinutes.value = Math.floor(props.bufferCurrentSeconds / 60)
  } else {
    timeTravelMinutes.value = newMinutes
  }
}

function adjustTimeTravelMinutes(deltaMinutes: number) {
  setTimeTravelMinutes((timeTravelMinutes.value || 1) + deltaMinutes)
}

function consumeTimeTravel() {
  if (!canConsumeTimeTravel.value) return
  emit('consume-time-travel', timeTravelSeconds.value)
  showSpeedupModal.value = false
}
</script>

<style scoped lang="scss">
.speed-controls {
  margin: 0 auto clamp(12px, 3vw, 18px);
  max-width: min(860px, 96vw);
  padding: 10px;
  border-radius: 12px;
  border: 2px solid var(--coffee-border-primary);
  background: color-mix(in srgb, var(--coffee-bg-card) 85%, transparent);
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;

  .speed-header {
    display: flex;
    gap: 10px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
  }
  .speedup-buffer-text {
    display: inline-block;
    color: var(--coffee-text-secondary);
    font-family: 'Courier New', Courier, monospace;
    font-size: 1rem;
    white-space: nowrap;
  }
}

.speed-controls-open {
  background: var(--coffee-button-bg);
  color: var(--coffee-button-text);
  border: 2px solid var(--coffee-button-border);
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  white-space: nowrap;
}

.speedup-modal__settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  align-items: center;
}

.speed-controls-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;

  button {
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    min-width: 52px;
    transition: all 0.2s ease;

    &.active {
      transform: translateY(-1px);
      box-shadow: 0 0 0 2px var(--coffee-text-secondary);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }
}

.shop-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 200;
  font-family: 'Courier New', Courier, monospace;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: clamp(10px, 3vh, 20px);
  box-sizing: border-box;
}

.shop-modal {
  position: relative;
  padding: clamp(15px, 3vh, 20px);
  border-radius: 20px;
  width: min(600px, calc(100vw - 20px));
  max-height: 80vh;
  overflow-y: auto;
  background: var(--coffee-bg-card);
  border: 1px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin: auto 0;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.168);
    border-radius: 4px;
    margin-top: 5vh;
    margin-bottom: 5vh;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--coffee-border-secondary);
    border-radius: 4px;
  }
}

h2 {
  text-align: center;
  margin-top: 0;
  margin-bottom: clamp(15px, 3vh, 20px);
  color: var(--coffee-text-secondary);
  font-size: clamp(1.2rem, 4vw, 1.5rem);
}

.top-close-button {
  position: absolute;
  top: 10px;
  right: 20px;
  background: none;
  border: none;
  color: var(--coffee-text-primary);
  font-size: clamp(1.5rem, 4vw, 2rem);
  cursor: pointer;
  padding: 0;
  width: clamp(25px, 6vw, 30px);
  height: clamp(25px, 6vw, 30px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.close-button {
  display: block;
  margin: clamp(15px, 3vh, 20px) auto 0;
  background-color: #f44336;
  border: 2px solid #d32f2f;
  color: #fff;
  width: 100%;
  max-width: 200px;
  padding: clamp(10px, 2vh, 12px) clamp(16px, 4vw, 24px);
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;

  &:hover:not(:disabled) {
    background-color: #d32f2f;
  }
}

.speedup-modal__section {
  margin-top: 14px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--coffee-border-primary);
  background: color-mix(in srgb, var(--coffee-bg-primary) 90%, transparent);

  h3 {
    margin: 0 0 6px;
    color: var(--coffee-text-secondary);
  }
  p {
    margin: 0 0 10px;
    font-size: 0.9rem;
  }
}

.speedup-buffer-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: bold;
  color: var(--coffee-text-secondary);
  margin-bottom: 8px;
}

.speedup-buffer-panel__bar-track {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

.speedup-buffer-panel__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #0b5d0b, #118011, #2cb42c);
  transition: width 0.2s ease;
}

.speedup-buffer-panel__stats {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--coffee-text-primary);
}

.speedup-modal__preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  width: 80%;

  button {
    flex: 1 1 40px;
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    border-radius: 8px;
    padding: 6px 10px;
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    cursor: pointer;
    &:hover {
      transform: translateY(-1px);
      background: var(--coffee-button-hover);
      color: var(--coffee-button-text-hover);
    }
  }
}

.speedup-modal__travel-controls {
  display: flex;
  align-items: center;
  gap: 8px;

  button,
  input {
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    border-radius: 8px;
    padding: 7px 10px;
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
  }
  button {
    cursor: pointer;
    &:hover {
      transform: translateY(-1px);
      background: var(--coffee-button-hover);
      color: var(--coffee-button-text-hover);
    }
  }

  input {
    width: 100px;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
}

.speedup-modal__travel-info {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--coffee-text-secondary);
}

.speedup-modal__travel-submit {
  margin-top: 10px;
  width: 100%;
  background: var(--coffee-button-bg);
  color: var(--coffee-button-text);
  border: 2px solid var(--coffee-button-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &:hover {
    transform: translateY(-1px);
    background: var(--coffee-button-hover);
    color: var(--coffee-button-text-hover);
  }
}

@media (max-width: 768px) {
  .speed-controls {
    padding: 12px 8px;
  }

  .speed-controls-buttons {
    width: 100%;
  }

  .shop-modal {
    width: min(500px, calc(100vw - 20px));
    border-radius: 12px;
  }
}
</style>
