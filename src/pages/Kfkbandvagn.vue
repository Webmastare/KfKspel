<template>
  <div id="app-container">
    <h1>KfKbandvagn</h1>

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
          <button @click="toggleTheme" class="mobile-btn">
            <span v-if="isDarkMode">☀️</span>
            <span v-else>🌙</span>
          </button>
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
          <button @click="toggleTheme" class="sidebar-btn">
            <span v-if="isDarkMode">☀️</span>
            <span v-else>🌙</span>
          </button>
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
            :disabled="currentPlayer.tokens < 3"
          >
            Köp Räckvidd (3 tokens)
          </button>
          <button
            @click="showUpgradeModal('life')"
            class="action-btn"
            :disabled="currentPlayer.tokens < 3"
          >
            Köp Liv (3 tokens)
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
            class="auth-form"
          />

          <!-- Upgrade Confirmation Modal -->
          <div v-if="showUpgradeDialog" class="upgrade-modal auth-form">
            <div class="form-base">
              <h3>Bekräfta Köp</h3>
              <p v-if="upgradeType === 'range'">
                Vill du köpa ökad räckvidd för 3 tokens?<br />
                Din nuvarande räckvidd: {{ currentPlayer?.range || 0 }}
              </p>
              <p v-if="upgradeType === 'life'">
                Vill du köpa ett extra liv för 3 tokens?<br />
                Dina nuvarande liv: {{ currentPlayer?.lives || 0 }}
              </p>
              <div class="button-group">
                <button @click="cancelUpgrade" class="button-base decline">Avbryt</button>
                <button @click="confirmUpgrade" class="button-base">Köp</button>
              </div>
            </div>
          </div>

          <!-- Game Canvas -->
          <BandvagnCanvas
            v-if="gameInitialized && currentPlayer"
            :players="allPlayers"
            :board-data="boardData"
            :current-player="currentPlayer"
            :selected-cell="selectedCell"
            @cellSelected="handleCellSelected"
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
            <p>Du behöver logga in och skapa en bandvagn för att spela.</p>
            <button @click="openPlayerModal" class="button-base">Skapa Bandvagn</button>
          </div>
        </div>

        <!-- Mobile action buttons -->
        <div class="mobile-actions" v-if="currentPlayer && currentPlayer.lives > 0">
          <button
            @click="showUpgradeModal('range')"
            class="mobile-action-btn"
            :disabled="currentPlayer.tokens < 3"
          >
            Räckvidd (3t)
          </button>
          <button
            @click="showUpgradeModal('life')"
            class="mobile-action-btn"
            :disabled="currentPlayer.tokens < 3"
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
              <span class="log-player">{{ log.playerID }}:</span>
              <span class="log-action">{{ getActionDescription(log) }}</span>
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
        <strong>Spelregler</strong>
        <p>
          KfKbandvagn är ett strategiskt multiplayer-spel där du styr en bandvagn på en krympande
          spelplan. Klicka på en ruta för att flytta dit (kostar 1 token) eller skjuta mot en annan
          spelare (kostar 1 token). Överlev så länge som möjligt!
        </p>

        <strong>Handlingar</strong>
        <p>
          <strong>Flytta:</strong> Klicka på en tom ruta inom din räckvidd för att flytta dit (1
          token).<br />
          <strong>Skjut:</strong> Klicka på en annan spelare inom din räckvidd för att skjuta (1
          token).<br />
          <strong>Köp Räckvidd:</strong> Öka din räckvidd med 1 (3 tokens).<br />
          <strong>Köp Liv:</strong> Få ett extra liv (3 tokens).
        </p>

        <strong>Spelplan</strong>
        <p>
          Spelplanen krymper regelbundet och spelare utanför den aktiva ytan förlorar liv. Nya
          tokens distribueras automatiskt till alla levande spelare. Planera dina drag väl!
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBandvagnStore } from '@/stores/bandvagnState'
import PlayerCreation from '@/components/kfkbandvagn/PlayerCreation.vue'
import BandvagnCanvas from '@/components/kfkbandvagn/BandvagnCanvas.vue'

// Stores
const authStore = useAuthStore()
const gameStore = useBandvagnStore()

// UI State
const isDarkMode = ref(false)
const infoShown = ref(false)
const showStats = ref(false)
const showPlayerModal = ref(false)
const showUpgradeDialog = ref(false)
const upgradeType = ref('')
const selectedCell = ref(null)
const isMobile = ref(false)

// Computed
const currentPlayer = computed(() => gameStore.currentPlayer)
const allPlayers = computed(() => gameStore.allPlayers)
const boardData = computed(() => gameStore.boardData)
const isLoading = computed(() => gameStore.isLoading)
const gameInitialized = computed(() => gameStore.initialized && currentPlayer.value)

const recentLogs = computed(() => {
  if (!boardData.value?.logs) return []
  return boardData.value.logs.slice(-10).reverse()
})

// Theme Management
function applyTheme() {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-theme')
    document.documentElement.classList.remove('light-theme')
  } else {
    document.documentElement.classList.add('light-theme')
    document.documentElement.classList.remove('dark-theme')
  }
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('kfkbandvagn-theme', isDarkMode.value ? 'dark' : 'light')
  applyTheme()
}

function setInitialTheme() {
  const storedTheme = localStorage.getItem('kfkbandvagn-theme')
  const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

  if (storedTheme) {
    isDarkMode.value = storedTheme === 'dark'
  } else {
    isDarkMode.value = prefersDarkQuery.matches
  }
  applyTheme()

  prefersDarkQuery.addEventListener('change', (e) => {
    if (!localStorage.getItem('kfkbandvagn-theme')) {
      isDarkMode.value = e.matches
      applyTheme()
    }
  })
}

// UI Controls
function toggleInfo() {
  infoShown.value = !infoShown.value
}

function toggleStats() {
  showStats.value = !showStats.value
}

// Game Actions
async function refreshGameState() {
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

// Cell selection and actions
function handleCellSelected(cell) {
  selectedCell.value = cell
}

async function handleActionPerformed(action) {
  try {
    await gameStore.performAction(action)
    selectedCell.value = null
  } catch (error) {
    console.error('Action failed:', error)
    // TODO: Show user-friendly error message
  }
}

// Upgrade system
function showUpgradeModal(type) {
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
      user_id: authStore.user?.id,
    })
    showUpgradeDialog.value = false
    upgradeType.value = ''
  } catch (error) {
    console.error('Upgrade failed:', error)
    // TODO: Show error message to user
  }
}

// Action description helper
function getActionDescription(log) {
  const actionMap = {
    move: 'flyttade',
    shot: 'sköt',
    range: 'köpte räckvidd',
    life: 'köpte liv',
    board_shrink: 'spelplan krympte',
    token_distribution: 'tokens utdelade',
  }

  let description = actionMap[log.action] || log.action

  if (log.details?.targetPlayer) {
    description += ` mot ${log.details.targetPlayer}`
  }

  return description
}

// Mobile detection
function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}

// Lifecycle
onMounted(async () => {
  setInitialTheme()
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // Initialize game store
  await gameStore.initialize()

  // Check if user needs to create a player
  if (authStore.isAuthed && !currentPlayer.value) {
    showPlayerModal.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped lang="scss">
/* Import the shared game styles */
@import '@/styles/generalGames.scss';

/* Bandvagn-specific styles */
.stats-container {
  margin-bottom: 20px;
  border: 1px solid var(--canvas-border-color);
  border-radius: 12px;
  overflow: hidden;
  background: var(--sidebar-bg-color);
}

.stats-toggle {
  width: 100%;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  border: none;
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  transition: background-color 0.2s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.toggle-icon {
  transition: transform 0.3s;

  &.expanded {
    transform: rotate(180deg);
  }
}

.stats-wrapper {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;

  &.expanded {
    max-height: 200px;
  }
}

.stats-content {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--sidebar-text-color);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--sidebar-value-color);
}

.no-player-message {
  text-align: center;
  color: var(--sidebar-text-color);
  font-style: italic;
}

.action-buttons {
  margin-top: 20px;
}

.action-btn {
  width: 100%;
  margin-bottom: 10px;
  padding: 12px;
  background: var(--button-modal-action-bg);
  color: var(--button-text-color);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background: var(--button-modal-action-hover-bg);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.mobile-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  justify-content: center;
}

.mobile-action-btn {
  flex: 1;
  padding: 12px 8px;
  background: var(--button-modal-action-bg);
  color: var(--button-text-color);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background: var(--button-modal-action-hover-bg);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.loading-container,
.no-player-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  color: var(--text-color);
}

.loading-spinner {
  font-size: 48px;
  margin-bottom: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.game-logs {
  margin-top: 30px;

  h4 {
    margin-bottom: 15px;
    color: var(--sidebar-value-color);
  }
}

.logs-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--canvas-border-color);
  border-radius: 8px;
  padding: 10px;
  background: var(--canvas-bg-color);
}

.log-entry {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.4;
}

.log-player {
  font-weight: 600;
  color: var(--modal-header-color);
}

.log-action {
  color: var(--sidebar-text-color);
  margin-left: 5px;
}

.upgrade-modal {
  .form-base {
    max-width: 400px;
  }
}

.dead {
  color: #ef4444 !important;
  font-weight: 600;
}

.mobile-game-info {
  display: flex;
  gap: 15px;
}

.mobile-tokens,
.mobile-lives {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .action-buttons,
  .game-logs {
    display: none;
  }

  .mobile-actions {
    display: flex;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 769px) {
  .mobile-actions {
    display: none;
  }
}
</style>
