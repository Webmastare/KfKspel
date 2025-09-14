<template>
  <div class="landing-page" :class="{ 'dark-mode': isDarkTheme }">
    <!-- Theme Toggle -->
    <div class="theme-toggle">
      <label class="toggle-switch">
        <input type="checkbox" v-model="isDarkTheme" />
        <span class="slider">
          <span class="toggle-icon">{{ isDarkTheme ? '🌙' : '☀️' }}</span>
        </span>
      </label>
    </div>
    <!-- Background Snake Game -->
    <div class="background-game">
      <HamiltonianSnake
        :auto-start="true"
        :fps="snakeFps"
        :visual-cycle="visualizationOptions.cycle"
        :visual-path="visualizationOptions.path"
        :show-generation="visualizationOptions.generation"
        :generation-delay="10"
        :debug-mode="debugMode"
      />
    </div>

    <!-- Overlay Content -->
    <div class="overlay-content" :style="{ display: showWelcomeCard ? '' : 'none' }">
      <div class="welcome-card" v-if="showWelcomeCard">
        <h1 class="title">Välkommen till KfKSpel</h1>
        <p class="subtitle">
          Välkommen till spelhörnan! Här kommer det upp något nytt spel ibland när någon i
          webmästeriet pallar. Har du förslag eller är intresserad av att hjälpa till? Sök
          webmästeriet!
        </p>
        <p class="subtitle">Tips: Logga in för att spara dina framsteg!</p>
        <div class="game-grid">
          <div class="game-card">
            <h3>2048</h3>
            <router-link to="/2048" class="play-btn">Spela</router-link>
          </div>
          <div class="game-card">
            <h3>Minesweeper</h3>
            <router-link to="/minesweeper" class="play-btn">Spela</router-link>
          </div>
          <div class="game-card">
            <h3>KfKblock</h3>
            <router-link to="/kfkblock" class="play-btn">Spela</router-link>
          </div>
          <div class="game-card">
            <h3>KfKbandvagn</h3>
            <router-link to="/kfkbandvagn" class="play-btn">Spela</router-link>
          </div>
          <div class="game-card">
            <h3>Snake</h3>
            <router-link to="/snake" class="play-btn">Spela</router-link>
          </div>

          <div class="game-card special">
            <h3>Hamiltonian Snake</h3>
            <button class="play-btn" @click="toggleSnakeView">
              {{ !showSnakeDetails ? 'Visa Detaljer' : 'Dölj Detaljer' }}
            </button>
          </div>
        </div>

        <div v-if="showSnakeDetails" class="snake-info">
          <div class="snake-controls">
            <button
              @click="toggleVisualization('cycle')"
              :class="{ active: visualizationOptions.cycle }"
            >
              Show Hamiltonian Cycle
            </button>
            <button
              @click="toggleVisualization('path')"
              :class="{ active: visualizationOptions.path }"
            >
              Show Snake Path
            </button>
            <button
              @click="toggleVisualization('generation')"
              :class="{ active: visualizationOptions.generation }"
            >
              Show Generation Process
            </button>
            <button @click="debugMode = !debugMode" :class="{ active: debugMode, debug: true }">
              Shortcuts Info
            </button>
            <div class="fps-control">
              <label for="fps">Snake Speed (FPS): </label>
              <input
                type="range"
                name="fps"
                id="fps"
                min="1"
                max="1000"
                v-model.number="snakeFps"
                class="fps-slider"
              />
              <span class="fps-value">{{ snakeFps }} FPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Hide Overlay to show only the game -->
    <button class="close-btn" @click="showWelcomeCard = !showWelcomeCard">x</button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import HamiltonianSnake from '@/components/HamiltonianSnake.vue'

const router = useRouter()

const showSnakeDetails = ref(false)
const snakeFps = ref(10) // Adjusted FPS for smoother animation
const debugMode = ref(false)
const visualizationOptions = reactive({
  cycle: false,
  path: false,
  generation: false,
})
const showWelcomeCard = ref(true)

// Dark mode detection from system preference
const isDarkTheme = ref(
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
)

// Listen for system theme changes
onMounted(() => {
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeChange = (e: MediaQueryListEvent) => {
      isDarkTheme.value = e.matches
    }
    mediaQuery.addEventListener('change', handleThemeChange)

    // Clean up listener on unmount
    onUnmounted(() => {
      mediaQuery.removeEventListener('change', handleThemeChange)
    })
  }
})

function toggleSnakeView() {
  showSnakeDetails.value = !showSnakeDetails.value
}

function toggleVisualization(type: 'cycle' | 'path' | 'generation') {
  visualizationOptions[type] = !visualizationOptions[type]
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as *;

.landing-page {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  background: var(--bg-primary);
  transition: background 0.3s ease;

  // Light mode colors (default)
  --bg-primary: #dfe0e0;
  --bg-secondary: rgba(223, 223, 223, 0.9);
  --bg-card: rgba(214, 212, 212, 0.95);
  --bg-card-hover: rgba(223, 223, 223, 0.98);
  --text-primary: #2c3e50;
  --text-secondary: #6c757d;
  --text-accent: #1c1c1c;
  --border-color: rgba(0, 0, 0, 0.1);
  --shadow-color: rgba(0, 0, 0, 0.1);
  --button-bg: rgba(255, 255, 255, 0.2);
  --button-hover: rgba(255, 255, 255, 0.3);
  --control-bg: rgba(255, 255, 255, 0.6);
  --control-text: #333;
  --overlay-bg: rgba(255, 255, 255, 0.05);

  // Dark mode colors
  &.dark-mode {
    --bg-primary: #1a1a1a;
    --bg-secondary: rgba(30, 30, 30, 0.9);
    --bg-card: rgba(40, 40, 40, 0.95);
    --bg-card-hover: rgba(50, 50, 50, 0.98);
    --text-primary: #c2c5c8;
    --text-secondary: #adb5bd;
    --text-accent: #ced4da;
    --border-color: rgba(255, 255, 255, 0.1);
    --shadow-color: rgba(0, 0, 0, 0.3);
    --button-bg: rgba(255, 255, 255, 0.15);
    --button-hover: rgba(255, 255, 255, 0.25);
    --control-bg: rgba(60, 60, 60, 0.8);
    --control-text: #e9ecef;
    --overlay-bg: rgba(0, 0, 0, 0.1);
  }
}

.background-game {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 1;
  z-index: 2;
  pointer-events: none; /* Make background non-interactive */
}

.overlay-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  box-sizing: border-box;
  pointer-events: auto; /* Ensure overlay content is interactive */
}

.welcome-card {
  border-radius: 20px;
  padding: 3rem;
  max-width: 900px;
  width: 100%;
  text-align: center;
  transition: all 0.3s ease;
  pointer-events: auto; /* Ensure card is interactive */

  .title {
    font-size: 3.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, $kfkb1 0%, var(--text-accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    z-index: 1;
    text-shadow: none;
  }

  .subtitle {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin-bottom: 3rem;
    font-weight: 300;
    z-index: 1;
  }
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  z-index: 3;
}

.game-card {
  background: var(--bg-card);
  border-radius: 15px;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
  border: 2px solid var(--border-color);
  backdrop-filter: blur(10px);
  box-shadow: 0 5px 15px var(--shadow-color);
  pointer-events: auto; /* Ensure game cards are interactive */

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px var(--shadow-color);
    border-color: rgba(58, 152, 59, 0.3);
    background: var(--bg-card-hover);
  }

  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .play-btn {
    background: linear-gradient(135deg, $kfkb1 0%, $kfkb2 100%);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 25px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
    pointer-events: auto; /* Ensure buttons are interactive */
    text-decoration: none; /* For router-link styling */
    display: inline-block; /* For router-link to behave like button */
    text-align: center;

    &:hover {
      transform: scale(1.05);
      box-shadow: 5px 5px 15px rgba(58, 152, 59, 0.4);
    }

    &:active {
      transform: scale(0.95);
    }

    &.disabled {
      background: var(--button-bg);
      color: var(--text-secondary);
      cursor: not-allowed;
      opacity: 0.6;

      &:hover {
        transform: none;
        box-shadow: none;
      }
    }
  }

  &.special .play-btn {
    background: var(--button-bg);
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-color);
    color: var(--text-primary);

    &:hover {
      background: var(--button-hover);
    }
  }
}

.snake-info {
  background: var(--control-bg);
  border-radius: 15px;
  padding: 2rem;
  text-align: left;
  margin-top: 2rem;
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  pointer-events: auto; /* Ensure snake info is interactive */

  h4 {
    color: var(--text-primary);
    font-size: 1.3rem;
    margin-bottom: 1rem;
  }

  p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }
}

.snake-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;

  button {
    background: $kfkb1;
    border: 2px solid var(--border-color);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    pointer-events: auto; /* Ensure control buttons are interactive */

    &:hover {
      filter: brightness(1.1);
      color: white;
    }

    &.active {
      background: $kfkb2;
      color: white;
    }

    &.debug {
      background: #e74c3c;
      border-color: #c0392b;

      &:hover {
        background: #c0392b;
      }

      &.active {
        background: #27ae60;
        border-color: #229954;

        &:hover {
          background: #229954;
        }
      }
    }
  }

  .fps-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    pointer-events: auto; /* Ensure FPS control is interactive */

    label {
      color: var(--control-text);
      font-weight: 500;
      font-size: 0.9rem;
    }

    .fps-slider {
      width: 120px;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(to right, $kfkb1 0%, var(--text-accent) 100%);
      outline: none;
      opacity: 0.8;
      transition: opacity 0.2s;
      cursor: pointer;
      pointer-events: auto; /* Ensure slider is interactive */

      &:hover {
        opacity: 1;
      }

      &::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: $kfkb1;
        cursor: pointer;
        box-shadow: 0 2px 6px var(--shadow-color);
        transition: all 0.2s ease;

        &:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px var(--shadow-color);
        }
      }

      &::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: $kfkb1;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 6px var(--shadow-color);
        transition: all 0.2s ease;

        &:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px var(--shadow-color);
        }
      }

      &::-moz-range-track {
        height: 6px;
        border-radius: 3px;
        background: linear-gradient(to right, $kfkb1 0%, $kfkb2 100%);
        border: none;
      }
    }

    .fps-value {
      color: var(--control-text);
      font-weight: 600;
      font-size: 0.9rem;
      min-width: 50px;
      text-align: center;
    }
  }
}

.close-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: var(--control-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  z-index: 4;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  font-size: 1.2rem;
  font-weight: bold;
  pointer-events: auto; /* Ensure close button is interactive */

  &:hover {
    background: var(--button-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

.theme-toggle {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 3000;

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
    cursor: pointer;

    input {
      opacity: 0;
      width: 0;
      height: 0;

      &:checked + .slider {
        background-color: #2196f3;

        &:before {
          transform: translateX(26px);
        }

        .toggle-icon {
          transform: translateX(26px);
        }
      }
    }

    .slider {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.4s;
      border-radius: 34px;
      display: flex;
      align-items: center;
      padding: 0 4px;

      &:before {
        position: absolute;
        content: '';
        height: 26px;
        width: 26px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .toggle-icon {
        position: absolute;
        font-size: 16px;
        transition: 0.4s;
        z-index: 1;
        line-height: 1;
        height: 26px;
        width: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
    }

    &:hover .slider {
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
    }
  }
}

// Responsive design
@media (max-width: 768px) {
  .overlay-content {
    padding: 1rem;
  }

  .welcome-card {
    padding: 2rem;

    .title {
      font-size: 2.5rem;
    }

    .subtitle {
      font-size: 1rem;
    }
  }

  .game-card {
    padding: 1.5rem;
  }
}

@media (max-width: 480px) {
  .welcome-card {
    padding: 1.5rem;

    .title {
      font-size: 2rem;
    }
  }

  .snake-info {
    padding: 1.5rem;
  }
}
</style>
