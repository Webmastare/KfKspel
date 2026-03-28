<template>
  <div class="outer-wrapper">
    <Navbar
      v-if="!hideNavbarRoutes.includes($route.name)"
      class="navbar"
      @updateAuthMode="authMode = $event"
    />
    <Auth class="auth-form" v-show="authMode !== ''" :mode="authMode" @close="authMode = ''" />
    <div id="inner-app">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Navbar from './components/Navbar.vue'
import Auth from '@/components/AuthForms.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const authMode = ref('') // 'login', 'signup', or ''

// Define routes where the navbar should be hidden
const hideNavbarRoutes = ['OrdelEmbed']

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
  background-color: var(--theme-bg-primary);
}

.outer-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

#inner-app {
  position: relative;
  width: 100%;
  /*height: calc(100vh - 3rem);*/
  margin-top: 3rem; /* Push content down by navbar height */
  background-color: var(--theme-bg-primary);
}

#inner-app.no-navbar {
  height: 100vh;
  margin-top: 0; /* Remove navbar margin when navbar is hidden */
}
</style>
