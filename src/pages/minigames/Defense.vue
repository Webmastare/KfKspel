<template>
  <div class="main-container">
    <!-- Top UI Bar -->
    <div class="top-ui-bar">
      <div class="health-section">
        <div class="health-label">Health</div>
        <div class="health-bar">
          <div
            class="health"
            :style="{ width: (player.health / player.maxHealth) * 100 + '%' }"
          ></div>
        </div>
      </div>

      <div class="score-section">
        <div class="score-display">Score: {{ game.score }}</div>
        <div class="money-display">💰 {{ player.money }}</div>
      </div>

      <div class="weapon-section">
        <div class="weapon-name">{{ player.currentWeapon.name }}</div>
        <div class="weapon-stats">
          Dmg: {{ player.currentWeapon.damage }} | Rate:
          {{ player.currentWeapon.fireRate.toFixed(1) }}/s | Range: {{ player.currentWeapon.range }}
        </div>
      </div>
    </div>

    <!-- Game Canvas Area -->
    <div class="game-container" ref="gameContainer">
      <canvas
        ref="gameCanvas"
        :width="game.game_width"
        :height="game.game_height"
        @click="handleCanvasClick"
        tabindex="0"
      ></canvas>

      <div v-if="game.paused && game.running" class="overlay paused-overlay">
        <div class="overlay-content">
          <h2>PAUSED</h2>
        </div>
      </div>

      <!-- Minimap -->
      <div class="minimap-container">
        <canvas ref="minimapCanvas" width="120" height="90" class="minimap"></canvas>
      </div>
    </div>

    <!-- Bottom UI Bar -->
    <div class="bottom-ui-bar">
      <div class="game-stats">
        <span>Enemies: {{ enemies.length }}</span>
        <span>Killed: {{ game.enemiesKilled }}</span>
        <span
          >Spawn Rate:
          {{
            (1000 / (game.baseEnemySpawnInterval / (1 + game.enemiesKilled / 20))).toFixed(1)
          }}/s</span
        >
      </div>

      <div class="controls">
        <button @click="openWeaponShop" class="shop-btn">Shop (I)</button>
        <button @click="togglePause" class="pause-btn">
          {{ game.paused ? 'Resume' : 'Pause' }} (P)
        </button>
      </div>

      <div class="help-text">WASD/Arrows: Move | Space: Switch Weapon | ESC: Pause</div>
    </div>

    <!-- Shop Component -->
    <DefenseShop
      ref="shopComponent"
      :isVisible="showShop"
      :playerMoney="player.money"
      :currentWeapon="player.currentWeapon"
      :ownedWeapons="player.ownedWeapons"
      :weaponTemplates="weaponTemplates"
      @close="closeShop"
      @buyWeapon="handleBuyWeapon"
      @selectWeapon="handleSelectWeapon"
      @upgradeWeapon="handleUpgradeWeapon"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import type {
  Enemy,
  Player,
  GameState,
  Bullet,
  Weapon,
} from '@/components/defenseGame/defenseTypes'
import { weaponTemplates, createWeaponCopy } from '@/components/defenseGame/defenseData'
import DefenseShop from '@/components/defenseGame/DefenseShop.vue'

// Canvas references
const gameCanvas = ref<HTMLCanvasElement | null>(null)
const gameContainer = ref<HTMLDivElement | null>(null)
const minimapCanvas = ref<HTMLCanvasElement | null>(null)
const shopComponent = ref<InstanceType<typeof DefenseShop> | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let minimapCtx: CanvasRenderingContext2D | null = null

// Shop state
const showShop = ref(false)

// Input state
const keys = reactive({
  w: false,
  a: false,
  s: false,
  d: false,
  ArrowUp: false,
  ArrowLeft: false,
  ArrowDown: false,
  ArrowRight: false,
})

const basicGunTemplate = weaponTemplates['Basic Gun']!
const player: Player = reactive({
  x: 600, // Center of world
  y: 450,
  width: 50,
  height: 50,
  speed: 5,
  angle: 0,
  health: 100,
  maxHealth: 100,
  currentWeapon: createWeaponCopy(basicGunTemplate),
  upgrades: {},
  money: 100, // Starting money
  ownedWeapons: {
    'Basic Gun': createWeaponCopy(basicGunTemplate),
  },
})

const enemies = reactive<Enemy[]>([])
const bullets = reactive<Bullet[]>([])
const game = reactive<GameState>({
  game_width: 900, // Larger canvas for better visibility
  game_height: 600,
  world_width: 1200, // Larger world
  world_height: 900,
  running: false,
  paused: false,
  score: 0,
  lastTime: 0,
  baseEnemySpawnInterval: 100,
  frameId: null,
  enemiesKilled: 0,
  camera: { x: 0, y: 0 },
})

// --- Canvas Rendering Functions ---
function initCanvas() {
  if (!gameCanvas.value) return
  ctx = gameCanvas.value.getContext('2d')
  if (!ctx) return

  // Set canvas properties
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Initialize minimap canvas
  if (!minimapCanvas.value) return
  minimapCtx = minimapCanvas.value.getContext('2d')
  if (!minimapCtx) return

  minimapCtx.imageSmoothingEnabled = false // Pixelated look for minimap
}

function clearCanvas() {
  if (!ctx) return
  ctx.clearRect(0, 0, game.game_width, game.game_height)
}

function drawBackground() {
  if (!ctx) return

  // Draw game background
  ctx.fillStyle = '#1f2937' // Dark background
  ctx.fillRect(0, 0, game.game_width, game.game_height)

  // Draw grid pattern
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  const gridSize = 40

  // Calculate grid offset based on camera
  const offsetX = -game.camera.x % gridSize
  const offsetY = -game.camera.y % gridSize

  // Vertical lines
  for (let x = offsetX; x < game.game_width; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, game.game_height)
    ctx.stroke()
  }

  // Horizontal lines
  for (let y = offsetY; y < game.game_height; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(game.game_width, y)
    ctx.stroke()
  }
}

function drawPlayer() {
  if (!ctx || !isVisible(player.x, player.y, player.width, player.height)) return

  const screenX = player.x - game.camera.x
  const screenY = player.y - game.camera.y
  const halfWidth = player.width / 2
  const halfHeight = player.height / 2

  // Draw player and border in one operation
  ctx.fillStyle = '#10b981'
  ctx.strokeStyle = '#059669'
  ctx.lineWidth = 2
  ctx.fillRect(screenX - halfWidth, screenY - halfHeight, player.width, player.height)
  ctx.strokeRect(screenX - halfWidth, screenY - halfHeight, player.width, player.height)
}

// Optimized visibility check helper
function isVisible(x: number, y: number, width: number, height: number): boolean {
  const screenX = x - game.camera.x
  const screenY = y - game.camera.y
  return !(
    screenX < -width ||
    screenX > game.game_width + width ||
    screenY < -height ||
    screenY > game.game_height + height
  )
}

function drawEnemy(enemy: Enemy) {
  if (!ctx || !isVisible(enemy.x, enemy.y, enemy.width, enemy.height)) return

  const screenX = enemy.x - game.camera.x
  const screenY = enemy.y - game.camera.y
  const halfWidth = enemy.width / 2
  const halfHeight = enemy.height / 2

  // Draw enemy with border in one operation
  ctx.fillStyle = enemy.speed > 4 ? '#dc2626' : '#ef4444'
  ctx.strokeStyle = '#991b1b'
  ctx.lineWidth = 1
  ctx.fillRect(screenX - halfWidth, screenY - halfHeight, enemy.width, enemy.height)
  ctx.strokeRect(screenX - halfWidth, screenY - halfHeight, enemy.width, enemy.height)

  // Draw health bar efficiently
  const healthBarY = screenY - halfHeight - 8
  const healthPercent = enemy.health / enemy.maxHealth

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(screenX - halfWidth, healthBarY, enemy.width, 4)

  // Foreground
  ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444'
  ctx.fillRect(screenX - halfWidth, healthBarY, enemy.width * healthPercent, 4)
}

function drawBullet(bullet: Bullet) {
  if (!ctx || !isVisible(bullet.x, bullet.y, bullet.width, bullet.height)) return

  const screenX = bullet.x - game.camera.x
  const screenY = bullet.y - game.camera.y
  const radius = bullet.width / 2

  // Draw bullet with glow in batch operations
  ctx.fillStyle = '#fbbf24'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawMinimap() {
  if (!minimapCtx) return

  const minimapWidth = 120
  const minimapHeight = 90

  // Scale factors to convert world coordinates to minimap coordinates
  const scaleX = minimapWidth / game.world_width
  const scaleY = minimapHeight / game.world_height

  // Clear minimap
  minimapCtx.clearRect(0, 0, minimapWidth, minimapHeight)

  // Draw world boundary
  minimapCtx.strokeStyle = '#666'
  minimapCtx.lineWidth = 2
  minimapCtx.strokeRect(0, 0, minimapWidth, minimapHeight)

  // Draw current camera view as a rectangle
  const cameraX = game.camera.x * scaleX
  const cameraY = game.camera.y * scaleY
  const cameraWidth = game.game_width * scaleX
  const cameraHeight = game.game_height * scaleY

  minimapCtx.strokeStyle = '#4a90e2'
  minimapCtx.lineWidth = 1
  minimapCtx.strokeRect(cameraX, cameraY, cameraWidth, cameraHeight)

  // Draw player as a blue dot
  const playerX = player.x * scaleX
  const playerY = player.y * scaleY

  minimapCtx.fillStyle = '#00ff00' // Green for player
  minimapCtx.beginPath()
  minimapCtx.arc(playerX, playerY, 2, 0, Math.PI * 2)
  minimapCtx.fill()

  // Draw enemies as red dots
  minimapCtx.fillStyle = '#ff4444' // Red for enemies
  enemies.forEach((enemy) => {
    if (!minimapCtx) return
    const enemyX = enemy.x * scaleX
    const enemyY = enemy.y * scaleY

    minimapCtx.beginPath()
    minimapCtx.arc(enemyX, enemyY, 1, 0, Math.PI * 2)
    minimapCtx.fill()
  })

  // Draw bullets as tiny yellow dots (optional, might be too cluttered)
  if (bullets.length < 50) {
    // Only show bullets if there aren't too many
    minimapCtx.fillStyle = '#fbbf24' // Yellow for bullets
    bullets.forEach((bullet) => {
      if (!minimapCtx) return
      const bulletX = bullet.x * scaleX
      const bulletY = bullet.y * scaleY

      minimapCtx.beginPath()
      minimapCtx.arc(bulletX, bulletY, 0.5, 0, Math.PI * 2)
      minimapCtx.fill()
    })
  }
}

function renderFrame() {
  clearCanvas()
  drawBackground()

  // Draw all game objects
  drawPlayer()

  // Draw enemies
  for (const enemy of enemies) {
    drawEnemy(enemy)
  }

  // Draw bullets
  for (const bullet of bullets) {
    drawBullet(bullet)
  }

  // Draw minimap
  drawMinimap()
}

function gameLoop(timestamp: number) {
  const deltaTime = timestamp - game.lastTime
  game.lastTime = timestamp

  if (!game.paused) {
    // Update game state
    checkEnemySpawn(timestamp)
    updateEnemies(deltaTime)
    updateBullets(deltaTime)
    updatePlayerPosition()
    updateCamera()
    handleShooting(timestamp)
  }

  // Always render the frame
  renderFrame()

  // Request next frame
  game.frameId = requestAnimationFrame(gameLoop)
}

function updatePlayerPosition() {
  let deltaX = 0
  let deltaY = 0

  // Handle multiple key presses for diagonal movement
  if (keys.w || keys.ArrowUp) {
    deltaY -= player.speed
  }
  if (keys.s || keys.ArrowDown) {
    deltaY += player.speed
  }
  if (keys.a || keys.ArrowLeft) {
    deltaX -= player.speed
  }
  if (keys.d || keys.ArrowRight) {
    deltaX += player.speed
  }

  // Normalize diagonal movement
  if (deltaX !== 0 && deltaY !== 0) {
    const length = Math.hypot(deltaX, deltaY)
    deltaX = (deltaX / length) * player.speed
    deltaY = (deltaY / length) * player.speed
  }

  // Update player angle for visual direction
  if (deltaX !== 0 || deltaY !== 0) {
    player.angle = Math.atan2(deltaY, deltaX)
  }

  // Calculate new position
  let newX = player.x + deltaX
  let newY = player.y + deltaY

  // Keep player within world bounds
  newX = Math.max(player.width / 2, Math.min(game.world_width - player.width / 2, newX))
  newY = Math.max(player.height / 2, Math.min(game.world_height - player.height / 2, newY))

  player.x = newX
  player.y = newY
}

function updateCamera() {
  // Camera follows player with some offset to center them
  game.camera.x = player.x - game.game_width / 2
  game.camera.y = player.y - game.game_height / 2

  // Keep camera within world bounds
  game.camera.x = Math.max(0, Math.min(game.world_width - game.game_width, game.camera.x))
  game.camera.y = Math.max(0, Math.min(game.world_height - game.game_height, game.camera.y))
}

function handleShooting(timestamp: number) {
  const timeSinceLastShot = timestamp - player.currentWeapon.lastShotTime
  const shotInterval = 1000 / player.currentWeapon.fireRate // Convert to milliseconds

  if (timeSinceLastShot >= shotInterval && enemies.length > 0) {
    // Find closest enemy within range
    const closestEnemy = findClosestEnemyInRange()
    if (closestEnemy) {
      shootBullet(closestEnemy)
      player.currentWeapon.lastShotTime = timestamp
    }
  }
}

function findClosestEnemyInRange(): Enemy | null {
  let closestEnemy: Enemy | null = null
  let closestDistance = Infinity

  // Sort enemies by distance and prioritize closest ones
  const enemiesWithDistance = enemies
    .map((enemy) => ({
      enemy,
      distance: Math.hypot(player.x - enemy.x, player.y - enemy.y),
    }))
    .filter((item) => item.distance <= player.currentWeapon.range)
    .sort((a, b) => a.distance - b.distance)

  // Return the closest enemy
  return enemiesWithDistance.length > 0 && enemiesWithDistance[0]
    ? enemiesWithDistance[0].enemy
    : null
}

function shootBullet(target: Enemy) {
  // Simple direct targeting - aim at current enemy position
  const angle = Math.atan2(target.y - player.y, target.x - player.x)

  const bullet: Bullet = {
    id: Date.now() + Math.random(), // Ensure unique ID
    x: player.x,
    y: player.y,
    width: player.currentWeapon.bulletSize,
    height: player.currentWeapon.bulletSize,
    speed: player.currentWeapon.bulletSpeed,
    angle: angle, // Direction to move
    damage: player.currentWeapon.damage,
    penetrationLeft: player.currentWeapon.penetration,
    targetX: target.x, // Store target for reference
    targetY: target.y,
    createdAt: Date.now(),
  }

  bullets.push(bullet)
}

function updateBullets(deltaTime: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet) continue

    // Move bullet in straight line based on its angle
    const deltaSpeed = bullet.speed * (deltaTime / 1000) // Normalize to 60fps
    bullet.x += Math.cos(bullet.angle) * deltaSpeed
    bullet.y += Math.sin(bullet.angle) * deltaSpeed

    // Check for enemy hits with generous detection
    let hitEnemy = false
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j]
      if (!enemy) continue

      const distToEnemy = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y)
      // Hit detection with reasonable tolerance
      if (distToEnemy < (enemy.width + bullet.width) / 2 + 20) {
        // Hit enemy
        enemy.health -= bullet.damage
        hitEnemy = true

        if (enemy.health <= 0) {
          enemies.splice(j, 1)
          game.score += 10
          game.enemiesKilled++
          // Award money for killing enemies
          const moneyReward = 5 + Math.floor(Math.random() * 8) // 5-12 money per kill
          player.money += moneyReward
        }
        break
      }
    }

    if (hitEnemy) {
      bullet.penetrationLeft--
      // Decrease damage for next hit
      bullet.damage *= 0.6
      if (bullet.penetrationLeft <= 0) {
        bullets.splice(i, 1)
        continue
      }
    }

    // Remove bullets that are out of bounds or too old
    if (
      bullet.x < -50 ||
      bullet.x > game.world_width + 50 ||
      bullet.y < -50 ||
      bullet.y > game.world_height + 50 ||
      Date.now() - bullet.createdAt > 3000
    ) {
      bullets.splice(i, 1)
    }
  }
}

// Optimized enemy spawning - integrated into game loop instead of separate interval
let lastSpawnTime = 0
function checkEnemySpawn(timestamp: number) {
  const spawnInterval = game.baseEnemySpawnInterval / (1 + game.enemiesKilled / 20)
  if (timestamp - lastSpawnTime > spawnInterval) {
    spawnEnemy()
    lastSpawnTime = timestamp
  }
}

function updateEnemies(deltaTime: number) {
  enemies.forEach((enemy) => {
    // Enemies should move towards the player
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x)
    enemy.x += enemy.speed * Math.cos(angleToPlayer) * (deltaTime / 16) // Assuming 60 FPS baseline
    enemy.y += enemy.speed * Math.sin(angleToPlayer) * (deltaTime / 16)

    // If enemy reaches player, reduce player health
    const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y)
    if (distToPlayer < (player.width + enemy.width) / 2) {
      player.health -= enemy.damage
      enemies.splice(enemies.indexOf(enemy), 1)
    }
  })
}

function spawnEnemy() {
  // Spawn enemies at the edges of the world
  const side = Math.floor(Math.random() * 4) // 0: top, 1: right, 2: bottom, 3: left
  let x, y

  switch (side) {
    case 0: // top
      x = Math.random() * game.world_width
      y = -30
      break
    case 1: // right
      x = game.world_width + 30
      y = Math.random() * game.world_height
      break
    case 2: // bottom
      x = Math.random() * game.world_width
      y = game.world_height + 30
      break
    case 3: // left
      x = -30
      y = Math.random() * game.world_height
      break
    default:
      x = 0
      y = 0
  }

  const enemy: Enemy = {
    id: Date.now() + Math.random(), // Ensure unique ID
    x,
    y,
    width: 20 + Math.random() * 10,
    height: 20 + Math.random() * 10,
    speed: 1 + Math.random() * 2,
    angle: 0,
    damage: 10,
    health: 50,
    maxHealth: 50,
  }
  enemies.push(enemy)
}

// Optimized key mapping for movement
const keyMappings = {
  w: ['w', 'ArrowUp'],
  s: ['s', 'ArrowDown'],
  a: ['a', 'ArrowLeft'],
  d: ['d', 'ArrowRight'],
  arrowup: ['w', 'ArrowUp'],
  arrowdown: ['s', 'ArrowDown'],
  arrowleft: ['a', 'ArrowLeft'],
  arrowright: ['d', 'ArrowRight'],
} as const

function setKeyState(key: string, state: boolean) {
  const mappedKeys = keyMappings[key as keyof typeof keyMappings]
  if (mappedKeys) {
    mappedKeys.forEach((k) => {
      keys[k as keyof typeof keys] = state
    })
  }
}

function handleKeyPress(event: KeyboardEvent) {
  const key = event.key.toLowerCase()

  // Handle movement keys
  setKeyState(key, true)

  // Handle special keys
  const specialKeys = {
    ' ': () => {
      event.preventDefault()
      const ownedWeaponNames = Object.keys(player.ownedWeapons)
      const currentIndex = ownedWeaponNames.indexOf(player.currentWeapon.name)
      const nextIndex = (currentIndex + 1) % ownedWeaponNames.length
      const nextWeapon = ownedWeaponNames[nextIndex]
      if (nextWeapon) handleSelectWeapon(nextWeapon)
    },
    i: () => {
      event.preventDefault()
      openWeaponShop()
    },
    p: () => {
      event.preventDefault()
      togglePause()
    },
    escape: () => {
      event.preventDefault()
      showShop.value ? closeShop() : togglePause()
    },
  }

  const action = specialKeys[key as keyof typeof specialKeys]
  if (action && (key !== 'escape' || !showShop.value || key === 'escape')) {
    action()
  }
}

function handleKeyUp(event: KeyboardEvent) {
  setKeyState(event.key.toLowerCase(), false)
}

function handleCanvasClick(event: MouseEvent) {
  // Focus the canvas for keyboard events
  if (gameCanvas.value) {
    gameCanvas.value.focus()
  }
}

function togglePause() {
  if (!game.running) return // Don't allow pausing if game is not running
  game.paused = !game.paused
}

// Shop Functions
function openWeaponShop() {
  showShop.value = true
  game.paused = true
}

function closeShop() {
  showShop.value = false
  game.paused = false
}

// Consolidated weapon management functions
function handleBuyWeapon(weaponName: string, cost: number) {
  const weaponTemplate = weaponTemplates[weaponName]
  if (player.money >= cost && weaponTemplate) {
    player.money -= cost
    player.ownedWeapons[weaponName] = createWeaponCopy(weaponTemplate)
  }
}

function handleSelectWeapon(weaponName: string) {
  switchWeapon(weaponName)
}

function handleUpgradeWeapon(weaponName: string, stat: string, cost: number) {
  const weapon = player.ownedWeapons[weaponName]
  if (player.money >= cost && weapon) {
    player.money -= cost

    // Apply upgrade based on stat using optimized multipliers
    const upgrades = {
      damage: () => (weapon.damage = Math.floor(weapon.damage * 1.2)),
      fireRate: () => (weapon.fireRate *= 1.15),
      range: () => (weapon.range = Math.floor(weapon.range * 1.1)),
      penetration: () => (weapon.penetration += 1),
    }

    upgrades[stat as keyof typeof upgrades]?.()

    // Update current weapon if it's the one being upgraded
    if (player.currentWeapon.name === weaponName) {
      player.currentWeapon = createWeaponCopy(weapon)
    }
  }
}

function switchWeapon(weaponName: string) {
  const ownedWeapon = player.ownedWeapons[weaponName]
  if (ownedWeapon) {
    player.currentWeapon = createWeaponCopy(ownedWeapon)
  }
}

onMounted(() => {
  // Initialize Canvas
  initCanvas()

  // Initialize game logic
  game.running = true
  game.lastTime = performance.now()
  lastSpawnTime = performance.now()
  game.frameId = requestAnimationFrame(gameLoop)

  // Add event listeners
  window.addEventListener('keydown', handleKeyPress)
  window.addEventListener('keyup', handleKeyUp)

  // Weapons are already initialized in the player reactive object
})

onBeforeUnmount(() => {
  // Clean up
  if (game.frameId) {
    cancelAnimationFrame(game.frameId)
  }
  window.removeEventListener('keydown', handleKeyPress)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<style scoped lang="scss">
@use '@/styles/theme.scss';

.main-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  background-color: var(--theme-bg-secondary);
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;

  // Responsive layout for smaller screens
  @media (max-width: 900px) {
    padding: 15px;
    gap: 8px;
  }
}

.top-ui-bar,
.bottom-ui-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 900px;
  padding: 12px 20px;
  background-color: var(--theme-bg-primary);
  border: 2px solid var(--theme-border-light);
  border-radius: 8px;
  font-family: var(--font-primary);
  color: var(--theme-text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.top-ui-bar {
  .health-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;

    .health-label {
      font-size: 0.9em;
      font-weight: bold;
      color: var(--theme-text-secondary);
    }

    .health-bar {
      width: 120px;
      height: 20px;
      background-color: var(--theme-border-light);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--theme-border-light);

      .health {
        height: 100%;
        background-color: #28bd37;
        transition: width 0.3s ease;
        border-radius: 9px;
      }
    }
  }

  .score-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    .score-display,
    .money-display {
      font-weight: bold;
      font-size: 1.1em;
    }

    .money-display {
      color: #ffd700;
    }
  }

  .weapon-section {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    min-width: 200px;

    .weapon-name {
      font-weight: bold;
      font-size: 1.1em;
    }

    .weapon-stats {
      font-size: 0.9em;
      color: var(--theme-text-secondary);
    }
  }
}

.bottom-ui-bar {
  .game-stats {
    display: flex;
    gap: 20px;
    font-size: 0.95em;

    span {
      color: var(--theme-text-secondary);
    }
  }

  .controls {
    display: flex;
    gap: 10px;

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-family: var(--font-primary);
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;

      &.shop-btn {
        background-color: #4a90e2;
        color: white;

        &:hover {
          background-color: #357abd;
        }
      }

      &.pause-btn {
        background-color: #ff8c00;
        color: white;

        &:hover {
          background-color: #e67e00;
        }
      }
    }
  }

  .help-text {
    font-size: 0.85em;
    color: var(--theme-text-secondary);
    text-align: right;
  }
}

// Responsive design for UI bars
@media (max-width: 900px) {
  .top-ui-bar,
  .bottom-ui-bar {
    padding: 10px 15px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .top-ui-bar {
    .health-section .health-bar {
      width: 100px;
    }

    .weapon-section {
      min-width: 150px;

      .weapon-stats {
        font-size: 0.8em;
      }
    }
  }

  .bottom-ui-bar {
    .game-stats {
      gap: 12px;
      font-size: 0.9em;
    }

    .help-text {
      font-size: 0.8em;
    }
  }
}

@media (max-width: 600px) {
  .top-ui-bar,
  .bottom-ui-bar {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }

  .top-ui-bar {
    .health-section,
    .score-section,
    .weapon-section {
      align-items: center;
    }
  }

  .bottom-ui-bar {
    .game-stats {
      justify-content: center;
    }

    .help-text {
      text-align: center;
    }
  }
}

.score-display {
  font-size: 1.2em;
  font-weight: bold;
  text-align: center;
  padding: 10px;
  background-color: var(--theme-bg-primary);
  border-radius: 8px;
  border: 1px solid var(--theme-border-light);
}

.weapon-info {
  padding: 12px;
  background-color: var(--theme-bg-primary);
  border-radius: 8px;
  border: 1px solid var(--theme-border-light);
  line-height: 1.4;

  strong {
    color: var(--theme-accent);
  }

  small {
    color: var(--theme-text-secondary);
    font-size: 0.85em;
    display: block;
    margin-top: 5px;
  }
}

.enemy-info {
  padding: 10px;
  background-color: var(--theme-bg-primary);
  border-radius: 8px;
  border: 1px solid var(--theme-border-light);
  font-size: 0.9em;
  line-height: 1.4;
}

.controls {
  padding: 12px;
  background-color: var(--theme-bg-primary);
  border-radius: 8px;
  border: 1px solid var(--theme-border-light);
  text-align: center;

  button {
    width: 100%;
    padding: 10px 15px;
    background-color: var(--theme-accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-primary);
    font-size: 1em;
    margin-bottom: 10px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--theme-accent-hover, #0056b3);
    }
  }
}

.game-container {
  position: relative;
  border: 3px solid var(--theme-canvas-border);
  border-radius: 10px;
  box-shadow: 0 0 25px rgba(34, 197, 94, 0.3);
  background-color: var(--theme-bg-primary);
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
  flex-shrink: 1;

  &.game-over {
    border-color: var(--theme-text-secondary);
    box-shadow: none;
  }

  canvas {
    display: block;
    border-radius: 7px;
    outline: none;
    cursor: crosshair;
    max-width: 100%;
    height: auto;

    // Improve rendering performance
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  // Responsive canvas sizing
  @media (max-width: 1000px) {
    canvas {
      width: 100%;
      max-width: 700px;
    }
  }

  @media (max-width: 700px) {
    canvas {
      max-width: 500px;
    }
  }

  @media (max-width: 500px) {
    canvas {
      max-width: 350px;
    }
  }
}

.minimap-container {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  border: 2px solid var(--theme-border-light);
  border-radius: 6px;
  padding: 4px;
  z-index: 100;

  .minimap {
    display: block;
    border-radius: 4px;
    background-color: #1a1a1a;

    // Ensure crisp pixel rendering
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  // Responsive minimap
  @media (max-width: 900px) {
    top: 5px;
    right: 5px;

    .minimap {
      width: 100px;
      height: 75px;
    }
  }

  @media (max-width: 600px) {
    .minimap {
      width: 80px;
      height: 60px;
    }
  }
}

// Old DOM-based styles removed - now using Canvas rendering

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 1000;

  &.paused-overlay {
    .overlay-content {
      background-color: var(--theme-bg-primary);
      padding: 20px 40px;
      border-radius: 10px;
      border: 2px solid var(--theme-border-light);

      h2 {
        margin: 0;
        color: var(--theme-text-primary);
        font-family: var(--font-primary);
        text-align: center;
      }
    }
  }
}
</style>
