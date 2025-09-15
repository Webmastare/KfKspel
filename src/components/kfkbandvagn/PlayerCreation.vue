<template>
  <!-- Single root container for both auth and player creation states -->
  <div class="player-creation-container">
    <!-- Auth Form State -->
    <AuthForms
      v-if="showAuthForm"
      :mode="authMode"
      @close="closeAuthForm"
      @success="handleAuthSuccess"
      class="auth-form"
    />

    <!-- Player Creation Form State -->
    <div v-else class="modal-overlay">
      <div class="modal-content">
        <div class="form-base player-creation-form">
          <button type="button" class="close-form-button" @click="closeModal">&#215;</button>

          <h2>Skapa din Bandvagn</h2>

          <!-- User greeting -->
          <div v-if="authStore.isAuthed" class="user-greeting">
            <p>Hej {{ authStore.profile?.username || authStore.user?.email }}!</p>
            <p>Skapa din bandvagn för att börja spela.</p>
          </div>

          <!-- Not authenticated -->
          <div v-else class="auth-prompt">
            <p>Du behöver vara inloggad för att spela KfKbandvagn.</p>
            <div class="button-group auth-buttons">
              <button @click="openAuthForm('login')" class="button-base">Logga In</button>
              <button @click="openAuthForm('signup')" class="button-base">Skapa Konto</button>
            </div>
          </div>

          <!-- Player creation form (only show if authenticated) -->
          <form v-if="authStore.isAuthed" @submit.prevent="handleSubmit" class="creation-form">
            <!-- Player Name -->
            <div class="form-group">
              <label for="playerID" class="form-label">Spelarnamn</label>
              <input
                v-model="playerID"
                type="text"
                id="playerID"
                class="form-input"
                placeholder="Ange ditt spelarnamn"
                :disabled="isSubmitting"
                required
                minlength="2"
                maxlength="20"
              />
              <small class="input-help">2-20 tecken, inga specialtecken</small>
            </div>

            <!-- Color Picker -->
            <div class="form-group">
              <label for="playerColor" class="form-label">Bandvagnsfärg</label>
              <div class="color-picker-container">
                <input
                  v-model="playerColor"
                  type="color"
                  id="playerColor"
                  class="color-input"
                  :disabled="isSubmitting"
                />
                <div class="color-preview" :style="{ backgroundColor: playerColor }"></div>
                <span class="color-value">{{ playerColor }}</span>
                <button
                  type="button"
                  class="random-color-btn"
                  @click="generateRandomColor"
                  :disabled="isSubmitting"
                  title="Slumpa färg"
                >
                  🎲
                </button>
              </div>
              <small class="input-help">Välj en färg för din bandvagn eller slumpa en</small>
            </div>

            <!-- Preset Colors -->
            <div class="preset-colors">
              <label class="form-label">Förvalda färger:</label>
              <div class="color-presets">
                <button
                  v-for="color in presetColors"
                  :key="color"
                  type="button"
                  class="preset-color-btn"
                  :class="{ active: playerColor === color }"
                  :style="{ backgroundColor: color }"
                  @click="playerColor = color"
                  :disabled="isSubmitting"
                ></button>
              </div>
            </div>

            <!-- Error display -->
            <div v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>

            <!-- Loading state -->
            <div v-if="isSubmitting" class="loading-state">
              <div class="loading-spinner">⏳</div>
              <p>Skapar din bandvagn...</p>
            </div>

            <!-- Submit button -->
            <div class="button-group" v-if="!isSubmitting">
              <button type="button" @click="closeModal" class="button-base decline">Avbryt</button>
              <button type="submit" class="button-base">Skapa Bandvagn</button>
            </div>
          </form>

          <!-- Existing player check -->
          <div v-if="authStore.isAuthed && showExistingPlayerOption" class="existing-player-option">
            <hr class="divider" />
            <p>Eller om du redan har en bandvagn:</p>
            <button @click="tryLoginExistingPlayer" class="button-base" :disabled="isSubmitting">
              Logga in befintlig spelare
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBandvagnStore } from '@/stores/bandvagnState'
import { formatAPIError } from '@/composables/kfkbandvagn/apiHandler'
import AuthForms from '@/components/AuthForms.vue'

// Stores
const authStore = useAuthStore()
const gameStore = useBandvagnStore()

// Form state
const playerID = ref('')
const playerColor = ref('#4CAF50') // Default green
const isSubmitting = ref(false)
const errorMessage = ref('')
const showAuthForm = ref(false)
const authMode = ref('')
const showExistingPlayerOption = ref(true)

// Preset colors for easy selection
const presetColors = [
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FF5722', // Red
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#607D8B', // Blue Grey
  '#795548', // Brown
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#8BC34A', // Light Green
  '#FFC107', // Amber
  '#3F51B5', // Indigo
]

// Events
const emit = defineEmits(['close', 'playerCreated'])

// Auth form handling
function openAuthForm(mode) {
  authMode.value = mode
  showAuthForm.value = true
}

function closeAuthForm() {
  showAuthForm.value = false
  authMode.value = ''
}

function handleAuthSuccess() {
  showAuthForm.value = false
  authMode.value = ''
  // Refresh to show player creation form
  authStore.fetchProfile()
}

// Form validation
const isFormValid = computed(() => {
  return (
    playerID.value.length >= 2 &&
    playerID.value.length <= 20 &&
    /^[a-zA-Z0-9åäöÅÄÖ\s\-_.]*$/.test(playerID.value) &&
    /^#[0-9A-Fa-f]{6}$/.test(playerColor.value)
  )
})

// Form submission
async function handleSubmit() {
  if (!isFormValid.value) {
    errorMessage.value = 'Kontrollera att alla fält är korrekt ifyllda'
    return
  }

  if (!authStore.isAuthed) {
    errorMessage.value = 'Du måste vara inloggad för att skapa en spelare'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    // Create the player
    await gameStore.createPlayer({
      playerID: playerID.value.trim(),
      color: playerColor.value,
    })

    console.log('Player created successfully')
    emit('playerCreated')
  } catch (error) {
    console.error('Failed to create player:', error)
    errorMessage.value = formatAPIError(error)
  } finally {
    isSubmitting.value = false
  }
}

// Try to login existing player
async function tryLoginExistingPlayer() {
  if (!authStore.isAuthed) {
    errorMessage.value = 'Du måste vara inloggad'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await gameStore.loginPlayer()
    console.log('Player logged in successfully')
    emit('playerCreated')
  } catch (error) {
    console.error('Failed to login existing player:', error)
    errorMessage.value = formatAPIError(error)

    // If no player found, hide the login option
    if (error.code === 'no_player_found') {
      showExistingPlayerOption.value = false
    }
  } finally {
    isSubmitting.value = false
  }
}

// Modal controls
function closeModal() {
  emit('close')
}

// Generate random color
function generateRandomColor() {
  const colors = presetColors
  const randomIndex = Math.floor(Math.random() * colors.length)
  playerColor.value = colors[randomIndex]
}

// Initialize
onMounted(() => {
  // Set a random default color
  generateRandomColor()

  // Generate a suggested player name based on user data
  if (authStore.isAuthed && authStore.profile?.username) {
    playerID.value = authStore.profile.username
  } else if (authStore.user?.email) {
    // Use part of email as suggestion
    const emailUsername = authStore.user.email.split('@')[0]
    playerID.value = emailUsername.substring(0, 15) // Limit length
  }
})
</script>

<style scoped lang="scss">
/* Use shared form styles */
@use '@/styles/generalGames.scss';

// Modal overlay to center the form like auth form
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.player-creation-form {
  max-width: 500px;
  position: relative;
}

.close-form-button {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-color);
  opacity: 0.7;
  transition: opacity 0.2s;
  z-index: 1;

  &:hover {
    opacity: 1;
  }
}

.user-greeting {
  text-align: center;
  margin-bottom: 2rem;
  color: var(--input-text);

  p:first-child {
    font-size: 1.2em;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
}

.auth-prompt {
  text-align: center;
  margin-bottom: 2rem;

  p {
    margin-bottom: 1.5rem;
    color: var(--input-text);
  }
}

.creation-form {
  margin-top: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.input-help {
  display: block;
  font-size: 0.85rem;
  color: var(--input-placeholder);
  margin-top: 0.25rem;
  font-style: italic;
}

/* Color picker styles */
.color-picker-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 0.5rem;
}

.color-input {
  width: 50px;
  height: 50px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  cursor: pointer;
  background: none;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

.color-preview {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--input-border);
}

.color-value {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--input-text);
  background: var(--input-bg);
  padding: 4px 8px;
  border-radius: 4px;
}

.random-color-btn {
  width: 40px;
  height: 40px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: scale(1.05);
    border-color: var(--modal-header-color);
    background: var(--modal-header-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Preset colors */
.preset-colors {
  margin-bottom: 1.5rem;
}

.color-presets {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 0.5rem;
}

.preset-color-btn {
  width: 40px;
  height: 40px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    transform: scale(1.1);
    border-color: var(--modal-header-color);
  }

  &.active {
    border-color: var(--modal-header-color);
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.4);

    &::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
    }
  }
}

.existing-player-option {
  margin-top: 2rem;
  text-align: center;

  p {
    color: var(--input-text);
    margin-bottom: 1rem;
    font-style: italic;
  }
}

.divider {
  border: none;
  height: 1px;
  background: var(--input-border);
  margin: 1.5rem 0;
}

/* Loading state */
.loading-state {
  text-align: center;
  margin: 2rem 0;
}

.loading-spinner {
  font-size: 2rem;
  margin-bottom: 1rem;
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

/* Responsive */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 0 10px;
  }

  .player-creation-form {
    max-width: none;
  }

  .color-presets {
    grid-template-columns: repeat(4, 1fr);
  }

  .preset-color-btn {
    width: 35px;
    height: 35px;
  }
}
</style>
