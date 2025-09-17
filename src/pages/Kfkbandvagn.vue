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
                <span class="player-meta"
                  >❤ {{ p.lives }} · ➶ {{ p.range }} · ⛁ {{ p.tokens }}</span
                >
              </li>
            </ul>
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
            Köp Räckvidd <br />
            (3 tokens)
          </button>
          <button
            @click="showUpgradeModal('life')"
            class="action-btn"
            :disabled="currentPlayer.tokens < 3"
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
const infoShown = ref(false)
const showStats = ref(false)
const showPlayerModal = ref(false)
const showUpgradeDialog = ref(false)
const upgradeType = ref('')
const isMobile = ref(false)

// Computed
const currentPlayer = computed(() => gameStore.currentPlayer)
const allPlayers = computed(() => gameStore.allPlayers)
const boardData = computed(() => gameStore.boardData)
const isLoading = computed(() => gameStore.isLoading)
const gameInitialized = computed(() => gameStore.initialized && currentPlayer.value)

// Only show players that have an active tank and are alive (or show all if desired)
const playersToShow = computed(() =>
  allPlayers.value
    .filter((p) => p.taken_tank)
    .map((p) => ({
      ...p,
      distToCurrent: currentPlayer.value
        ? Math.abs(p.position.row - currentPlayer.value.position.row) +
          Math.abs(p.position.column - currentPlayer.value.position.column)
        : Infinity,
    })),
)

const recentLogs = computed(() => {
  if (!boardData.value?.logs) return []
  return boardData.value.logs.slice(-10).reverse()
})

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

async function handleActionPerformed(action) {
  try {
    await gameStore.performAction(action)
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

.players-list {
  li {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 10px;
  }
}
</style>
