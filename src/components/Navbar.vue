<template>
  <nav>
    <router-link to="/">Hem</router-link>
    <router-link to="/feedback">💭 Feedback</router-link>

    <!-- User Menu -->
    <div class="user-menu" @mouseenter="showUserMenu = true" @mouseleave="showUserMenu = false">
      <button class="user-icon-button">
        <img src="/icons/user-icon.svg" alt="User Menu" class="user-icon" />
      </button>

      <div class="user-dropdown" :class="{ show: showUserMenu }">
        <!-- Theme Toggle (always visible) -->
        <div class="theme-toggle-section">
          <button @click="themeStore.toggleTheme()" class="theme-toggle-btn">
            <span class="theme-icon">{{ themeStore.isDarkMode ? '☀️' : '🌙' }}</span>
            <span class="theme-text">{{
              themeStore.isDarkMode ? 'Ljust läge' : 'Mörkt läge'
            }}</span>
          </button>
        </div>

        <!-- User Section -->
        <div v-if="authStore.isAuthed" class="user-greeting">
          <p>Välkommen, {{ authStore.profile?.username || 'Användare' }}!</p>
        </div>
        <div v-else class="user-options">
          <button @click="((authMode = setAuthMode('login')), (showUserMenu = false))">
            Logga In
          </button>
          <button @click="((authMode = setAuthMode('signup')), (showUserMenu = false))">
            Skapa Konto
          </button>
        </div>
        <div v-if="authStore.isAuthed" class="user-options">
          <button @click="(authStore.signOut(), (showUserMenu = false))">Logga Ut</button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const authStore = useAuthStore()
const themeStore = useThemeStore()

const authMode = ref('') // 'login', 'signup', or ''
const showUserMenu = ref(false) // Controls visibility of user dropdown

const emit = defineEmits(['updateAuthMode'])

function setAuthMode(mode) {
  authMode.value = mode
  // Emit event to parent component (App.vue) to update authMode there
  emit('updateAuthMode', mode)
}
</script>

<style scoped lang="scss">
nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  height: 3rem;
  justify-content: space-around;
  align-items: center;
  padding: 0.5rem 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(34, 60, 46, 0.85) 0%,
    rgba(20, 40, 28, 0.5) 50%,
    rgba(34, 60, 46, 0.85) 100%
  );
  backdrop-filter: blur(15px);
  border-bottom: 1px solid rgba(76, 175, 80, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10000;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(46, 125, 50, 0.1) 0%,
      rgba(27, 94, 32, 0.15) 50%,
      rgba(56, 142, 60, 0.1) 100%
    );
    opacity: 0.8;
    z-index: -1;
  }
}

a {
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  color: rgba(200, 230, 201, 0.95);
  padding: 0.3rem 1rem;
  border-radius: 12px;
  background: rgba(76, 175, 80, 0.15);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(76, 175, 80, 0.25);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(129, 199, 132, 0.2), transparent);
    transition: left 0.4s ease;
  }

  &:hover {
    transform: translateY(-1px) scale(1.02);
    background: rgba(76, 175, 80, 0.25);
    border-color: rgba(129, 199, 132, 0.5);
    box-shadow: 0 4px 15px rgba(27, 94, 32, 0.3);
    color: rgba(232, 245, 233, 1);

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }
}

/* User Menu Styles */
.user-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.user-icon-button {
  background: rgba(76, 175, 80, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(76, 175, 80, 0.3);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 50%;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);

  &:hover {
    background: rgba(76, 175, 80, 0.3);
    border-color: rgba(129, 199, 132, 0.5);
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 4px 15px rgba(27, 94, 32, 0.25);
  }

  &:active {
    transform: translateY(0) scale(0.95);
  }

  .user-icon {
    width: 24px;
    height: 24px;
    display: block;
    filter: brightness(0) saturate(100%) invert(88%) sepia(8%) saturate(1207%) hue-rotate(66deg)
      brightness(97%) contrast(89%);
    opacity: 0.9;
  }
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  background: rgba(34, 60, 46, 0.95);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 15px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px) scale(0.95);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow: hidden;

  &.show {
    opacity: 1;
    visibility: visible;
    transform: translateY(0) scale(1);
  }
}

.theme-toggle-section {
  padding: 0.6rem;
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  background: rgba(76, 175, 80, 0.05);
}

.theme-toggle-btn {
  width: 100%;
  padding: 0.6rem 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  background: rgba(76, 175, 80, 0.15);
  color: rgba(200, 230, 201, 0.95);
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(129, 199, 132, 0.15), transparent);
    transition: left 0.4s ease;
  }

  &:hover {
    background: rgba(76, 175, 80, 0.25);
    border-color: rgba(129, 199, 132, 0.4);
    transform: translateX(3px);
    box-shadow: 0 2px 10px rgba(27, 94, 32, 0.2);

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateX(2px) scale(0.98);
  }

  .theme-icon {
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .theme-text {
    flex: 1;
    text-align: left;
  }
}

.user-greeting {
  padding: 1rem;
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  background: rgba(76, 175, 80, 0.1);

  p {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(200, 230, 201, 0.95);
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
}

.user-options {
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  button {
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    font-weight: 500;
    background: rgba(76, 175, 80, 0.15);
    color: rgba(200, 230, 201, 0.95);
    border: 1px solid rgba(76, 175, 80, 0.2);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(129, 199, 132, 0.15), transparent);
      transition: left 0.4s ease;
    }

    &:hover {
      background: rgba(76, 175, 80, 0.25);
      border-color: rgba(129, 199, 132, 0.4);
      transform: translateX(3px);
      box-shadow: 0 2px 10px rgba(27, 94, 32, 0.2);

      &::before {
        left: 100%;
      }
    }

    &:active {
      transform: translateX(2px) scale(0.98);
    }

    &:last-child {
      color: rgba(244, 67, 54, 0.9);
      border-color: rgba(244, 67, 54, 0.3);
      background: rgba(244, 67, 54, 0.1);

      &:hover {
        background: rgba(244, 67, 54, 0.2);
        border-color: rgba(244, 67, 54, 0.5);
        color: #ff6b6b;
      }
    }
  }
}
</style>
