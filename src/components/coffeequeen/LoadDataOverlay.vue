<template>
  <div class="load-data-overlay" @click.self="emitClose">
    <div class="data-modal">
      <h2>KfKbrygg Saves</h2>

      <div class="new-save-section">
        <input v-model="newSaveName" type="text" placeholder="New save name" maxlength="40" />
        <button @click="requestCreateNewSave">Start New Game</button>
      </div>

      <div v-if="confirmingNewSave" class="confirm-box">
        <p>Start a new game from scratch as "{{ normalizedNewSaveName }}"?</p>
        <div class="confirm-actions">
          <button class="confirm" @click="confirmCreateNewSave">Yes, I am sure</button>
          <button class="cancel" @click="cancelCreateNewSave">Cancel</button>
        </div>
      </div>

      <div class="data-wrapper">
        <div
          v-for="(item, index) in loadedData"
          :key="item.saveId || item.itemKey || `save-${index}`"
          class="data-item"
        >
          <p>Save: {{ item.userName }}</p>
          <p>Saved at: {{ formatDate(item.lastSaved) }}</p>
          <p>Money: ${{ formatCompactNumber(item.money) }}</p>
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

          <div class="actions-row">
            <button @click="emitLoadData(item)">Load</button>
            <button class="secondary" @click="startRename(item)">Edit</button>
            <button class="danger" @click="requestDelete(item)">Delete</button>
          </div>

          <div v-if="renamingSaveId === (item.saveId || item.itemKey)" class="rename-row">
            <input v-model="renameValue" type="text" maxlength="40" />
            <button class="confirm" @click="confirmRename(item)">Save Name</button>
            <button class="cancel" @click="cancelRename">Cancel</button>
          </div>

          <div v-if="deletingSaveId === (item.saveId || item.itemKey)" class="confirm-box inline">
            <p>Delete "{{ item.userName }}" permanently?</p>
            <div class="confirm-actions">
              <button class="danger" @click="confirmDelete(item)">Yes, delete</button>
              <button class="cancel" @click="cancelDelete">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <button class="close-button" @click="emitClose">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SavedGameData } from '@/components/coffeequeen/types'
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

interface Props {
  loadedData: SavedGameData[]
  storageType: string
}

interface Emits {
  (e: 'close'): void
  (e: 'loadData', saveId: string): void
  (e: 'createNewSave', saveName: string): void
  (e: 'renameSave', payload: { saveId: string; newName: string }): void
  (e: 'deleteSave', saveId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const circumference = 2 * Math.PI * 45
const newSaveName = ref<string>('Guest')
const confirmingNewSave = ref<boolean>(false)
const renamingSaveId = ref<string | null>(null)
const renameValue = ref<string>('')
const deletingSaveId = ref<string | null>(null)

const normalizedNewSaveName = computed(() => {
  const trimmed = newSaveName.value.trim()
  return trimmed.length > 0 ? trimmed : 'Guest'
})

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
  const saveId = item.saveId || item.itemKey
  if (saveId) {
    emit('loadData', saveId)
  }
}

const requestCreateNewSave = (): void => {
  confirmingNewSave.value = true
}

const confirmCreateNewSave = (): void => {
  emit('createNewSave', normalizedNewSaveName.value)
  confirmingNewSave.value = false
}

const cancelCreateNewSave = (): void => {
  confirmingNewSave.value = false
}

const startRename = (item: SavedGameData): void => {
  const saveId = item.saveId || item.itemKey
  if (!saveId) return

  renamingSaveId.value = saveId
  renameValue.value = item.userName
}

const confirmRename = (item: SavedGameData): void => {
  const saveId = item.saveId || item.itemKey
  if (!saveId) return

  const nextName = renameValue.value.trim() || 'Guest'
  emit('renameSave', { saveId, newName: nextName })
  renamingSaveId.value = null
}

const cancelRename = (): void => {
  renamingSaveId.value = null
}

const requestDelete = (item: SavedGameData): void => {
  deletingSaveId.value = item.saveId || item.itemKey || null
}

const confirmDelete = (item: SavedGameData): void => {
  const saveId = item.saveId || item.itemKey
  if (!saveId) return

  emit('deleteSave', saveId)
  deletingSaveId.value = null
}

const cancelDelete = (): void => {
  deletingSaveId.value = null
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

  .new-save-section {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;

    input {
      flex: 1;
      min-height: 40px;
      border-radius: 6px;
      border: 1px solid var(--coffee-border-primary);
      padding: 0 10px;
      font-family: inherit;
      background: var(--coffee-bg-secondary);
      color: var(--coffee-text-primary);
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

      .actions-row {
        margin-top: 8px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .rename-row {
        display: flex;
        gap: 8px;
        margin-top: 10px;
        width: 100%;

        input {
          flex: 1;
          min-height: 38px;
          border-radius: 6px;
          border: 1px solid var(--coffee-border-primary);
          padding: 0 8px;
          font-family: inherit;
          background: var(--coffee-bg-primary);
          color: var(--coffee-text-primary);
        }
      }
    }
  }

  .confirm-box {
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 8px;
    background: var(--coffee-bg-secondary);
    border: 1px solid var(--coffee-border-primary);

    &.inline {
      margin-top: 10px;
      margin-bottom: 0;
    }

    p {
      margin: 0 0 8px;
    }
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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

    &.secondary {
      background-color: #607d8b;
      border-color: #546e7a;

      &:hover {
        background-color: #546e7a;
      }
    }

    &.danger {
      background-color: #f44336;
      border-color: #d32f2f;

      &:hover {
        background-color: #d32f2f;
      }
    }

    &.confirm {
      background-color: #2e7d32;
      border-color: #1b5e20;
    }

    &.cancel {
      background-color: #616161;
      border-color: #424242;
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
