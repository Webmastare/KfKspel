<template>
  <Navbar class="navbar" @updateAuthMode="authMode = $event" />
  <Auth class="auth-form" v-show="authMode !== ''" :mode="authMode" @close="authMode = ''" />
  <div id="app">
    <RouterView />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Navbar from './components/Navbar.vue'
import Auth from '@/components/AuthForms.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const authMode = ref('') // 'login', 'signup', or ''

// Initialize stores
const authStore = useAuthStore()
const themeStore = useThemeStore()

// Listen for visibility change
document.addEventListener('visibilitychange', async () => {
  console.log('Document visibility changed:', document.visibilityState)
  if (document.visibilityState === 'visible' && authStore.isAuthed) {
    // Refresh the session to ensure tokens are valid
    const { data, error } = await authStore.refreshSession()
    if (error) {
      console.warn('Session refresh failed:', error)
    } else {
      console.log('Session refreshed successfully')
    }
  }
})

onMounted(async () => {
  // Initialize theme system first
  themeStore.init()

  // Clean up old theme storage from individual games
  themeStore.cleanupOldThemeStorage()
})
</script>

<style>
@import '@/styles/generalGames.scss';

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  background-color: black;
}

#app {
  width: 100%;
  height: 100vh;
  padding-top: 1.5rem; /* Push content down by navbar height */
}
</style>
