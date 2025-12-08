<template>
  <div class="box-dodge-royale">
    <div class="game-layout">
      <div
        class="game-container"
        ref="gameContainer"
        :class="{ 'game-over': !game.running && game.score > 0 }"
        :style="{ '--game-width': GAME_WIDTH + 'px', '--game-height': GAME_HEIGHT + 'px' }"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @mouseenter="handleMouseEnter"
      >
        <div class="game-arena" :style="arenaStyle">
          <div class="player" :style="playerStyle" :class="{ shielded: player.isShielded }"></div>

          <div
            v-for="box in boxes"
            :key="box.id"
            class="box"
            :class="{ 'box-fast': box.speed > 4 }"
            :style="boxStyle(box)"
          ></div>

          <div
            v-for="powerUp in powerUps"
            :key="powerUp.id"
            class="power-up"
            :class="`power-up-${powerUp.type}`"
            :style="powerUpStyle(powerUp)"
          >
            {{ powerUpIcon(powerUp.type) }}
          </div>

          <div v-if="!game.running" class="overlay">
            <div class="overlay-content">
              <h1>Box Dodge Royale</h1>
              <p v-if="game.score > 0">
                Game Over! You survived for <strong>{{ game.score.toFixed(2) }}</strong> seconds.
              </p>
              <p v-else>Dodge the falling boxes for as long as you can!</p>
              <button @click="startGame" class="start-button">
                {{ game.score > 0 ? 'Play Again' : 'Start Game' }}
              </button>
              <p class="controls-hint">
                Move with mouse, A/D keys, or arrow keys<br />
                Press Enter to {{ game.score > 0 ? 'restart' : 'start' }}
              </p>
            </div>
          </div>
          <div v-if="game.paused && game.running" class="overlay paused-overlay">
            <div class="overlay-content">
              <h2>PAUSED</h2>
              <p>Move mouse back over the game to resume.</p>
            </div>
          </div>
        </div>

        <div class="scoreboard">
          <span class="score-display"> ⏱️ Survival Time: {{ game.score.toFixed(2) }}s </span>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <div class="sidebar-section">
          <h3>Stats</h3>
          <div class="stat-item">
            <span class="stat-label">Time Survived</span>
            <span class="stat-value">{{ game.score.toFixed(2) }}s</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Boxes Dodged</span>
            <span class="stat-value">{{ game.boxesDodged }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Power-ups Used</span>
            <span class="stat-value">{{ game.powerUpsCollected }}</span>
          </div>
        </div>

        <div class="sidebar-section">
          <h3>Active Power-ups</h3>
          <div v-if="!player.isShielded && !game.slowTimeActive" class="no-powerups">
            No active power-ups
          </div>

          <div v-if="player.isShielded" class="powerup-status shield-status">
            <div class="powerup-icon">🛡️</div>
            <div class="powerup-info">
              <span class="powerup-name">Shield</span>
              <div class="powerup-timer">
                <div class="timer-bar">
                  <div
                    class="timer-fill shield-fill"
                    :style="{ width: getShieldTimePercent() + '%' }"
                  ></div>
                </div>
                <span class="timer-text">{{ getShieldTimeRemaining() }}s</span>
              </div>
            </div>
          </div>

          <div v-if="game.slowTimeActive" class="powerup-status slowtime-status">
            <div class="powerup-icon">⏳</div>
            <div class="powerup-info">
              <span class="powerup-name">Slow Time</span>
              <div class="powerup-timer">
                <div class="timer-bar">
                  <div
                    class="timer-fill slowtime-fill"
                    :style="{ width: getSlowTimePercent() + '%' }"
                  ></div>
                </div>
                <span class="timer-text">{{ getSlowTimeRemaining() }}s</span>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <h3>Controls</h3>
          <div class="control-item">
            <span class="control-key">Mouse</span>
            <span class="control-desc">Move player</span>
          </div>
          <div class="control-item">
            <span class="control-key">A / D</span>
            <span class="control-desc">Move left/right</span>
          </div>
          <div class="control-item">
            <span class="control-key">← / →</span>
            <span class="control-desc">Move left/right</span>
          </div>
          <div class="control-item">
            <span class="control-key">Enter</span>
            <span class="control-desc">Start/Restart</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'

// --- Type Definitions ---

type PowerUpType = 'shield' | 'slowTime'

interface GameObject {
  id: number
  x: number
  y: number
  width: number
  height: number
}

interface Box extends GameObject {
  speed: number
  angle: number
}

interface PowerUp extends GameObject {
  type: PowerUpType
  dy: number
}

interface Player extends GameObject {
  isShielded: boolean
}

interface GameState {
  running: boolean
  paused: boolean
  score: number
  lastTime: number
  frameId: number | null
  slowTimeActive: boolean
  slowTimeEnd: number
  shieldActive: boolean
  shieldEnd: number
  boxesDodged: number
  powerUpsCollected: number
}

// --- Constants ---
const GAME_WIDTH = 500
const GAME_HEIGHT = 400
const PLAYER_SIZE = 15
const BOX_MIN_SIZE = 10
const BOX_MAX_SIZE = 40
const BOX_SPAWN_INTERVAL = 450 // ms
const POWERUP_SPAWN_CHANCE = 0.008
const SHIELD_DURATION = 5000 // ms
const SLOW_TIME_DURATION = 4000 // ms
const MAX_ARENA_SHRINK = 0.3
const SHRINK_RATE_PER_SECOND = 0.004

export default defineComponent({
  name: 'DodgeGame',
  setup() {
    const gameContainer = ref<HTMLElement | null>(null)
    const theme = useThemeStore()

    let boxIdCounter = 0
    let powerUpIdCounter = 0
    let lastBoxSpawnTime = 0
    let arenaShrinkFactor = 0

    const game = reactive<GameState>({
      running: false,
      paused: false,
      score: 0,
      lastTime: 0,
      frameId: null,
      slowTimeActive: false,
      slowTimeEnd: 0,
      shieldActive: false,
      shieldEnd: 0,
      boxesDodged: 0,
      powerUpsCollected: 0,
    })

    const player = reactive<Player>({
      id: 0,
      x: GAME_WIDTH / 2 - PLAYER_SIZE / 2,
      y: GAME_HEIGHT - PLAYER_SIZE,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      isShielded: false,
    })

    const boxes = reactive<Box[]>([])
    const powerUps = reactive<PowerUp[]>([])

    // Keyboard controls
    const keys = reactive({
      left: false,
      right: false,
    })

    const playerStyle = computed(() => ({
      left: `${player.x}px`,
      width: `${player.width}px`,
      height: `${player.height}px`,
    }))

    const arenaStyle = computed(() => {
      const margin = (GAME_WIDTH * arenaShrinkFactor) / 2
      return {
        margin: `${margin}px`,
        width: `${GAME_WIDTH - margin * 2}px`,
        height: `${GAME_HEIGHT - margin * 2}px`,
      }
    })

    const boxStyle = (box: Box) => ({
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      transform: `rotate(${box.angle}deg)`,
    })

    const powerUpStyle = (powerUp: PowerUp) => ({
      left: `${powerUp.x}px`,
      top: `${powerUp.y}px`,
    })

    const powerUpIcon = (type: PowerUpType): string => {
      return type === 'shield' ? '🛡️' : '⏳'
    }

    // Timer functions for power-ups
    const getShieldTimeRemaining = () => {
      if (!game.shieldActive) return 0
      return Math.max(0, (game.shieldEnd - performance.now()) / 1000).toFixed(1)
    }

    const getShieldTimePercent = () => {
      if (!game.shieldActive) return 0
      const remaining = game.shieldEnd - performance.now()
      return Math.max(0, (remaining / SHIELD_DURATION) * 100)
    }

    const getSlowTimeRemaining = () => {
      if (!game.slowTimeActive) return 0
      return Math.max(0, (game.slowTimeEnd - performance.now()) / 1000).toFixed(1)
    }

    const getSlowTimePercent = () => {
      if (!game.slowTimeActive) return 0
      const remaining = game.slowTimeEnd - performance.now()
      return Math.max(0, (remaining / SLOW_TIME_DURATION) * 100)
    }

    const resetGame = () => {
      boxes.length = 0
      powerUps.length = 0
      player.x = GAME_WIDTH / 2 - PLAYER_SIZE / 2
      player.isShielded = false
      game.score = 0
      game.slowTimeActive = false
      game.shieldActive = false
      game.boxesDodged = 0
      game.powerUpsCollected = 0
      arenaShrinkFactor = 0
      lastBoxSpawnTime = 0
    }

    const spawnBox = () => {
      const size = BOX_MIN_SIZE + Math.random() * (BOX_MAX_SIZE - BOX_MIN_SIZE)
      const speed = 1 + Math.random() * 2 + game.score / 50
      boxes.push({
        id: boxIdCounter++,
        x: Math.random() * (GAME_WIDTH - size),
        y: -size,
        width: size,
        height: size,
        speed: speed,
        angle: Math.random() * 90 - 45,
      })
    }

    const spawnPowerUp = () => {
      const type: PowerUpType = Math.random() < 0.5 ? 'shield' : 'slowTime'
      powerUps.push({
        id: powerUpIdCounter++,
        x: Math.random() * (GAME_WIDTH - 20),
        y: -20,
        width: 20,
        height: 20,
        type: type,
        dy: 1,
      })
    }

    const applyPowerUp = (powerUp: PowerUp) => {
      const now = performance.now()
      game.powerUpsCollected++
      if (powerUp.type === 'shield') {
        game.shieldActive = true
        player.isShielded = true
        game.shieldEnd = now + SHIELD_DURATION
      } else {
        game.slowTimeActive = true
        game.slowTimeEnd = now + SLOW_TIME_DURATION
      }
    }

    const checkCollision = (obj1: GameObject, obj2: GameObject): boolean => {
      return (
        obj1.x < obj2.x + obj2.width &&
        obj1.x + obj1.width > obj2.x &&
        obj1.y < obj2.y + obj2.height &&
        obj1.y + obj1.height > obj2.y
      )
    }

    const endGame = () => {
      if (game.frameId !== null) {
        cancelAnimationFrame(game.frameId)
        game.frameId = null
      }
      game.running = false
    }

    const update = (time: number) => {
      if (!game.running) {
        if (game.frameId) cancelAnimationFrame(game.frameId)
        game.frameId = null
        return
      }

      if (game.paused) {
        game.lastTime = time
        game.frameId = requestAnimationFrame(update)
        return
      }

      const deltaTime = time - game.lastTime
      game.lastTime = time
      const timeFactor = deltaTime / 16.67

      game.score += deltaTime / 1000
      if (game.shieldActive && time > game.shieldEnd) {
        game.shieldActive = false
        player.isShielded = false
      }
      if (game.slowTimeActive && time > game.slowTimeEnd) {
        game.slowTimeActive = false
      }

      const shrinkDelta = SHRINK_RATE_PER_SECOND * (deltaTime / 1000)
      arenaShrinkFactor = Math.min(MAX_ARENA_SHRINK, arenaShrinkFactor + shrinkDelta)
      const currentMargin = (GAME_WIDTH * arenaShrinkFactor) / 2

      const spawnInterval = BOX_SPAWN_INTERVAL / (1 + game.score / 30)
      if (time - lastBoxSpawnTime > spawnInterval) {
        spawnBox()
        lastBoxSpawnTime = time
      }
      if (Math.random() < POWERUP_SPAWN_CHANCE) {
        spawnPowerUp()
      }

      const speedModifier = game.slowTimeActive ? 0.5 : 1
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i]
        if (!box) continue
        box.y += box.speed * speedModifier * timeFactor
        box.angle += box.speed * 0.1 * speedModifier * timeFactor

        if (checkCollision(player, box)) {
          if (player.isShielded) {
            game.shieldActive = false
            player.isShielded = false
            boxes.splice(i, 1)
          } else {
            endGame()
            return
          }
        } else if (box.y > GAME_HEIGHT) {
          boxes.splice(i, 1)
          game.boxesDodged++
        }
      }

      for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i]
        if (!powerUp) continue
        powerUp.y += powerUp.dy * timeFactor
        if (checkCollision(player, powerUp)) {
          applyPowerUp(powerUp)
          powerUps.splice(i, 1)
        } else if (powerUp.y > GAME_HEIGHT) {
          powerUps.splice(i, 1)
        }
      }

      // Handle keyboard movement
      const moveSpeed = 5 * timeFactor
      if (keys.left) {
        player.x -= moveSpeed
      }
      if (keys.right) {
        player.x += moveSpeed
      }

      player.x = Math.max(
        currentMargin,
        Math.min(GAME_WIDTH - player.width - currentMargin, player.x),
      )

      game.frameId = requestAnimationFrame(update)
    }

    const startGame = () => {
      if (game.running) return
      resetGame()
      game.running = true
      game.paused = false
      game.lastTime = performance.now()
      if (game.frameId === null) {
        game.frameId = requestAnimationFrame(update)
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!game.running || !gameContainer.value) return
      const rect = gameContainer.value.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      player.x = mouseX - player.width / 2
    }

    const handleMouseLeave = () => {
      if (game.running) game.paused = true
    }

    const handleMouseEnter = () => {
      if (game.running) game.paused = false
    }

    const handleVisibilityChange = () => {
      if (document.hidden && game.running) {
        game.paused = true
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          keys.left = true
          event.preventDefault()
          break
        case 'd':
        case 'arrowright':
          keys.right = true
          event.preventDefault()
          break
        case 'enter':
          if (!game.running) {
            startGame()
          }
          event.preventDefault()
          break
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          keys.left = false
          event.preventDefault()
          break
        case 'd':
        case 'arrowright':
          keys.right = false
          event.preventDefault()
          break
      }
    }

    onMounted(() => {
      resetGame()
      document.addEventListener('visibilitychange', handleVisibilityChange)
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keyup', handleKeyUp)
    })

    onBeforeUnmount(() => {
      if (game.frameId !== null) cancelAnimationFrame(game.frameId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    })

    return {
      GAME_WIDTH,
      GAME_HEIGHT,
      gameContainer,
      game,
      theme,
      player,
      playerStyle,
      arenaStyle,
      boxes,
      boxStyle,
      powerUps,
      powerUpStyle,
      powerUpIcon,
      getShieldTimeRemaining,
      getShieldTimePercent,
      getSlowTimeRemaining,
      getSlowTimePercent,
      startGame,
      handleMouseMove,
      handleMouseLeave,
      handleMouseEnter,
    }
  },
})
</script>

<style lang="scss" scoped>
@use '@/styles/theme.scss';

.box-dodge-royale {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background-color: var(--theme-bg-secondary);
  border-radius: 10px;
  box-shadow: var(--theme-shadow-lg);
  user-select: none;
  width: 100%;
  max-width: 900px;
  margin: auto;
}

.game-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  width: 100%;
}

.game-container {
  position: relative;
  width: var(--game-width);
  height: var(--game-height);
  background-color: var(--theme-bg-primary);
  border: 5px solid var(--theme-canvas-border);
  overflow: hidden;
  cursor: none;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
  transition:
    border-color 0.3s,
    box-shadow 0.3s;

  &.game-over {
    border-color: var(--theme-text-secondary);
    box-shadow: none;
  }
}

.game-arena {
  position: absolute;
  top: 0;
  left: 0;
  background-color: transparent;
  transition:
    margin 0.5s ease-out,
    width 0.5s ease-out,
    height 0.5s ease-out;
  border: 2px dashed var(--theme-canvas-grid);
  box-sizing: border-box;
}

.player {
  position: absolute;
  bottom: 0;
  z-index: 10;
  border-radius: 3px;
  background-color: var(--theme-snake-head);
  transition:
    background-color 0.2s,
    box-shadow 0.2s;

  &.shielded {
    background-color: #ffc107;
    box-shadow: 0 0 12px 4px #ffc107;
  }
}

.box {
  position: absolute;
  z-index: 5;
  border-radius: 4px;
  background-color: var(--theme-error);
  border: 1px solid var(--theme-border-light);
  transition: transform 0.1s linear;

  &.box-fast {
    filter: brightness(1.2);
    box-shadow: 0 0 8px var(--theme-error);
  }
}

.power-up {
  position: absolute;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 50%;
  z-index: 15;
  display: grid;
  place-items: center;
  box-shadow:
    0 0 8px 2px rgba(255, 255, 255, 0.8),
    inset 0 0 5px rgba(0, 0, 0, 0.2);

  &-shield {
    background-color: #ffc107;
  }
  &-slowTime {
    background-color: #03a9f4;
  }
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--theme-text-on-dark);
  backdrop-filter: blur(4px);

  &.paused-overlay {
    background-color: rgba(0, 0, 0, 0.7);
    h2 {
      color: var(--theme-warning);
    }
  }
}

.overlay-content {
  padding: 30px;
  background: var(--theme-bg-secondary);
  border: 2px solid var(--theme-canvas-border);
  border-radius: 10px;
  animation: fadeIn 0.5s ease;

  h1,
  h2 {
    font-size: 2.2em;
    margin-bottom: 0.5em;
    color: var(--theme-text-accent);
    font-weight: bold;
  }

  p {
    font-size: 1.1em;
    margin-bottom: 1.5em;
    color: var(--theme-text-primary);
  }
}

.start-button {
  padding: 12px 25px;
  font-size: 1.3em;
  font-weight: bold;
  cursor: pointer;
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  border: none;
  border-radius: 8px;
  transition:
    filter 0.3s,
    transform 0.2s;

  &:hover {
    filter: brightness(1.1);
    transform: scale(1.05);
  }
}

.controls-hint {
  margin-top: 20px;
  font-size: 0.9em;
  color: var(--theme-text-secondary);
}

.scoreboard {
  position: absolute;
  bottom: -40px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  color: var(--theme-text-primary);
  font-weight: bold;
  font-size: 1.1em;
  background-color: var(--theme-bg-elevated);
  border-radius: 0 0 8px 8px;

  .score-display {
    color: var(--theme-success);
  }

  .powerup-display {
    color: #ffc107;
    animation: pulse 1s infinite alternate;
    text-shadow: 0 0 5px #ffc107;
  }
}

@keyframes pulse {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

// Sidebar styles
.sidebar {
  width: 280px;
  background-color: var(--theme-bg-elevated);
  border-radius: 8px;
  padding: 20px;
  border: 2px solid var(--theme-canvas-border);
  box-shadow: var(--theme-shadow-md);
  flex-shrink: 0;

  .sidebar-section {
    margin-bottom: 25px;

    &:last-child {
      margin-bottom: 0;
    }

    h3 {
      color: var(--theme-text-accent);
      font-size: 1.2em;
      margin-bottom: 15px;
      border-bottom: 2px solid var(--theme-canvas-border);
      padding-bottom: 8px;
    }
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding: 5px 0;

    .stat-label {
      color: var(--theme-text-secondary);
      font-size: 0.95em;
    }

    .stat-value {
      color: var(--theme-text-accent);
      font-weight: bold;
      font-size: 1em;
    }
  }

  .no-powerups {
    color: var(--theme-text-secondary);
    font-style: italic;
    text-align: center;
    padding: 10px 0;
  }

  .powerup-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background-color: var(--theme-bg-primary);
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px solid var(--theme-border-light);

    &.shield-status {
      border-color: #ffc107;
      background-color: rgba(255, 193, 7, 0.1);
    }

    &.slowtime-status {
      border-color: #03a9f4;
      background-color: rgba(3, 169, 244, 0.1);
    }

    .powerup-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .powerup-info {
      flex: 1;

      .powerup-name {
        display: block;
        font-weight: bold;
        color: var(--theme-text-primary);
        font-size: 0.95em;
        margin-bottom: 5px;
      }
    }
  }

  .powerup-timer {
    display: flex;
    align-items: center;
    gap: 8px;

    .timer-bar {
      flex: 1;
      height: 6px;
      background-color: var(--theme-bg-secondary);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid var(--theme-border-light);

      .timer-fill {
        height: 100%;
        transition: width 0.1s linear;

        &.shield-fill {
          background-color: #ffc107;
          box-shadow: 0 0 6px rgba(255, 193, 7, 0.5);
        }

        &.slowtime-fill {
          background-color: #03a9f4;
          box-shadow: 0 0 6px rgba(3, 169, 244, 0.5);
        }
      }
    }

    .timer-text {
      font-size: 0.8em;
      font-weight: bold;
      color: var(--theme-text-accent);
      min-width: 25px;
      text-align: right;
    }
  }

  .control-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding: 3px 0;

    .control-key {
      background-color: var(--theme-bg-primary);
      color: var(--theme-text-accent);
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85em;
      font-weight: bold;
      border: 1px solid var(--theme-border-light);
      min-width: 50px;
      text-align: center;
    }

    .control-desc {
      color: var(--theme-text-secondary);
      font-size: 0.9em;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
