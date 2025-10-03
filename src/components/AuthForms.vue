<template>
  <form @submit.prevent="onSubmit">
    <button type="button" class="close-form-button" @click="$emit('close')">&#215;</button>
    <h2>{{ mode === 'login' ? 'Logga In' : 'Skapa Konto' }}</h2>

    <div class="input-box">
      <input type="email" v-model="email" placeholder="E-post" required />
      <i class="bx bxs-envelope"></i>
    </div>

    <div class="input-box">
      <input type="password" v-model="password" placeholder="Lösenord" required />
      <i class="bx bx-lock"></i>
    </div>

    <!-- only show username when signing up -->
    <div class="input-box" v-if="mode === 'signup'">
      <input type="text" v-model="username" placeholder="Användarnamn" maxlength="20" required />
      <i class="bx bx-user"></i>
      <span class="character-counter">{{ username.length }}/20</span>
    </div>

    <div class="input-box" v-if="mode === 'signup'">
      <input type="text" v-model="fullName" placeholder="För och efternamn (Frivillig)" />
      <i class="bx bx-user"></i>
    </div>

    <button type="submit" class="submit-button">
      {{ mode === 'login' ? 'Login' : 'Create Account' }}
    </button>

    <p v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </p>
  </form>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// props: mode = 'login' or 'signup'
const props = defineProps({
  mode: {
    type: String,
    default: 'login',
    validator: (v) => ['login', 'signup', ''].includes(v),
  },
})

// emit close on dismiss and success on successful auth
const emit = defineEmits(['close', 'success'])

// form fields
const email = ref('')
const password = ref('')
const username = ref('')
const fullName = ref('')
const errorMessage = ref('')
const userData = ref(null)

async function onSubmit() {
  console.log('Form submitted:', {
    email: email.value,
    password: password.value,
    username: username.value,
    fullName: fullName.value,
  })
  // basic validation
  if (props.mode === 'signup') {
    if (!username.value || username.value.trim() === '') {
      errorMessage.value = 'Du måste ha ett användarnamn'
      return
    }
    if (username.value.length > 20) {
      errorMessage.value = 'Användarnamnet måste vara 20 tecken eller färre'
      return
    }
    // Call the signUp function from supabase-auth.js
    const meta = { username: username.value, fullName: fullName.value }
    const { data, error } = await authStore.signUp(email.value, password.value, meta)
    if (error) {
      console.error('Signup error:', error)
      errorMessage.value =
        getErrorMessage(error.code) || error.message || 'Kunde inte registrera användare'
      return
    }
    userData.value = data.user
    console.log('User signed up:', userData.value)

    if (!userData.value) {
      errorMessage.value = 'Användarregistrering misslyckades'
      return
    }

    // Create user profile in the database
    const profile = {
      full_name: fullName.value,
      username: username.value,
    }
    const profileError = await authStore.createProfile(profile)
    if (profileError) {
      console.error('Profile creation error:', profileError)
      errorMessage.value = profileError.message || 'Kunde inte skapa profil'
      return
    }

    // Complete the signup process
    await authStore.completeSignup()

    console.log('Signup completed successfully')
    emit('success')
    emit('close') // Close the form after submission
  } else if (props.mode === 'login') {
    // Call the signIn function from supabase-auth.js
    const { data, error } = await authStore.signIn(email.value, password.value)
    if (error) {
      errorMessage.value = error.message
      return
    }
    console.log('Login successful:', data)
    userData.value = data.user
    console.log('User logged in:', userData.value)
    emit('success')
    emit('close') // Close the form after successful login
  } else {
    errorMessage.value = 'Invalid authentication mode'
    return
  }
}

function getErrorMessage(code) {
  const errorMessages = {
    user_already_exists: 'Användaren används redan',
    email_address_invalid: 'Ogiltig e-postadress',
    weak_password: 'Lösenordet är för svagt',
    email_exists: 'E-postadressen används redan',
    same_password: 'Det nya lösenordet måste vara annorlunda än det gamla',
  }
  return errorMessages[code] || null
}
</script>

<style scoped lang="scss">
@use '@/styles/generalGames.scss';

form {
  @extend .form-base;
  max-width: 400px;
  width: 60%;

  h2 {
    text-align: center;
    margin-bottom: 2rem;
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--theme-input-text);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
}

.input-box {
  position: relative;
  margin-bottom: 1.5rem;

  input {
    @extend .form-input;
    padding-left: 3rem; // Space for icon
    margin-bottom: 0; // Override the base margin since we're in input-box
  }

  i {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(129, 199, 132, 0.8);
    font-size: 1.1rem;
    transition: color 0.25s ease;
  }

  &:focus-within i {
    color: rgba(165, 214, 167, 1);
  }

  .character-counter {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(129, 199, 132, 0.7);
    font-size: 0.8rem;
    font-weight: 500;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    transition: color 0.25s ease;
  }

  &:focus-within .character-counter {
    color: rgba(165, 214, 167, 0.9);
  }
}

button {
  @extend .button-base;

  &.submit-button {
    margin-top: 0.5rem;
    box-shadow: 0 4px 15px rgba(27, 94, 32, 0.3);
  }

  &.close-form-button {
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
}

.error-message {
  @extend .error-message;
}

@media (max-width: 480px) {
  form {
    padding: 1rem 1.5rem;
    width: 90%;
  }
  .input-box {
    input {
      padding: 0.5rem 0.5rem 0.5rem 2.5rem;
    }
  }
}
</style>
