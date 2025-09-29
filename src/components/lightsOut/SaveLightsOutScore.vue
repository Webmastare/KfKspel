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
    <h2 v-if="gameOver">Bra kämpat!</h2>
    <h3 v-if="gameOver">Spara dina poäng?</h3>
    <p v-if="gameOver">Poäng: {{ score }}</p>
    <p v-if="gameOver">Klickar: {{ clicks }}</p>
    <p v-if="gameOver">Seed: {{ seed }}</p>

    <div v-if="gameOver && score > 0 && showSaveScore" class="score-save-options">
      <div v-if="authStore.isAuthed" class="auth-user-options">
        <p class="save-prompt">Spara som {{ authStore.profile?.username || 'Användare' }}?</p>
        <div class="button-group-inline">
          <button @click="dontSaveScore" class="btn-decline">Nej Tack</button>
          <button @click="saveScore" class="btn-save">Spara Poäng</button>
        </div>
      </div>

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

    <button @click="$emit('close')" class="btn-modal-action">Stäng</button>
  </div>

  <!-- Guest Form Overlay -->
  <div v-if="showGuestForm" class="guest-form-overlay">
    <form @submit.prevent="submitPlayerDetails" class="guest-form-modal">
      <button type="button" class="close-form-button" @click="cancelGuestForm">&#215;</button>
      <h2>Spara som Gäst</h2>

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

      <div class="button-group">
        <button type="button" class="submit-button decline" @click="cancelGuestForm">Avbryt</button>
        <button type="submit" class="submit-button primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Sparar...' : 'Spara!' }}
        </button>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AuthForms from '@/components/AuthForms.vue'
import { submitLightsOutScore } from '@/components/lightsOut/lightsoutScores'

const authStore = useAuthStore()

const props = defineProps<{ score: number; clicks: number; seed: string; gameOver: boolean }>()

const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const playerID = ref('')
const showGuestForm = ref(false)
const showAuthForm = ref(false)
const showSaveScore = ref(true)
const authMode = ref<'login' | 'signup' | ''>('')
const isSubmitting = ref(false)
const errorMessage = ref('')

function dontSaveScore() {
  showSaveScore.value = false
}

async function saveScore() {
  try {
    const displayName = authStore.profile?.username || authStore.user?.email || 'User'
    await submitLightsOutScore({
      playerID: displayName,
      score: props.score,
      clicks: props.clicks,
      seed: props.seed,
    })
    emit('saved')
    emit('close')
  } catch (e) {
    errorMessage.value = 'Kunde inte spara poäng'
  }
}

function openAuthForm(mode: 'login' | 'signup') {
  authMode.value = mode
  showAuthForm.value = true
}
function closeAuthForm() {
  showAuthForm.value = false
  authMode.value = ''
}
function handleAuthSuccess() {
  closeAuthForm()
}
function showGuestScoreForm() {
  showGuestForm.value = true
}
function cancelGuestForm() {
  showGuestForm.value = false
}

async function submitPlayerDetails() {
  if (isSubmitting.value) return
  if (!playerID.value.trim()) {
    errorMessage.value = 'Visningsnamn är obligatoriskt'
    return
  }
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await submitLightsOutScore({
      playerID: playerID.value.trim(),
      score: props.score,
      clicks: props.clicks,
      seed: props.seed,
    })
    emit('saved')
    emit('close')
  } catch (e) {
    errorMessage.value = 'Nätverksfel - försök igen senare'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/generalGames.scss';
@use '@/components/kfkblock/style.scss';

.modal-content {
  @extend .modal-content;
  width: 60%;
  max-width: 500px;

  h2 {
    margin-bottom: 0.25rem;
  }
  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-weight: normal;
    color: var(--theme-text-secondary);
  }
  p {
    margin: 0.25rem 0;
  }
}

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
}

.form-label {
  @extend .form-label;
}
.form-input {
  @extend .form-input;
}
.submit-button {
  @extend .button-base;
}
.button-group {
  @extend .button-group;
}
.close-form-button {
  @extend .button-base;
}
.error-message {
  @extend .error-message;
}
</style>
