<template>
  <!-- Auth Form Overlay -->
  <AuthForms
    v-if="showAuthForm"
    :mode="authMode"
    @close="closeAuthForm"
    @success="handleAuthSuccess"
    class="auth-form"
  />

  <div class="modal-content">
    <h2 v-if="gameOver">{{ getGameOverMessage() }}</h2>
    <p v-if="gameOver">Poäng: {{ score }}</p>
    <p v-if="gameOver">Nivå: {{ level }}</p>
    <p v-if="gameOver">Rader: {{ linesCleared }}</p>

    <!-- Score Save Options (only show when game is over and score > 0) -->
    <div v-if="gameOver && score > 0 && showSaveScore" class="score-save-options">
      <!-- Authenticated User Options -->
      <div v-if="authStore.isAuthed" class="auth-user-options">
        <p class="save-prompt">Spara som {{ authStore.profile?.username || 'Användare' }}?</p>
        <div class="button-group-inline">
          <button @click="dontSaveScore" class="btn-decline">Nej Tack</button>
          <button @click="saveScore" class="btn-save" :disabled="isSubmitting">
            {{ isSubmitting ? 'Sparar...' : 'Spara Poäng!' }}
          </button>
        </div>
      </div>

      <!-- Unauthenticated User Options -->
      <div v-else class="unauth-user-options">
        <p class="save-prompt">Spara din poäng?</p>
        <div class="button-group-inline">
          <button @click="openAuthForm('login')" class="btn-auth">Logga In</button>
          <button @click="openAuthForm('signup')" class="btn-auth">Skapa Konto</button>
          <button @click="showGuestScoreForm" class="btn-guest">Som Gäst</button>
        </div>
        <button @click="dontSaveScore" class="btn-decline-full">Nej Tack</button>
      </div>
    </div>

    <button @click="startGame" class="btn-modal-action">
      {{ gameOver || !gameStarted ? (gameStarted ? 'Spela Igen' : 'Starta Spelet') : 'Fortsätt' }}
    </button>
    <!-- Error State -->
    <div v-if="userMessage" class="user-message">
      {{ userMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>

  <!-- Guest Form Overlay (fixed positioning like auth form) -->
  <div v-if="showGuestForm" class="guest-form-overlay">
    <form @submit.prevent="submitPlayerDetails" class="guest-form-modal">
      <button type="button" class="close-form-button" @click="cancelGuestForm">&#215;</button>
      <h2>Spara som Gäst</h2>
      <p class="score-display">
        Poäng: <span class="score-value">{{ score }}</span>
      </p>

      <label for="playerID-input" class="form-label">
        <abbr title="" data-title="Syns i topplistan för andra.">
          Visningsnamn<span style="color: red">*</span>
        </abbr>
      </label>
      <input
        type="text"
        id="playerID-input"
        v-model="playerID"
        placeholder="Ditt visningsnamn"
        class="form-input"
        required
      />

      <label for="realName-input" class="form-label">
        <abbr
          title=""
          data-title="Ditt namn om du vill vara med i webmästeriets prisutdelning (ej nödvändigt)"
        >
          Fullständigt Namn (Frivilligt)
        </abbr>
      </label>
      <input
        type="text"
        id="realName-input"
        v-model="realName"
        placeholder="För- och efternamn"
        class="form-input"
      />

      <div class="button-group">
        <button type="button" class="submit-button decline" @click="cancelGuestForm">Avbryt</button>
        <button type="submit" class="submit-button primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Sparar...' : 'Spara!' }}
        </button>
      </div>
      <!-- Error State -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </form>
  </div>
</template>

<script setup lang="js">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AuthForms from '@/components/AuthForms.vue'
import { submitScore } from '@/components/kfkblock/kfkblockTopscores.js'

const authStore = useAuthStore()

const props = defineProps({
  score: {
    type: Number,
    required: true,
  },
  level: {
    type: Number,
    required: true,
  },
  linesCleared: {
    type: Number,
    required: true,
  },
  gameData: {
    type: Object,
    required: true,
    validator: (value) => {
      return (
        value &&
        typeof value.blocksUsed === 'number' &&
        typeof value.level === 'number' &&
        typeof value.levelClearedRows === 'number'
      )
    },
  },
  gameOver: {
    type: Boolean,
    default: false,
  },
  gameStarted: {
    type: Boolean,
    default: false,
  },
})

const playerID = ref('')
const realName = ref('')
const showGuestForm = ref(false) // Start with guest form hidden
const showAddPlayerForm = ref(false) // Control the "add player" button flow
const showAuthForm = ref(false)
const showSaveScore = ref(true)
const authMode = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const userMessage = ref('') // General user messages (e.g. "Saved!")
const staticGameOverMessage = ref('') // Store the static message once generated

const emit = defineEmits(['close', 'startGame', 'updateLeaderboard'])

// Game over messages based on score (moved from parent component)
const gameOverMessages = {
  2000: ['Det var inget vidare', 'Klassisk kugg', 'Ge upp'],
  5000: ['Nästan godkänt', 'Det är ett U', 'Kan granskas'],
  10000: ['Limes', 'Du hade fått en 3a'],
  15000: ['Helt ok', 'Granska till 4a'],
  20000: ['Respektabel 4a'],
  30000: ['Nästan en femma'],
  40000: ['Imponerande', 'Bättre kan du'],
  50000: ['Sök webmästeriet', 'Kämpa', 'Du är sämst'],
}

function getGameOverMessage() {
  if (!props.gameOver) return ''

  // If we already have a static message, return it
  if (staticGameOverMessage.value) {
    return staticGameOverMessage.value
  }

  // Generate the message once and store it
  let message = 'Game Over'
  for (let threshold in gameOverMessages) {
    if (props.score <= threshold) {
      const messages = gameOverMessages[threshold]
      message = messages[Math.floor(Math.random() * messages.length)]
      break
    }
  }

  staticGameOverMessage.value = message
  return message
}

function startGame() {
  emit('startGame')
}

function dontSaveScore() {
  // User chose not to save score, close the entire modal
  console.log('User chose not to save score')
  showSaveScore.value = false
}

async function saveScore() {
  console.log('Saving score for authenticated user...')
  isSubmitting.value = true
  userMessage.value = ''
  errorMessage.value = ''

  const otherData = {
    block: props.gameData.blocksUsed - 1,
    level: props.level,
    levelClearedRows: props.gameData.levelClearedRows,
  }

  const displayName = authStore.profile?.username || authStore.user?.email || 'Authenticated User'
  const fullName = authStore.profile?.full_name || null

  const dataToSend = {
    playerID: displayName,
    RealName: fullName,
    Score: props.score,
    Other: otherData,
    Key: calculateKey({ ...otherData, score: props.score }),
  }

  try {
    const data = await submitScore(dataToSend)
    if (data.cheat) {
      errorMessage.value = data.message || 'Poängen kunde inte verifieras'
    }

    if (data) {
      console.log('Score saved successfully:', data)
      isSubmitting.value = false
      emit('updateLeaderboard', data) // Notify parent to refresh leaderboard
      showSaveScore.value = false // Close the modal after saving
      userMessage.value = 'Sparad!'
    } else {
      console.error('Failed to save score:', data)
      // Could show an error message here
    }
  } catch (error) {
    console.error('Error saving score:', error)
  }
}

function cancelGuestForm() {
  showGuestForm.value = false
  showAddPlayerForm.value = false
  emit('close')
}

function openAuthForm(mode) {
  authMode.value = mode
  showAuthForm.value = true
}

function showGuestScoreForm() {
  showAddPlayerForm.value = true
  showGuestForm.value = true
}

function closeAuthForm() {
  showAuthForm.value = false
  authMode.value = ''
  // Don't close the entire modal, just the auth form
}

function handleAuthSuccess() {
  // User successfully authenticated, close auth form and they can now save their score
  closeAuthForm()
  // The reactive auth state will automatically update the UI to show the authenticated options
}

function calculateKey(otherData) {
  return otherData.score + otherData.block ** 2 + otherData.levelClearedRows * 3 - 7
}

async function submitPlayerDetails(event) {
  if (event) event.preventDefault()

  if (isSubmitting.value) return

  console.log('Submitting player details...')
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const otherData = {
      block: props.gameData.blocksUsed - 1, // Total blocks placed (subtract 1 as in original)
      level: props.gameData.level, // Level reached
      levelClearedRows: props.gameData.levelClearedRows, // Rows cleared at current level
    }

    // Use guest form data
    if (!playerID.value.trim()) {
      errorMessage.value = 'Visningsnamn är obligatoriskt'
      isSubmitting.value = false
      return
    }

    const displayName = playerID.value.trim()
    const fullName = realName.value.trim() || null

    const dataToSend = {
      playerID: displayName,
      RealName: fullName,
      Score: props.score,
      Other: otherData,
      Key: calculateKey({ ...otherData, score: props.score }),
    }

    console.log('Sending data to API:', dataToSend)

    const data = await submitScore(dataToSend)

    if (data.cheat) {
      errorMessage.value = data.message || 'Poängen kunde inte verifieras'
    }
    if (data) {
      console.log('Score saved successfully:', data)
      emit('updateLeaderboard', data) // Notify parent to refresh leaderboard
    } else {
      console.error('Failed to save score:', data)
      // Could show an error message here
    }

    // Success! Close the form
    showGuestForm.value = false
    showAddPlayerForm.value = false
    emit('close')
  } catch (error) {
    console.error('Error submitting player details:', error)
    errorMessage.value = 'Nätverksfel - försök igen senare'
  } finally {
    isSubmitting.value = false
  }
}

// Watch for game state changes to reset static message
watch(
  () => props.gameStarted,
  (newStarted, oldStarted) => {
    // Reset static message when starting a new game
    if (newStarted && !oldStarted) {
      staticGameOverMessage.value = ''
    }
  },
)

watch(
  () => props.gameOver,
  (newGameOver) => {
    // Reset static message when game over becomes false (new game)
    if (!newGameOver) {
      staticGameOverMessage.value = ''
    }
  },
)
</script>

<style scoped lang="scss">
@use '@/styles/generalGames.scss';
@use '@/components/kfkblock/style.scss';

.guest-form-overlay {
  position: fixed;
  top: calc(50% + 1.5rem);
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
  max-width: 400px;
  width: 60%;
}

.guest-form-modal {
  @extend .form-base;
  color: var(--theme-input-text);
  position: relative;

  h2 {
    text-align: center;
    margin-bottom: 1.5rem;
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--theme-input-text);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
}

.score-display {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  color: var(--theme-input-text);

  .score-value {
    font-weight: bold;
    font-size: 1.3rem;
    color: var(--theme-modal-header);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
}

.form-label {
  @extend .form-label;
}

.form-input {
  @extend .form-input;
}

.submit-button {
  @extend .button-base;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
}

.button-group {
  @extend .button-group;
}

.close-form-button {
  @extend .button-base;
  padding: 0.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  border-radius: 50%;
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--theme-button-decline-bg);
  border-color: var(--theme-button-decline-border);
  box-shadow: 0 2px 10px rgba(244, 67, 54, 0.3);

  &:hover {
    transform: translateY(-1px) scale(1.05);
    background: rgba(244, 67, 54, 1);
    box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4);
  }

  &:active {
    transform: translateY(0) scale(0.95);
  }
}

.error-message {
  @extend .error-message;
}

.user-message {
  @extend .error-message;
  color: var(--theme-input-text);
  background: var(--theme-input-bg);
  border: var(--theme-input-border);
}

// Responsive design
@media (max-width: 480px) {
  .guest-form-overlay {
    padding: 1rem 1.5rem;
    width: 90%;
    h2 {
      font-size: 1.2rem;
    }
    p,
    span {
      font-size: 0.9rem;
    }
    label {
      font-size: 0.8rem;
    }
    input {
      padding: 0.5rem 0.5rem 0.5rem 0.5rem;
    }
  }
  .modal-content {
    padding: 1rem;
    h2 {
      font-size: 1.2rem;
    }
    p {
      font-size: 1rem;
    }
    .btn-modal-action {
      font-size: 0.9rem;
      padding: 0.3rem 1rem;
    }
  }
  .guest-form-modal {
    padding: 1.5rem 1rem;
    width: 90%;
  }

  .button-group {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
