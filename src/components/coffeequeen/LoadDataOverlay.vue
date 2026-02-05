<template>
  <div class="load-data-overlay" @click.self="emitClose">
    <div class="data-modal">
      <h2>Found Data in Local Storage</h2>
      <div class="data-wrapper">
        <div v-for="(item, index) in loadedData" :key="index" class="data-item">
          <p>User: {{ item.userName }}</p>
          <p>Saved at: {{ formatDate(item.lastSaved) }}</p>
          <p>Money: ${{ item.money.toFixed(2) }}</p>
          <div class="level-container">
            <svg class="level-circle" viewBox="0 0 100 100">
              <circle class="bg" cx="50" cy="50" r="45"></circle>
              <circle
                class="progress"
                cx="50"
                cy="50"
                r="45"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="progressOffset(item)"
              ></circle>
            </svg>
            <div class="level-text">{{ item.level }}</div>
          </div>

          <button @click="emitLoadData(item)">Load</button>
        </div>
      </div>
      <button class="close-button" @click="emitClose">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SavedGameData } from '@/components/coffeequeen/types'

interface Props {
  loadedData: SavedGameData[]
  storageType: string
}

interface Emits {
  (e: 'close'): void
  (e: 'loadData', key: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const circumference = 2 * Math.PI * 45

// Format date function
const formatDate = (isoString: string): string => {
  if (!isoString) return 'Unknown'

  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid date'
  }
}

const progressOffset = (user: SavedGameData): number => {
  const progress = user.experience / user.nextLevelExperience
  return circumference * (1 - progress)
}

const emitClose = (): void => {
  emit('close')
}

const emitLoadData = (item: SavedGameData): void => {
  if (item.itemKey) {
    emit('loadData', item.itemKey)
  }
}
</script>

<style scoped lang="scss">
.load-data-overlay {
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

  .data-modal {
    padding: clamp(15px, 3vh, 20px);
    border-radius: 10px;
    width: min(500px, calc(100vw - 20px));
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    background: var(--coffee-bg-card);
    border: 1px solid var(--coffee-border-primary);
    color: var(--coffee-text-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    margin: auto 0;

    h2 {
      text-align: center;
      margin-top: 0;
      margin-bottom: clamp(15px, 3vh, 20px);
      font-size: clamp(1.2rem, 4vw, 1.5rem);
    }
  }

  .data-wrapper {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2vh, 10px);
    align-items: center;
    justify-content: center;
    padding: clamp(15px, 3vh, 20px);
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    background: var(--coffee-bg-primary);
    color: var(--coffee-text-primary);

    .data-item {
      position: relative;
      display: flex;
      align-items: start;
      justify-content: center;
      flex-direction: column;
      width: 100%;
      padding: clamp(8px, 2vh, 10px);
      border-radius: 8px;
      background: var(--coffee-bg-secondary);
      color: var(--coffee-text-primary);

      p {
        margin: 2px 0;
        font-size: clamp(0.9rem, 2.2vw, 1rem);
      }

      @media (max-width: 768px) {
        padding: 12px;
      }
    }
  }

  button {
    padding: clamp(8px, 2vh, 10px) clamp(15px, 3vw, 20px);
    border-radius: 5px;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
    background-color: #4caf50;
    color: white;
    border: 2px solid #45a049;
    min-height: 44px;
    font-size: clamp(0.9rem, 2.2vw, 1rem);
    transition: all 0.2s ease;

    &:hover {
      background-color: #45a049;
    }

    &:disabled {
      background-color: #a0a0a0;
      border-color: #666;
      cursor: not-allowed;
    }
  }

  .close-button {
    display: block;
    margin: 20px auto 0;
    background-color: #f44336;
    border-color: #d32f2f;

    &:hover {
      background-color: #d32f2f;
    }
  }
}

.level-container {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 50px;
  height: 50px;
  display: flex;
  justify-content: center;
  align-items: center;

  .level-circle {
    position: absolute;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);

    .bg {
      fill: none;
      stroke-width: 10;
      stroke: var(--coffee-border-secondary);
    }

    .progress {
      fill: none;
      stroke-width: 10;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.3s ease;
      stroke: #4caf50; // Keep green for progress
    }
  }

  .level-text {
    font-size: 25px;
    font-weight: bold;
    z-index: 1;
  }
}
</style>
