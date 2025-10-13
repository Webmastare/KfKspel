<template>
  <div id="app-container">
    <h1 class="game-header">KfKbandvagn</h1>

    <!-- Player Stats Section (similar to leaderboard) -->
    <div class="stats-container">
      <button @click="toggleStats" class="stats-toggle">
        <span>Spelstatus</span>
        <span class="toggle-icon" :class="{ expanded: showStats }">▼</span>
      </button>
      <div class="stats-wrapper" :class="{ expanded: showStats }">
        <div class="stats-content">
          <div class="stats-grid" v-if="currentPlayer">
            <div class="stat-item">
              <span class="stat-label">Spelare</span>
              <span class="stat-value">{{ currentPlayer.playerID }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Tokens</span>
              <span class="stat-value">{{ currentPlayer.tokens }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Liv</span>
              <span class="stat-value">{{ currentPlayer.lives }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Räckvidd</span>
              <span class="stat-value">{{ currentPlayer.range }}</span>
            </div>
          </div>
          <div v-else class="no-player-message">
            <p>Ingen aktiv spelare - logga in eller skapa en bandvagn</p>
          </div>

          <!-- Players list -->
          <div class="players-list" v-if="playersToShow.length">
            <div class="players-list-header">
              <span>Spelare på brädet ({{ playersToShow.length }})</span>
            </div>
            <ul class="players-list-items">
              <li :style="{ borderBottom: '1px solid var(--theme-border-light)' }">
                <span class="players-list-header">Namn</span>
                <span class="players-list-header">Position (r,c)</span>
                <span class="players-list-header">Distans</span>
                <span class="players-list-header">Visa</span>
                <span></span>
              </li>
              <li v-for="p in playersToShow" :key="p.uuid" class="players-list-item">
                <div>
                  <span
                    v-if="p.uuid === currentPlayer?.uuid"
                    class="current-player-indicator"
                    :style="{ color: p.color, background: '#ffd70099', borderRadius: '5px' }"
                    >★</span
                  >
                  <span
                    v-if="p.uuid !== currentPlayer?.uuid"
                    class="player-dot"
                    :style="{ backgroundColor: p.color }"
                  ></span>
                  <span class="player-name">{{ p.playerID }}</span>
                </div>
                <span class="player-position">{{ p.position.row }}, {{ p.position.column }}</span>
                <span class="player-distance">{{ p.distToCurrent }}</span>
                <span class="player-focus"><button @click="focusOnPlayer(p)">🔍</button></span>
                <span class="player-meta"
                  >❤ {{ p.lives }} · ➶ {{ p.range }} · ⛁ {{ p.tokens }}</span
                >
              </li>
            </ul>
          </div>
          <!-- Shrink status inside spelstatus dropdown -->
          <!-- TODO: Not implemented yet placeholder-->
          <div class="shrink-status" v-if="boardData && false">
            <div class="shrink-row">
              <span class="label">Nästa krympning:</span>
              <span class="value">{{ nextShrinkCountdown }}</span>
            </div>
            <div class="shrink-row">
              <span class="label">Krympningens storlek:</span>
              <span class="value"
                >rad: {{ boardData.to_shrink?.row || 0 }}, kol:
                {{ boardData.to_shrink?.column || 0 }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile controls bar -->
    <div class="mobile-controls-bar">
      <div class="mobile-top-row">
        <div class="mobile-game-info" v-if="currentPlayer">
          <span class="mobile-tokens">{{ currentPlayer.tokens }} tokens</span>
          <span class="mobile-lives">{{ currentPlayer.lives }} liv</span>
        </div>
        <div class="mobile-btn-container">
          <button @click="refreshGameState" class="mobile-btn" :disabled="isLoading">
            <span v-if="isLoading">⏳</span>
            <span v-else>🔄</span>
          </button>
          <button @click="toggleInfo" class="mobile-btn">ℹ️</button>
        </div>
      </div>
    </div>

    <div class="game-layout">
      <!-- Desktop sidebar -->
      <div class="sidebar desktop-only">
        <div class="sidebar-btn-container">
          <!-- Cooldown countdown shown above realtime status -->
          <div v-if="isOnCooldown" class="cooldown-row" title="Vänta innan nästa handling">
            ⏱ Nästa handling: {{ actionCountdownText }}
          </div>
          <div class="sidebar-btn-with-indicator">
            <span class="rt-indicator" :class="rtClass" :title="pollingStatusTitle"></span>
            <span>{{ timeSinceRefreshed }}</span>
          </div>
          <button @click="refreshGameState" class="sidebar-btn" :disabled="isLoading">
            <span v-if="isLoading">Laddar...</span>
            <span v-else>Uppdatera</span>
          </button>
          <button @click="toggleInfo" class="sidebar-btn">
            <span v-if="infoShown">Dölj Info</span>
            <span v-else>Visa Info</span>
          </button>
        </div>

        <!-- Action buttons -->
        <div class="action-buttons" v-if="currentPlayer && currentPlayer.lives > 0">
          <button
            @click="showUpgradeModal('range')"
            class="action-btn"
            :disabled="currentPlayer.tokens < 3 || isOnCooldown"
          >
            Köp Räckvidd <br />
            (3 tokens)
          </button>
          <button
            @click="showUpgradeModal('life')"
            class="action-btn"
            :disabled="currentPlayer.tokens < 3 || isOnCooldown"
          >
            Köp Liv <br />
            (3 tokens)
          </button>
        </div>
      </div>

      <!-- Main game area -->
      <div class="canvas-outer-wrapper">
        <div class="canvas-container">
          <!-- Player Creation Modal -->
          <PlayerCreation
            v-if="showPlayerModal"
            @close="closePlayerModal"
            @playerCreated="handlePlayerCreated"
          />

          <!-- Upgrade Confirmation Modal -->
          <div v-if="showUpgradeDialog" class="upgrade-modal auth-form">
            <div class="form-base">
              <h3>Bekräfta Köp</h3>
              <!-- Input to buy multiple upgrades at once -->
              <div class="multi-upgrade-input">
                <button
                  type="button"
                  @click="multiUpgradeCount--"
                  class="upgrade-btn-minus"
                  :disabled="multiUpgradeCount <= 1"
                >
                  -
                </button>
                <input
                  type="number"
                  name="custom-difficulty"
                  id="custom-difficulty"
                  v-model.number="multiUpgradeCount"
                  min="1"
                  max="100"
                  @input="updateMultipleUpgrades"
                />
                <button
                  type="button"
                  @click="multiUpgradeCount++"
                  class="upgrade-btn-plus"
                  :disabled="multiUpgradeCount >= 100"
                >
                  +
                </button>
              </div>

              <p v-if="upgradeType === 'range'">
                Vill du köpa +{{ normalizedCount }} räckvidd för
                {{ totalUpgradeCost }} tokens?<br />
                Din nuvarande räckvidd: {{ currentPlayer?.range || 0 }} →
                {{ (currentPlayer?.range || 0) + normalizedCount }}
              </p>
              <p v-if="upgradeType === 'life'">
                Vill du köpa +{{ normalizedCount }} liv för {{ totalUpgradeCost }} tokens?<br />
                Dina nuvarande liv: {{ currentPlayer?.lives || 0 }} →
                {{ (currentPlayer?.lives || 0) + normalizedCount }}
              </p>
              <p
                v-if="!canAffordSelectedUpgrade"
                style="color: var(--theme-text-secondary); margin-top: 4px"
              >
                För dyrt: du har {{ currentPlayer?.tokens || 0 }} tokens, behöver
                {{ totalUpgradeCost }}.
              </p>
              <div class="button-group">
                <button @click="cancelUpgrade" class="button-base decline">Avbryt</button>
                <button
                  @click="confirmUpgrade"
                  class="button-base"
                  :disabled="isOnCooldown || !canAffordSelectedUpgrade"
                >
                  <span v-if="isOnCooldown">Vänta {{ actionCountdownText }}</span>
                  <span v-else>Köp ({{ totalUpgradeCost }}t)</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Game Canvas -->
          <BandvagnCanvas
            ref="canvasRef"
            v-if="isGameInitialized"
            :isOnCooldown="isOnCooldown"
            @actionPerformed="handleActionPerformed"
          />

          <!-- Loading state -->
          <div v-else-if="isLoading" class="loading-container">
            <div class="loading-spinner">⏳</div>
            <p>Laddar spel...</p>
          </div>

          <!-- No player state -->
          <div v-else class="no-player-container">
            <h2>Välkommen till KfKbandvagn!</h2>
            <p>
              Du behöver <span v-if="!authStore.isAuthed">logga in och</span> skapa en bandvagn för
              att spela.
            </p>
            <button @click="openPlayerModal" class="button-base">Skapa Bandvagn</button>
          </div>
        </div>

        <!-- Mobile action buttons -->
        <div class="mobile-actions" v-if="currentPlayer && currentPlayer.lives > 0">
          <button
            @click="showUpgradeModal('range')"
            class="mobile-action-btn"
            :disabled="currentPlayer.tokens < 3 || isOnCooldown"
          >
            Räckvidd (3t)
          </button>
          <button
            @click="showUpgradeModal('life')"
            class="mobile-action-btn"
            :disabled="currentPlayer.tokens < 3 || isOnCooldown"
          >
            Liv (3t)
          </button>
        </div>
      </div>

      <!-- Right sidebar -->
      <div class="sidebar desktop-only">
        <div class="game-info" v-if="currentPlayer">
          <div class="info-item">
            <span class="info-label">Position</span>
            <span class="info-value">
              {{ currentPlayer.position.row }}, {{ currentPlayer.position.column }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Tokens</span>
            <span class="info-value">{{ currentPlayer.tokens }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Liv</span>
            <span class="info-value">{{ currentPlayer.lives }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Räckvidd</span>
            <span class="info-value">{{ currentPlayer.range }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value" :class="{ dead: currentPlayer.lives <= 0 }">
              {{ currentPlayer.lives > 0 ? 'Levande' : 'Död' }}
            </span>
          </div>
        </div>

        <!-- Game Logs -->
        <div class="game-logs" v-if="boardData && boardData.logs">
          <h4>Senaste Händelser</h4>
          <div class="logs-container">
            <div v-for="(log, index) in recentLogs" :key="index" class="log-entry">
              <div class="log-header">
                <span class="log-timestamp">{{ getDetailedLogInfo(log).timestamp }}</span>
                <span
                  class="log-player"
                  :class="{ 'current-player': getDetailedLogInfo(log).isCurrentPlayer }"
                >
                  {{ getDetailedLogInfo(log).playerID }}
                </span>
              </div>
              <div class="log-content">
                <span class="log-action">{{ getDetailedLogInfo(log).actionDescription }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile game info -->
    <div class="mobile-stats" v-if="currentPlayer">
      <div class="mobile-stats-grid">
        <div class="mobile-stat-item">
          <span class="mobile-stat-label">Position</span>
          <span class="mobile-stat-value">
            {{ currentPlayer.position.row }},{{ currentPlayer.position.column }}
          </span>
        </div>
        <div class="mobile-stat-item">
          <span class="mobile-stat-label">Status</span>
          <span class="mobile-stat-value" :class="{ dead: currentPlayer.lives <= 0 }">
            {{ currentPlayer.lives > 0 ? 'Levande' : 'Död' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Information Section -->
    <div v-if="infoShown" class="information-container">
      <div class="information-text">
        <div class="background-decor">
          <div class="information-inset">
            <strong>Spelregler</strong>
            <p>
              Varje spelare börjar på en slumpmässig plats på spelplanen med 3 hjärtan (liv), 2
              rutor i räckvidd och 0 Tokens. Tokens förelas automatiskt dagligen. Använd tokens för
              att utföra handlingar.
            </p>
          </div>
        </div>
        <div class="background-decor">
          <div class="information-inset">
            <strong>Handlingar</strong>
            <p>
              <strong>Flytta:</strong> Klicka på en tom ruta för att flytta dit (1 token per
              ruta).<br />
              <strong>Skjut:</strong> Klicka på en annan spelare inom din räckvidd för att skjuta (1
              token). Om spelaren dör får du 5 tokens.<br />
              <strong>Köp Räckvidd:</strong> Öka din räckvidd med 1 (3 tokens).<br />
              <strong>Köp Liv:</strong> Få ett extra liv (3 tokens).
            </p>
          </div>
        </div>
        <div class="background-decor">
          <div class="information-inset">
            <strong>Liv och Dödsfall</strong>
            <p>
              Om du blir skjuten förlorar du ett liv. När du når 0 liv är du ute ur spelet (kom ihåg
              att köpa liv). Du kan återuppstå genom att en annan spelare donerar ett liv till dig.
            </p>
          </div>
        </div>
        <div class="background-decor">
          <div class="information-inset">
            <strong>Spelplan</strong>
            <p>
              Spelplanen krymper regelbundet och spelare utanför den aktiva ytan förlorar ett liv
              för varje gång spelplanen krymper. Nya tokens fördelas automatiskt till alla levande
              spelare. Planera dina drag väl!
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBandvagnStore } from '@/stores/bandvagnState'
import PlayerCreation from '@/components/kfkbandvagn/PlayerCreation.vue'
import BandvagnCanvas from '@/components/kfkbandvagn/BandvagnCanvas.vue'
import { recordUserActivity } from '@/composables/kfkbandvagn/database'

// Canvas reference
const canvasRef = ref(null)

// Stores
const authStore = useAuthStore()
const gameStore = useBandvagnStore()

// UI State
const infoShown = ref(false)
const showStats = ref(false)
const showPlayerModal = ref(false)
const showUpgradeDialog = ref(false)
const multiUpgradeCount = ref(1)
const upgradeType = ref('')
const isMobile = ref(false)

// Computed
const currentPlayer = computed(() => gameStore.currentPlayer)
const allPlayers = computed(() => gameStore.allPlayers)
const boardData = computed(() => gameStore.boardData)
const isLoading = computed(() => gameStore.isLoading)
const rtClass = computed(() => {
  const s = gameStore.realtimeStatus
  return s === 'fast'
    ? 'fast'
    : s === 'medium'
      ? 'medium'
      : s === 'slow'
        ? 'slow'
        : s === 'connecting'
          ? 'connecting'
          : s === 'error'
            ? 'error'
            : s === 'inactive'
              ? 'inactive'
              : 'disconnected'
})

const pollingStatusTitle = computed(() => {
  const s = gameStore.realtimeStatus
  const interval = gameStore.currentPollingInterval

  switch (s) {
    case 'fast':
      return `Active polling: ${interval}ms (green)`
    case 'medium':
      return `Normal polling: ${interval}ms (yellow)`
    case 'slow':
      return `Slow polling: ${interval}ms (orange)`
    case 'connecting':
      return 'Connecting...'
    case 'error':
      return 'Polling error (red)'
    case 'inactive':
      return 'Page inactive - polling paused (red)'
    case 'disconnected':
    default:
      return 'Disconnected (red)'
  }
})

// Upgrade modal helpers (dynamic cost and affordability)
const perUpgradeCost = computed(() =>
  upgradeType.value === 'range' || upgradeType.value === 'life' ? 3 : 0,
)
const normalizedCount = computed(() =>
  Math.max(1, Math.min(100, Number(multiUpgradeCount.value) || 1)),
)
const totalUpgradeCost = computed(() => perUpgradeCost.value * normalizedCount.value)
const canAffordSelectedUpgrade = computed(
  () => (currentPlayer.value?.tokens || 0) >= totalUpgradeCost.value,
)

// Simple interval-driven text (no computed needed)
const timeSinceRefreshed = ref('Aldrig')
const actionCountdownText = ref(0) // forces cooldown countdown to update each second
const isOnCooldown = ref(false) // forces cooldown state to update each second
let timeTickerId = null

function formatSince(date) {
  if (!date) return 'Aldrig'
  const now = Date.now()
  const past = date.getTime()
  const diff = Math.max(0, now - past)
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((diff % (60 * 1000)) / 1000)
  if (days > 1) return '>1d'
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function startTimeTicker() {
  // Update immediately and then every second
  timeSinceRefreshed.value = formatSince(gameStore.lastRealtimeUpdate ?? null)
  if (timeTickerId) clearInterval(timeTickerId)
  timeTickerId = window.setInterval(() => {
    // Time since last game state update
    timeSinceRefreshed.value = formatSince(gameStore.lastRealtimeUpdate ?? null)
    // tick cooldown countdown so computed re-evaluates
    const timeLeft = getActionCooldown()
    actionCountdownText.value = `${timeLeft}s`
    isOnCooldown.value = timeLeft > 0
  }, 100)
}

const isGameInitialized = computed(() => {
  return currentPlayer.value
})

// Only show players that have an active tank and are alive (or show all if desired)
const playersToShow = computed(() => {
  const filteredPlayers = allPlayers.value
    .filter((p) => p.taken_tank)
    .map((p) => ({
      ...p,
      distToCurrent: currentPlayer.value
        ? Math.abs(p.position.row - currentPlayer.value.position.row) +
          Math.abs(p.position.column - currentPlayer.value.position.column)
        : Infinity,
    }))
  return filteredPlayers.sort((a, b) => a.distToCurrent - b.distToCurrent)
})

const recentLogs = computed(() => {
  if (!boardData.value?.logs) return []
  return boardData.value.logs.slice().reverse()
})

// Action cooldown (UI-only) derived from store and shown in sidebar
function getActionCooldown() {
  if (!gameStore.actionCooldownUntil) return 0
  const ms = Math.max(0, gameStore.actionCooldownUntil.getTime() - Date.now())
  if (!ms || ms <= 0) return 0
  const secs = Math.ceil(ms / 1000)
  return secs
}

// Next shrink countdown
const nextShrinkCountdown = computed(() => {
  const ts = boardData.value && boardData.value.next_shrink
  if (!ts) return '–'
  const now = Date.now()
  const target = new Date(ts).getTime()
  const diff = Math.max(0, target - now)
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
})

// UI Controls
function toggleInfo() {
  infoShown.value = !infoShown.value
}

function toggleStats() {
  recordUserActivity() // Record user activity for adaptive polling
  showStats.value = !showStats.value
}

// Game Actions
async function refreshGameState() {
  recordUserActivity() // Record user activity for adaptive polling
  try {
    await gameStore.fetchGameState()
  } catch (error) {
    console.error('Failed to refresh game state:', error)
  }
}

function openPlayerModal() {
  showPlayerModal.value = true
}

function closePlayerModal() {
  showPlayerModal.value = false
}

function handlePlayerCreated() {
  showPlayerModal.value = false
  refreshGameState()
}

function focusOnPlayer(player) {
  canvasRef.value.centerOnPlayer(player)
}

async function handleActionPerformed(action) {
  try {
    await gameStore.performAction(action)
  } catch (error) {
    console.error('Action failed:', error)
    // TODO: Show user-friendly error message
  }
}

// Upgrade system
function updateMultipleUpgrades() {
  if (multiUpgradeCount.value > 100) multiUpgradeCount.value = 100
  if (multiUpgradeCount.value < 1) multiUpgradeCount.value = 1
}

function showUpgradeModal(type) {
  recordUserActivity() // Record user activity for adaptive polling
  upgradeType.value = type
  showUpgradeDialog.value = true
}

function cancelUpgrade() {
  showUpgradeDialog.value = false
  upgradeType.value = ''
}

async function confirmUpgrade() {
  try {
    await gameStore.performAction({
      action: upgradeType.value,
      tank_id: currentPlayer.value?.uuid || '',
      count: Math.max(1, Number(multiUpgradeCount.value) || 1),
    })
    showUpgradeDialog.value = false
    upgradeType.value = ''
    console.log('Upgrade successful')
  } catch (error) {
    console.error('Upgrade failed:', error)
    // TODO: Show error message to user
  }
}

// Enhanced log formatting functions
function formatTimestamp(timestamp) {
  const date = new Date(timestamp)

  const year = date.getFullYear().toString().slice(-2) // Get only last two digits of the year
  const month = String(date.getMonth() + 1).padStart(2, '0') // Months are zero-indexed
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function getDetailedLogInfo(log) {
  const isCurrentPlayer = currentPlayer.value && log.playerID === currentPlayer.value.playerID
  let actionDescription = ''

  switch (log.action) {
    case 'shot':
      if (log.details?.targetUser) {
        const beforeLives = log.details?.before?.target?.lives ?? log.details?.targetUserLives + 1
        const afterLives = log.details?.after?.target?.lives ?? log.details?.targetUserLives
        actionDescription = `Sköt ${log.details.targetUser} (${beforeLives} → ${afterLives} liv)`
      } else {
        actionDescription = 'Sköt'
      }
      break

    case 'move':
      if (log.details?.from && log.details?.to) {
        const from = log.details.from
        const to = log.details.to
        const cost = log.details?.cost
        actionDescription = `Flyttade (${from.row}, ${from.column}) → (${to.row}, ${to.column})${cost ? ` (kostade ${cost}t)` : ''}`
      } else {
        actionDescription = 'Flyttade'
      }
      break

    case 'range':
      if (log.details?.before?.range != null && log.details?.after?.range != null) {
        const before = log.details.before.range
        const after = log.details.after.range
        const count = log.details?.count || after - before
        const cost = log.details?.cost
        actionDescription = `Köpte räckvidd +${count} (${before} → ${after})${cost ? ` för ${cost}t` : ''}`
      } else {
        actionDescription = 'Köpte räckvidd'
      }
      break

    case 'life':
      if (log.details?.before?.lives != null && log.details?.after?.lives != null) {
        const before = log.details.before.lives
        const after = log.details.after.lives
        const count = log.details?.count || after - before
        const cost = log.details?.cost
        actionDescription = `Köpte liv +${count} (${before} → ${after})${cost ? ` för ${cost}t` : ''}`
      } else {
        actionDescription = 'Köpte liv'
      }
      break

    case 'board_shrink':
      actionDescription = 'Spelplanen krympte'
      break

    case 'token_distribution':
      if (log.details?.tokensPerPlayer) {
        actionDescription = `Alla fick ${log.details.tokensPerPlayer} tokens`
      } else {
        actionDescription = 'Alla fick tokens'
      }
      break

    case 'death':
      if (log.details?.targetUser) {
        actionDescription = `${log.details.targetUser} dog`
      } else {
        actionDescription = 'Någon dog'
      }
      break

    case 'respawn':
      actionDescription = 'Återuppstod'
      break

    default:
      actionDescription = log.action
      break
  }

  return {
    timestamp: formatTimestamp(log.timestamp),
    playerID: log.playerID,
    actionDescription,
    isCurrentPlayer,
  }
}

// Mobile detection
function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}

// Debug function to check polling status (can be called from browser console)
function getPollingDebugInfo() {
  const { getPollingInfo } = require('@/composables/kfkbandvagn/database')
  const pollingInfo = getPollingInfo()
  console.log('Polling Debug Info:', {
    ...pollingInfo,
    realtimeStatus: gameStore.realtimeStatus,
    currentPollingInterval: gameStore.currentPollingInterval,
  })
  return pollingInfo
}

// Make debug function available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.getPollingDebugInfo = getPollingDebugInfo
}

// Auth state watcher - handles game state initialization and updates
watch(
  () => authStore.authStateVersion,
  async (newVersion, oldVersion) => {
    console.log(`Auth state version changed: ${oldVersion} -> ${newVersion}`)

    if (authStore.isAuthed) {
      if (!gameStore.initialized) {
        console.log('User authenticated, initializing game store')
        try {
          await gameStore.initialize()

          // Check if user needs to create a player
          if (!currentPlayer.value) {
            showPlayerModal.value = true
          } else {
            // Close player modal if it's open and we now have a player
            showPlayerModal.value = false
          }
        } catch (error) {
          console.error('Failed to initialize game store after auth change:', error)
        }
      }
    } else {
      console.log('User logged out, resetting game store')
      // Reset game store when user logs out
      gameStore.reset()
      showPlayerModal.value = false
    }
  },
  { immediate: false }, // Don't run immediately since we handle initial state in onMounted
)

// Lifecycle
onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  startTimeTicker()

  if (authStore.isAuthed) {
    console.log('User authenticated, initializing game store')
    try {
      await gameStore.initialize()
    } catch (error) {
      console.error('Failed to initialize game store on mount:', error)
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  if (timeTickerId) clearInterval(timeTickerId)
})
</script>

<style scoped lang="scss">
/* Import the shared game styles and theme */
@use '@/styles/generalGames.scss';
@use '@/components/kfkbandvagn/BandvagnStyle.scss';

/* Kfkbandvagn-specific styles */
#app-container {
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: 100vh;
  padding: 20px;
}

h1 {
  color: var(--theme-text-primary);
  text-align: center;
  margin-bottom: 20px;
}

/* Enhanced Game Logs Styling */
.game-logs {
  h4 {
    margin-bottom: 12px;
    color: var(--theme-text-primary);
    font-size: 1.1rem;
  }
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--theme-border-light);
  border-radius: 8px;
  background: var(--theme-bg-secondary);
  padding: 8px;
}

.log-entry {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 6px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-light);

  &:last-child {
    margin-bottom: 0;
  }
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 0.85rem;
}

.log-timestamp {
  color: var(--theme-text-secondary);
  font-family: monospace;
  font-size: 0.8rem;
}

.log-player {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--theme-bg-secondary);
  color: var(--theme-text-primary);

  &.current-player {
    background: #f58989;
    color: #000;
  }
}

.log-content {
  margin-left: 4px;
}

.log-action {
  color: var(--theme-text-primary);
  font-size: 0.9rem;
  line-height: 1.4;
}

.sidebar-btn-with-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cooldown-row {
  margin-bottom: 6px;
  font-size: 0.9rem;
  color: var(--theme-text-secondary);
}
.rt-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--theme-border-light);
  background: gray;
  cursor: help;
}
.rt-indicator.fast {
  background: #28a745; /* Green - 1000ms */
}
.rt-indicator.medium {
  background: #ffc107; /* Yellow - 3000ms */
}
.rt-indicator.slow {
  background: #ff8c00; /* Orange - 10000ms */
}
.rt-indicator.connecting {
  background: #17a2b8; /* Light blue */
}
.rt-indicator.error,
.rt-indicator.inactive,
.rt-indicator.disconnected {
  background: #dc3545; /* Red */
}

.shrink-status {
  margin: 12px 0 20px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-light);
  .shrink-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    .label {
      color: var(--theme-text-secondary);
    }
    .value {
      color: var(--theme-text-primary);
      font-weight: 600;
    }
  }
}
</style>
