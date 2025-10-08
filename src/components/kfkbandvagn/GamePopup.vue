<template>
  <div class="game-popup" :style="popupStyle" v-if="cell">
    <!-- Close button -->
    <button class="popup-close" @click="$emit('close')">×</button>

    <!-- Cell info header -->
    <div class="popup-header">
      <h4>Cell ({{ cell.row }}, {{ cell.col }})</h4>
    </div>

    <!-- Players at this cell -->
    <div v-if="otherPlayers.length > 0" class="players-section">
      <div class="player-list">
        <div
          v-for="player in otherPlayers"
          :key="player.uuid"
          class="player-item"
          :class="{ dead: player.lives <= 0 }"
        >
          <div class="player-color" :style="{ backgroundColor: player.color }"></div>
          <div class="player-info">
            <span class="player-name">{{ player.playerID }}</span>
            <span class="player-stats">{{ player.lives }} liv, {{ player.tokens }} tokens</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="action-buttons">
      <!-- Move action -->
      <div v-if="canMove" class="action-option">
        <button
          @click="performAction('move')"
          class="action-btn move-btn"
          :disabled="!canAffordMove || isActionInProgress || props.isOnCooldown"
          :class="{ disabled: !canAffordMove || isActionInProgress || props.isOnCooldown }"
        >
          <span class="btn-icon">🚶‍♂️</span>
          <span class="btn-text">Flytta Hit</span>
          <span class="btn-cost">{{ moveCost }} token{{ moveCost > 1 ? 's' : '' }}</span>
        </button>
      </div>

      <!-- Shoot action -->
      <div v-if="canShoot && aliveTargets.length > 0" class="action-option">
        <div v-if="aliveTargets.length === 1">
          <button
            @click="performAction('shot', aliveTargets[0].uuid)"
            class="action-btn shoot-btn"
            :disabled="!canAffordShot || isActionInProgress || props.isOnCooldown"
            :class="{ disabled: !canAffordShot || isActionInProgress || props.isOnCooldown }"
          >
            <span class="btn-icon">🎯</span>
            <span class="btn-text">Skjut {{ aliveTargets[0].playerID }}</span>
            <span class="btn-cost">1 token</span>
          </button>
        </div>
      </div>

      <!-- No actions available -->
      <div v-if="!canMove && !canShoot" class="no-actions">
        <p v-if="!currentPlayer">Du måste vara inloggad för att spela</p>
        <p v-else-if="currentPlayer.lives <= 0">Du är död och kan inte utföra handlingar</p>
        <p v-else-if="!canAffordMove && distance > 0">
          Du har inte råd att flytta hit ({{ moveCost }} tokens behövs, du har
          {{ currentPlayer.tokens }})
        </p>
        <p v-else-if="hasBlockingPlayer && otherPlayers.length === 0">
          Du kan inte flytta till din egen position
        </p>
        <p v-else-if="hasBlockingPlayer">Cell upptagen av annan spelare</p>
        <p v-else>Ingen giltig handling</p>
      </div>
    </div>

    <!-- Distance and range info -->
    <div class="info-section">
      <div class="distance-info">
        <span>Avstånd: {{ distance }}</span>
        <span v-if="currentPlayer && otherPlayers.length > 0"
          >Räckvidd: {{ currentPlayer.range }}</span
        >
      </div>

      <!-- Cell type info -->
      <div class="cell-type-info">
        <span v-if="!isInPlayableArea" class="status-danger">⚠️ Avstängd zon</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

// Props
const props = defineProps({
  cell: {
    type: Object,
    required: true,
    validator: (value) => {
      return value && typeof value.row === 'number' && typeof value.col === 'number'
    },
  },
  currentPlayer: {
    type: Object,
    default: null,
  },
  otherPlayers: {
    type: Array,
    default: () => [],
  },
  canMove: {
    type: Boolean,
    default: false,
  },
  canShoot: {
    type: Boolean,
    default: false,
  },
  isOnCooldown: {
    type: Boolean,
    default: false,
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 }),
  },
})

// Emits
const emit = defineEmits(['action', 'close'])

// Action state for preventing double-clicks
const isActionInProgress = ref(false)

// Computed properties
const popupStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
}))

const aliveTargets = computed(() => {
  return props.otherPlayers.filter((p) => p.lives > 0)
})

const distance = computed(() => {
  if (!props.currentPlayer || !props.cell) return 0

  return (
    Math.abs(props.cell.row - props.currentPlayer.position.row) +
    Math.abs(props.cell.col - props.currentPlayer.position.column)
  )
})

// Calculate movement cost based on Manhattan distance
const moveCost = computed(() => {
  return Math.max(1, distance.value) // At least 1 token, cost increases with distance
})

// Check if player can afford the move
const canAffordMove = computed(() => {
  if (!props.currentPlayer) return false
  return props.currentPlayer.tokens >= moveCost.value
})

// Check if player can afford to shoot
const canAffordShot = computed(() => {
  if (!props.currentPlayer) return false
  return props.currentPlayer.tokens >= 1 // Shooting always costs 1 token
})

const isInPlayableArea = computed(() => {
  // This would need to be calculated based on board shrink data
  // For now, assume all cells are safe
  return true
})

const hasBlockingPlayer = computed(() => {
  return props.otherPlayers.some((p) => p.taken_tank)
})

// Actions
async function performAction(actionType, targetUUID = null) {
  if (isActionInProgress.value) {
    console.log('Action already in progress, ignoring click')
    return
  }

  // Set action in progress to prevent double-clicks
  isActionInProgress.value = true
  try {
    const action = {
      action: actionType,
      tank_id: props.currentPlayer?.uuid || '',
    }
    if (actionType === 'move') {
      action.targetCell = { row: props.cell.row, col: props.cell.col }
    }
    if (targetUUID) {
      action.targetUUID = targetUUID
    }

    emit('action', action)
  } catch (error) {
    console.error('Error performing action:', error)
  } finally {
    // Reset action state after a short delay to allow the action to process
    setTimeout(() => {
      isActionInProgress.value = false
    }, 1000)
  }
}
</script>

<style scoped lang="scss">
.game-popup {
  position: absolute;
  background: var(--theme-form-bg);
  border: 2px solid var(--theme-form-border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  min-width: 250px;
  max-width: 350px;
  z-index: 1000;
}

.popup-close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--theme-text-secondary);
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.popup-header {
  margin-bottom: 12px;

  h4 {
    margin: 0;
    color: var(--theme-modal-header);
    font-size: 16px;
  }
}

.players-section {
  margin-bottom: 16px;

  h5 {
    margin: 0 0 8px 0;
    color: var(--theme-modal-text);
    font-size: 14px;
  }
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: var(--theme-input-bg);
  border-radius: 6px;
  border: 1px solid var(--theme-input-border);

  &.dead {
    opacity: 0.6;
  }
}

.player-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--theme-input-border);
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name {
  font-weight: 600;
  color: var(--theme-modal-text);
  font-size: 13px;
}

.player-stats {
  font-size: 11px;
  color: var(--theme-sidebar-text);
}

.action-buttons {
  margin-bottom: 12px;
}

.action-option {
  margin-bottom: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  text-align: left;

  &:hover:not(.disabled) {
    transform: translateY(-1px);
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
}

.move-btn {
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);

  &:hover {
    background: var(--theme-button-primary-hover);
  }
}

.shoot-btn {
  background: var(--theme-button-danger-bg);
  color: var(--theme-button-primary-text);

  &:hover {
    background: var(--theme-button-danger-hover);
  }
}

.target-btn {
  margin-bottom: 4px;
  justify-content: flex-start;
}

.target-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--canvas-border-color);
  flex-shrink: 0;
}

.btn-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.btn-text {
  flex-grow: 1;
}

.btn-cost {
  font-size: 11px;
  opacity: 0.8;
  font-style: italic;
}

.target-selection {
  p {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: var(--text-color);
    font-weight: 500;
  }
}

.no-actions {
  text-align: center;
  padding: 12px;
  background: var(--input-bg);
  border-radius: 8px;
  border: 1px solid var(--input-border);

  p {
    margin: 0;
    font-size: 13px;
    color: var(--sidebar-text-color);
    font-style: italic;
  }
}

.info-section {
  border-top: 1px solid var(--input-border);
  padding-top: 12px;
  margin-top: 12px;
}

.distance-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;

  span {
    font-size: 12px;
    color: var(--sidebar-text-color);
  }
}

.cell-type-info {
  text-align: center;
}

.status-safe {
  color: var(--modal-header-color);
  font-size: 12px;
  font-weight: 500;
}

.status-danger {
  color: var(--button-hard-drop-bg);
  font-size: 12px;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .game-popup {
    min-width: 200px;
    max-width: 280px;
    padding: 12px;
  }

  .action-btn {
    padding: 8px 10px;
    font-size: 12px;
  }

  .btn-icon {
    font-size: 14px;
  }
}
</style>
