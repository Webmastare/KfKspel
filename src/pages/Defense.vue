<template>
  <div class="main-container">
    <!-- Top UI Bar -->
    <div class="top-ui-bar">
      <div class="health-section">
        <div class="health-label">Health {{ player.health }} / {{ player.maxHealth }}</div>
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

      <div class="xp-section">
        <div class="level-display">Level {{ player.level }}</div>
        <div class="xp-bar-container">
          <div class="xp-bar">
            <div
              class="xp-progress"
              :style="{ width: (player.xp / player.xpToNextLevel) * 100 + '%' }"
            ></div>
          </div>
          <div class="xp-text">{{ player.xp }} / {{ player.xpToNextLevel }}</div>
        </div>
        <div class="multiplier-display">
          <div class="multiplier-main">{{ game.xpMultiplier.toFixed(3) }}x</div>
          <div class="multiplier-arc-container">
            <svg class="multiplier-arc" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="#444" stroke-width="2" />
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="#fbbf24"
                stroke-width="2"
                stroke-dasharray="62.83"
                :stroke-dashoffset="62.83 - (game.xpMultiplier % 1) * 62.83"
                transform="rotate(-90 12 12)"
                class="multiplier-progress-arc"
              />
            </svg>
          </div>
        </div>
      </div>

      <div class="weapon-section">
        <div class="weapon-name">{{ player.currentWeapon?.name || 'No Weapon' }}</div>
        <div class="weapon-stats">
          Dmg: {{ player.currentWeapon?.bullet?.damage || 0 }} | Rate:
          {{ (player.currentWeapon?.fireRate || 0).toFixed(1) }}/s | Range:
          {{ player.currentWeapon?.range || 0 }}
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
        @mousemove="handleCanvasMouseMove"
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

      <!-- Active Powerups HUD -->
      <div v-if="activePowerups.length > 0" class="powerups-hud">
        <h4>Active Effects</h4>
        <div
          v-for="powerup in activePowerups"
          :key="powerup.type"
          class="active-powerup"
          :style="{ borderLeftColor: powerup.color }"
        >
          <div class="powerup-info">
            <span class="powerup-name">{{ powerup.name }}</span>
            <span class="powerup-desc"
              >{{ powerup.description[0] }} {{ powerup.value }} {{ powerup.description[1] }}</span
            >
          </div>
          <div class="powerup-timer" v-if="powerup.effectType === 'duration'">
            <div class="timer-bar">
              <div
                class="timer-progress"
                :style="{
                  width:
                    Math.max(
                      0,
                      powerup.remainingTime /
                        (Date.now() - powerup.startTime + powerup.remainingTime),
                    ) *
                      100 +
                    '%',
                  backgroundColor: powerup.color,
                }"
              ></div>
            </div>
            <span class="timer-text">{{ Math.ceil(powerup.remainingTime / 1000) }}s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom UI Bar -->
    <div class="bottom-ui-bar">
      <div class="game-stats">
        <span>Wave: {{ game.waveNumber }}</span>
        <span>Difficulty: {{ game.difficulty }}</span>
        <span>Enemies: {{ enemies.length }}</span>
        <span>Killed: {{ game.enemiesKilled }}</span>
      </div>

      <div class="controls">
        <button @click="openWeaponShop" class="shop-btn">Shop (I)</button>
        <button @click="togglePause" class="pause-btn">
          {{ game.paused ? 'Resume' : 'Pause' }} (P)
        </button>
      </div>

      <div class="help-text">
        WASD/Arrows: Move | Space: Switch Weapon | ESC: Pause<br />
        <small
          >Enemy Types:
          <span style="color: #ef4444">■ Basic</span>
          <span v-if="game.difficulty >= 3" style="color: #fbbf24">■ Fast</span>
          <span v-if="game.difficulty >= 5" style="color: #8b5cf6">■ Shooter</span>
          <span v-if="game.difficulty >= 7" style="color: #6b7280">■ Tank</span>
          <span v-if="game.difficulty >= 10" style="color: #dc2626">■ Elite</span>
        </small>
      </div>
    </div>

    <!-- Shop Component -->
    <DefenseShop
      ref="shopComponent"
      :isVisible="showShop"
      :playerMoney="player.money"
      :playerLevel="player.level"
      :currentXp="player.xp"
      :xpToNext="player.xpToNextLevel"
      :currentWeapon="player.currentWeapon"
      :ownedWeapons="player.ownedWeapons"
      :weaponTemplates="weaponTemplates"
      :placeableTemplates="placeableTemplates"
      @close="closeShop"
      @buyWeapon="handleBuyWeapon"
      @selectWeapon="handleSelectWeapon"
      @upgradeWeapon="handleUpgradeWeapon"
      @startPlacement="handleStartPlacement"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { renderFrame } from '@/components/defenseGame/renderer'
import type {
  Enemy,
  EnemyBullet,
  Player,
  GameState,
  Bullet,
  Powerup,
  ActivePowerup,
  Placeable,
  PlaceableTemplate,
  PlacementPreview,
  Turret,
  Wall,
} from '@/components/defenseGame/defenseTypes'
import { EnemyType, PowerupType, PlaceableType } from '@/components/defenseGame/defenseTypes'
// Enemy-related imports
import {
  enemyTemplates,
  getDifficultyLevel,
  getWaveNumber,
  scaleEnemyStats,
  selectEnemyType,
  getEnemyXpValue,
} from '@/components/defenseGame/enemies'
// Weapon-related imports
import {
  weaponTemplates,
  createWeaponCopy,
  calculateUpgradeCost,
} from '@/components/defenseGame/weapons'
// Player-related imports
import {
  calculateXpGained,
  checkLevelUp,
  getXpRequiredForLevel,
  updateMultiplier,
  increaseMultiplier,
} from '@/components/defenseGame/player'
// Collision system import
import { CollisionSystem } from '@/components/defenseGame/collision'
// Powerup system imports
import {
  createPowerup,
  getPowerupSpawnChance,
  getRandomPowerupSpawnPosition,
  powerupTemplates,
  shouldPowerupDespawn,
} from '@/components/defenseGame/powerupSystem'
// Animation system imports
import {
  createDefenseAnimationState,
  updateDefenseAnimations,
  addBulletImpact,
  addEnemyDestroy,
  addMuzzleFlash,
  type DefenseAnimationState,
} from '@/components/defenseGame/animations'
// Placeable system imports
import {
  placeableTemplates,
  createPlaceable,
  isValidPlacement,
  createPlacementPreview,
  updateTurret,
  damagePlaceable,
  findClosestEnemyInRange as findClosestEnemyForTurret,
  checkLineWallIntersection,
} from '@/components/defenseGame/placeables'
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

// Animation state
const animationState = reactive<DefenseAnimationState>(createDefenseAnimationState())

// Input state - using Set for cleaner key tracking
const activeKeys = reactive(new Set<string>())

const basicGunTemplate = weaponTemplates['Basic Gun']
if (!basicGunTemplate) {
  console.error('Basic Gun template not found!')
}

const player: Player = reactive({
  x: 600, // Center of world
  y: 450,
  width: 50,
  height: 50,
  speed: 5,
  angle: 0,
  health: 100,
  maxHealth: 100,
  currentWeapon: basicGunTemplate
    ? createWeaponCopy(basicGunTemplate)
    : {
        name: 'Basic Gun',
        fireRate: 1,
        penetration: 1,
        lastShotTime: 0,
        range: 350,
        cost: 0,
        levelRequired: 1,
        weaponType: 'single',
        bullet: {
          speed: 700,
          size: 4,
          damage: 25,
          particleCount: 1.0,
          explosionRadius: 0.8,
          color: '#FFD700',
          trailLength: 1.0,
        },
      },
  upgrades: {},
  money: 10000, // Starting money
  ownedWeapons: {
    'Basic Gun': basicGunTemplate
      ? createWeaponCopy(basicGunTemplate)
      : {
          name: 'Basic Gun',
          fireRate: 1,
          penetration: 1,
          lastShotTime: 0,
          range: 350,
          cost: 0,
          levelRequired: 1,
          weaponType: 'single',
          bullet: {
            speed: 700,
            size: 4,
            damage: 25,
            particleCount: 1.0,
            explosionRadius: 0.8,
            color: '#FFD700',
            trailLength: 1.0,
          },
        },
  },
  // XP System
  level: 10,
  xp: 0,
  xpToNextLevel: getXpRequiredForLevel(2), // XP needed for level 2
  totalXp: 0,
})

const enemies = reactive<Enemy[]>([])
const bullets = reactive<Bullet[]>([])
const enemyBullets = reactive<EnemyBullet[]>([])
const powerups = reactive<Powerup[]>([])
const activePowerups = reactive<ActivePowerup[]>([])
const placeables = reactive<Placeable[]>([])

// Placement system state
const placementMode = ref<{ active: boolean; template: PlaceableTemplate | null }>({
  active: false,
  template: null,
})
const placementPreview = ref<PlacementPreview | null>(null)
const game = reactive<GameState>({
  game_width: 900,
  game_height: 600,
  world_width: 1800,
  world_height: 1400,
  running: false,
  paused: false,
  score: 0,
  lastTime: 0,
  baseEnemySpawnInterval: 1500, // Increased from 100ms to 1.5 seconds
  frameId: null,
  enemiesKilled: 100,
  difficulty: 1,
  waveNumber: 1,
  camera: { x: 0, y: 0 },
  // XP Multiplier System
  xpMultiplier: 1.0, // Start with 1x multiplier
  lastKillTime: 0, // Timestamp of last enemy kill

  // Settings
  autofireMode: false,
})

// Initialize collision system
const collisionSystem = new CollisionSystem(game.world_width, game.world_height, 100)

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

/** Timestamp: time since first called */
// Powerup system variables
let lastPowerupSpawnTime = 0
const powerupSpawnInterval = 100 // Try to spawn a powerup every 8 seconds

function checkPowerupSpawn(timestamp: number) {
  const spawnChance = getPowerupSpawnChance(game.enemiesKilled, game.difficulty)

  if (timestamp - lastPowerupSpawnTime > powerupSpawnInterval) {
    if (Math.random() < spawnChance) {
      const position = getRandomPowerupSpawnPosition(
        game.world_width,
        game.world_height,
        player.x,
        player.y,
      )
      const powerup = createPowerup(position.x, position.y)
      powerups.push(powerup)
    }
    lastPowerupSpawnTime = timestamp
  }
}

function updatePowerups() {
  // Remove expired powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const powerup = powerups[i]
    if (!powerup) continue

    if (shouldPowerupDespawn(powerup)) {
      powerups.splice(i, 1)
      continue
    }

    // Check for collision with player
    const distToPlayer = Math.hypot(powerup.x - player.x, powerup.y - player.y)
    if (distToPlayer < (player.width + powerup.width) / 2 + 10) {
      collectPowerup(powerup)
      powerups.splice(i, 1)
    }
  }
}

function collectPowerup(powerup: Powerup) {
  const now = Date.now()

  if (powerup.effect.type === 'instant') {
    // Apply instant effects immediately
    switch (powerup.type) {
      case PowerupType.HEALTH_PACK:
        player.health = Math.min(player.maxHealth, player.health + powerup.effect.value)
        break
      case PowerupType.CASH_BONUS:
        player.money += powerup.effect.value
        break
    }
    // Add to active powerups to display in HUD
    const activePowerup: ActivePowerup = {
      type: powerup.type,
      effectType: 'instant',
      name: powerup.name,
      value: powerup.effect.value,
      description: powerup.description,
      color: powerup.color,
      remainingTime: 3000,
      startTime: now,
    }
    activePowerups.push(activePowerup)
  } else if (powerup.effect.type === 'duration') {
    // Add or refresh duration-based effect
    const existingIndex = activePowerups.findIndex((ap) => ap.type === powerup.type)

    if (existingIndex >= 0 && activePowerups[existingIndex]) {
      // Refresh existing powerup
      activePowerups[existingIndex].remainingTime = powerup.effect.duration!
      activePowerups[existingIndex].startTime = now
      // Increase value if new value is higher (for stacking effects)
      if (powerup.effect.value > activePowerups[existingIndex].value) {
        activePowerups[existingIndex].value = powerup.effect.value
      }
    } else {
      // Add new active powerup
      const activePowerup: ActivePowerup = {
        type: powerup.type,
        effectType: 'duration',
        name: powerup.name,
        value: powerup.effect.value, // Slight randomization for variety
        description: powerup.description,
        color: powerup.color,
        remainingTime: powerup.effect.duration!,
        startTime: now,
      }
      activePowerups.push(activePowerup)
    }
  }
}

function updateActivePowerups(deltaTime: number) {
  for (let i = activePowerups.length - 1; i >= 0; i--) {
    const powerup = activePowerups[i]
    if (!powerup) continue

    powerup.remainingTime -= deltaTime

    if (powerup.remainingTime <= 0) {
      activePowerups.splice(i, 1)
    }
  }
}

// Get effective stats with powerup bonuses
function getEffectivePlayerSpeed(): number {
  let speedMultiplier = 1

  for (const powerup of activePowerups) {
    if (powerup.type === PowerupType.SPEED_BOOST) {
      speedMultiplier *= powerup.value / 100 + 1
    }
  }

  return player.speed * speedMultiplier
}

function getEffectiveWeaponDamage(): number {
  let damageMultiplier = 1

  for (const powerup of activePowerups) {
    if (powerup.type === PowerupType.DAMAGE_BOOST) {
      damageMultiplier *= powerup.value / 100 + 1
    }
  }

  return (player.currentWeapon?.bullet?.damage || 25) * damageMultiplier
}

function getEffectiveFireRate(): number {
  let fireRateMultiplier = 1

  for (const powerup of activePowerups) {
    if (powerup.type === PowerupType.FIRE_RATE_BOOST) {
      fireRateMultiplier *= powerup.value / 100 + 1
    }
  }

  return (player.currentWeapon?.fireRate || 1) * fireRateMultiplier
}

function getEffectivePenetration(): number {
  let penetrationBonus = 0

  for (const powerup of activePowerups) {
    if (powerup.type === PowerupType.PENETRATION_BOOST) {
      penetrationBonus += powerup.value
    }
  }

  return (player.currentWeapon?.penetration || 1) + penetrationBonus
}

function getEffectiveBulletCount(): number {
  for (const powerup of activePowerups) {
    if (powerup.type === PowerupType.MULTISHOT) {
      return powerup.value
    }
  }

  return player.currentWeapon?.bulletCount || 1
}

function hasShield(): boolean {
  return activePowerups.some((p) => p.type === PowerupType.SHIELD)
}

function consumeShieldHit() {
  const shieldIndex = activePowerups.findIndex((p) => p.type === PowerupType.SHIELD)
  if (shieldIndex >= 0 && activePowerups[shieldIndex]) {
    const shield = activePowerups[shieldIndex]
    if (!shield) return

    // Decrease shield value (hit count)
    activePowerups[shieldIndex].value -= 1
    if (activePowerups[shieldIndex].value <= 0) {
      activePowerups.splice(shieldIndex, 1)
    }
  }
}

function gameLoop(timestamp: number) {
  const deltaTime = timestamp - game.lastTime
  game.lastTime = timestamp

  if (!game.paused) {
    // Update game state
    checkEnemySpawn(timestamp)
    checkPowerupSpawn(timestamp)
    updateEnemies(deltaTime)
    updatePlaceables(deltaTime, timestamp)
    updatePowerups()
    updateActivePowerups(deltaTime)
    // Process enemy-to-enemy collisions
    collisionSystem.processCollisions(enemies)
    updateBullets(deltaTime)
    updateEnemyBullets(deltaTime)
    updatePlayerPosition()
    updateCamera()
    handleShooting(timestamp)
    // Update XP multiplier decay
    updateXpMultiplier(deltaTime)
    // Update animations
    updateDefenseAnimations(animationState, timestamp)
  }

  // Always render the frame
  renderFrame(
    ctx,
    minimapCtx,
    game,
    player,
    enemies,
    bullets,
    enemyBullets,
    powerups,
    placeables,
    placementPreview.value,
    animationState,
  )

  // Request next frame
  game.frameId = requestAnimationFrame(gameLoop)
}

function updatePlayerPosition() {
  let deltaX = 0
  let deltaY = 0

  // Check for active movement keys
  const hasUpKey = Array.from(activeKeys).some(isUpKey)
  const hasDownKey = Array.from(activeKeys).some(isDownKey)
  const hasLeftKey = Array.from(activeKeys).some(isLeftKey)
  const hasRightKey = Array.from(activeKeys).some(isRightKey)

  // Handle multiple key presses for diagonal movement
  const effectiveSpeed = getEffectivePlayerSpeed()
  if (hasUpKey) {
    deltaY -= effectiveSpeed
  }
  if (hasDownKey) {
    deltaY += effectiveSpeed
  }
  if (hasLeftKey) {
    deltaX -= effectiveSpeed
  }
  if (hasRightKey) {
    deltaX += effectiveSpeed
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

function updateXpMultiplier(deltaTime: number) {
  // Only decay if there was a previous kill
  if (game.lastKillTime > 0) {
    const timeSinceLastKill = Date.now() - game.lastKillTime
    // Update multiplier with decay if no recent kills
    game.xpMultiplier = updateMultiplier(game.xpMultiplier, timeSinceLastKill, deltaTime)
  }
}

function handleShooting(timestamp: number) {
  const timeSinceLastShot = timestamp - player.currentWeapon.lastShotTime
  const effectiveFireRate = getEffectiveFireRate()
  const shotInterval = 1000 / effectiveFireRate // Convert to milliseconds

  if (timeSinceLastShot >= shotInterval && enemies.length > 0 && game.autofireMode) {
    // Find closest enemy within range
    const closestEnemy = findClosestEnemyInRange()
    if (closestEnemy) {
      // Add muzzle flash animation
      const angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x)
      addMuzzleFlash(
        animationState,
        player.x,
        player.y,
        angle,
        player.currentWeapon?.weaponType || 'single',
      )

      shootBullet(closestEnemy)
      if (player.currentWeapon) {
        player.currentWeapon.lastShotTime = timestamp
      }
    }
  }
}

function findClosestEnemyInRange(): Enemy | null {
  // Sort enemies by distance and prioritize closest ones
  const enemiesWithDistance = enemies
    .map((enemy) => ({
      enemy,
      distance: Math.hypot(player.x - enemy.x, player.y - enemy.y),
    }))
    .filter((item) => item.distance <= (player.currentWeapon?.range || 350))
    .sort((a, b) => a.distance - b.distance)

  // Return the closest enemy
  return enemiesWithDistance.length > 0 && enemiesWithDistance[0]
    ? enemiesWithDistance[0].enemy
    : null
}

function shootBullet(target: Enemy) {
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x)
  const weapon = player.currentWeapon
  if (!weapon) return

  const effectiveDamage = getEffectiveWeaponDamage()
  const effectivePenetration = getEffectivePenetration()
  const effectiveBulletCount = getEffectiveBulletCount()

  // Handle different weapon types or multishot powerup
  if (
    (weapon.weaponType === 'shotgun' && weapon.bulletCount && weapon.spread) ||
    effectiveBulletCount > 1
  ) {
    // Shotgun or multishot - fire multiple bullets with spread
    const spreadRadians = weapon.spread ? (weapon.spread * Math.PI) / 180 : Math.PI / 6 // Default 30° spread for multishot
    const bulletCount =
      weapon.weaponType === 'shotgun' ? weapon.bulletCount || 1 : effectiveBulletCount

    for (let i = 0; i < bulletCount; i++) {
      // Calculate spread angle for each bullet
      const spreadRange = spreadRadians
      const spreadStep = spreadRange / (bulletCount - 1)
      const bulletAngle = baseAngle + i * spreadStep - spreadRange / 2

      const bullet: Bullet = {
        id: Date.now() + Math.random() + i, // Ensure unique ID
        x: player.x,
        y: player.y,
        width: weapon.bullet?.size || 4,
        height: weapon.bullet?.size || 4,
        speed: weapon.bullet?.speed || 700,
        angle: bulletAngle,
        damage: effectiveDamage,
        penetrationLeft: weapon.weaponType === 'shotgun' ? 0 : effectivePenetration, // Shotgun pellets don't penetrate, but multishot does
        targetX: target.x + Math.cos(bulletAngle) * 100, // Spread target
        targetY: target.y + Math.sin(bulletAngle) * 100,
        createdAt: Date.now(),
        // Animation properties from bullet config
        particleCount: weapon.bullet?.particleCount || 1.0,
        explosionRadius: weapon.bullet?.explosionRadius || 0.8,
        color: weapon.bullet?.color || '#FFD700',
        trailLength: weapon.bullet?.trailLength || 1.0,
      }

      bullets.push(bullet)
    }
  } else {
    // Single shot weapons (rifles, pistols, etc.)
    const bullet: Bullet = {
      id: Date.now() + Math.random(),
      x: player.x,
      y: player.y,
      width: weapon.bullet?.size || 4,
      height: weapon.bullet?.size || 4,
      speed: weapon.bullet?.speed || 700,
      angle: baseAngle,
      damage: effectiveDamage,
      penetrationLeft: effectivePenetration,
      targetX: target.x,
      targetY: target.y,
      createdAt: Date.now(),
      // Animation properties from bullet config
      particleCount: weapon.bullet?.particleCount || 1.0,
      explosionRadius: weapon.bullet?.explosionRadius || 0.8,
      color: weapon.bullet?.color || '#FFD700',
      trailLength: weapon.bullet?.trailLength || 1.0,
    }

    bullets.push(bullet)
  }
}

function updateBullets(deltaTime: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet) continue

    // Move bullet in straight line based on its angle
    const deltaSpeed = bullet.speed * (deltaTime / 1000) // Normalize to 60fps
    const oldX = bullet.x
    const oldY = bullet.y
    bullet.x += Math.cos(bullet.angle) * deltaSpeed
    bullet.y += Math.sin(bullet.angle) * deltaSpeed

    // Check for wall collisions
    let hitWall = false
    for (const placeable of placeables) {
      if (placeable.type === PlaceableType.WALL) {
        const wall = placeable as Wall
        const intersection = checkLineWallIntersection(oldX, oldY, bullet.x, bullet.y, wall)
        if (intersection.intersects) {
          // Hit wall
          addBulletImpact(
            animationState,
            intersection.intersectionX || bullet.x,
            intersection.intersectionY || bullet.y,
            bullet.particleCount,
            bullet.explosionRadius,
            bullet.color || '#FFD700',
          )
          hitWall = true
          break
        }
      }
    }

    if (hitWall) {
      bullets.splice(i, 1)
      continue
    }

    // Check for enemy hits with generous detection
    let hitEnemy = false
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j]
      if (!enemy) continue

      const distToEnemy = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y)
      // Hit detection with reasonable tolerance
      if (distToEnemy < (enemy.width + bullet.width) / 2 + 20) {
        // Hit enemy - create bullet impact animation
        addBulletImpact(
          animationState,
          enemy.x,
          enemy.y,
          bullet.particleCount,
          bullet.explosionRadius,
          bullet.color || '#FFD700',
        )

        enemy.health -= bullet.damage
        hitEnemy = true

        if (enemy.health <= 0) {
          // Create enemy destruction animation
          const enemyTemplate = enemyTemplates[enemy.type]
          addEnemyDestroy(
            animationState,
            enemy.x,
            enemy.y,
            Math.max(enemy.width, enemy.height),
            enemyTemplate.color,
          )

          enemies.splice(j, 1)
          game.score += enemy.value * 10 // Use enemy value for scoring
          game.enemiesKilled++
          // Award money based on enemy value
          player.money += enemy.value

          // XP System - Calculate XP with multiplier
          const currentTime = Date.now()

          // Update multiplier based on kill timing
          game.xpMultiplier = increaseMultiplier(game.xpMultiplier)
          game.lastKillTime = currentTime

          // Award XP based on enemy type and multiplier
          const xpGained = calculateXpGained(enemy.type, game.xpMultiplier)
          player.xp += xpGained
          player.totalXp += xpGained

          // Check for level up
          const levelResult = checkLevelUp(player.level, player.xp, player.xpToNextLevel)
          if (levelResult.leveledUp) {
            player.xp = 0
            player.level = levelResult.newLevel
            player.xpToNextLevel = levelResult.newXpToNextLevel
            // TODO: Could add level up effects/rewards here later
          }
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

function updateEnemyBullets(deltaTime: number) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i]
    if (!bullet) continue

    // Move bullet in straight line based on its angle
    const deltaSpeed = bullet.speed * (deltaTime / 1000)
    const oldX = bullet.x
    const oldY = bullet.y
    bullet.x += Math.cos(bullet.angle) * deltaSpeed
    bullet.y += Math.sin(bullet.angle) * deltaSpeed

    // Check for wall collisions
    let hitWall = false
    for (const placeable of placeables) {
      if (placeable.type === PlaceableType.WALL) {
        const wall = placeable as Wall
        if (wall.blocksBullets) {
          const intersection = checkLineWallIntersection(oldX, oldY, bullet.x, bullet.y, wall)
          if (intersection.intersects) {
            // Enemy bullets can damage walls
            damagePlaceable(wall, bullet.damage)

            // Add impact effect
            addBulletImpact(
              animationState,
              intersection.intersectionX || bullet.x,
              intersection.intersectionY || bullet.y,
              0.5, // Small impact for enemy bullets
              0.3,
              '#ef4444',
            )
            hitWall = true
            break
          }
        }
      }
    }

    if (hitWall) {
      enemyBullets.splice(i, 1)
      continue
    }

    // Check for player hit
    const distToPlayer = Math.hypot(bullet.x - player.x, bullet.y - player.y)
    if (distToPlayer < (player.width + bullet.width) / 2 + 10) {
      if (hasShield()) {
        consumeShieldHit()
      } else {
        player.health -= bullet.damage
      }
      enemyBullets.splice(i, 1)
      continue
    }

    // Remove bullets that are out of bounds or too old
    if (
      bullet.x < -50 ||
      bullet.x > game.world_width + 50 ||
      bullet.y < -50 ||
      bullet.y > game.world_height + 50 ||
      Date.now() - bullet.createdAt > 2000
    ) {
      enemyBullets.splice(i, 1)
    }
  }
}

// Optimized enemy spawning - integrated into game loop instead of separate interval
let lastSpawnTime = 0
function checkEnemySpawn(timestamp: number) {
  // Much more gradual spawn rate increase
  const difficultyMultiplier = 1 + (game.difficulty - 1) * 0.2
  const spawnInterval = game.baseEnemySpawnInterval / difficultyMultiplier
  if (timestamp - lastSpawnTime > spawnInterval) {
    spawnEnemy()
    lastSpawnTime = timestamp
  }
}

function updateEnemies(deltaTime: number) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i]
    if (!enemy) continue

    // Enemies should move towards the player
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x)
    const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y)

    // Different movement behavior for different enemy types
    if (enemy.type === EnemyType.SHOOTER || enemy.type === EnemyType.ELITE) {
      // Shooter enemies try to maintain distance and shoot
      if (enemy.range && distToPlayer > enemy.range * 0.8) {
        // Move closer if too far
        const newX = enemy.x + enemy.speed * Math.cos(angleToPlayer) * (deltaTime / 16)
        const newY = enemy.y + enemy.speed * Math.sin(angleToPlayer) * (deltaTime / 16)

        // Check wall collision before moving
        if (!isPositionBlockedByWall(newX, newY, enemy.width, enemy.height)) {
          enemy.x = newX
          enemy.y = newY
        }
      } else if (distToPlayer < enemy.range! * 0.6) {
        // Move away if too close
        const newX = enemy.x - enemy.speed * Math.cos(angleToPlayer) * (deltaTime / 16)
        const newY = enemy.y - enemy.speed * Math.sin(angleToPlayer) * (deltaTime / 16)

        // Check wall collision before moving
        if (!isPositionBlockedByWall(newX, newY, enemy.width, enemy.height)) {
          enemy.x = newX
          enemy.y = newY
        }
      }

      // Handle shooting
      handleEnemyShooting(enemy, distToPlayer, angleToPlayer)
    } else {
      // Regular movement towards player for other enemy types
      const newX = enemy.x + enemy.speed * Math.cos(angleToPlayer) * (deltaTime / 16)
      const newY = enemy.y + enemy.speed * Math.sin(angleToPlayer) * (deltaTime / 16)

      // Check wall collision before moving
      if (!isPositionBlockedByWall(newX, newY, enemy.width, enemy.height)) {
        enemy.x = newX
        enemy.y = newY
      }
    }

    // If enemy reaches player, reduce player health
    if (distToPlayer < (player.width + enemy.width) / 2 + 5) {
      if (hasShield()) {
        consumeShieldHit()
      } else {
        player.health -= enemy.damage
      }
      enemies.splice(i, 1)
    }
  }
}

function handleEnemyShooting(enemy: Enemy, distToPlayer: number, angleToPlayer: number) {
  if (!enemy.range || !enemy.fireRate || !enemy.bulletSpeed) {
    return // Enemy can't shoot if missing required properties
  }

  // Initialize lastShotTime if it's undefined (fallback for any missed initialization)
  if (enemy.lastShotTime === undefined || enemy.lastShotTime === null) {
    enemy.lastShotTime = Date.now() - 10000 // Allow immediate shooting
  }

  const now = Date.now()
  const shotInterval = 1000 / enemy.fireRate

  if (distToPlayer <= enemy.range && now - enemy.lastShotTime >= shotInterval) {
    // Scale bullet damage based on difficulty for more challenging gameplay
    const difficultyDamageMultiplier = 1 + (game.difficulty - 1) * 0.15
    const bulletDamage = Math.floor(enemy.damage * 0.6 * difficultyDamageMultiplier)

    const enemyBullet: EnemyBullet = {
      id: Date.now() + Math.random(),
      x: enemy.x,
      y: enemy.y,
      width: 6,
      height: 6,
      speed: enemy.bulletSpeed,
      angle: angleToPlayer,
      damage: bulletDamage, // Scaled damage based on difficulty
      createdAt: now,
    }

    enemyBullets.push(enemyBullet)
    enemy.lastShotTime = now
  }
}

function spawnEnemy() {
  // Update difficulty and wave based on enemies killed
  game.difficulty = getDifficultyLevel(game.enemiesKilled)
  game.waveNumber = getWaveNumber(game.enemiesKilled)

  // Select enemy type based on difficulty
  const enemyType = selectEnemyType(game.difficulty)
  const template = enemyTemplates[enemyType]
  const scaledStats = scaleEnemyStats(template, game.difficulty)

  // Spawn enemies at the edges of the world
  const side = Math.floor(Math.random() * 4) // 0: top, 1: right, 2: bottom, 3: left
  let x, y

  switch (side) {
    case 0: // top
      x = Math.random() * game.world_width
      y = -50
      break
    case 1: // right
      x = game.world_width + 50
      y = Math.random() * game.world_height
      break
    case 2: // bottom
      x = Math.random() * game.world_width
      y = game.world_height + 50
      break
    case 3: // left
      x = -50
      y = Math.random() * game.world_height
      break
    default:
      x = 0
      y = 0
  }

  const enemy: Enemy = {
    id: Date.now() + Math.random(),
    x,
    y,
    angle: 0,
    ...scaledStats,
  }

  enemies.push(enemy)
}

function updatePlaceables(deltaTime: number, timestamp: number) {
  // Update turrets - they should target and shoot at enemies
  for (let i = placeables.length - 1; i >= 0; i--) {
    const placeable = placeables[i]
    if (!placeable) continue

    if (placeable.type === PlaceableType.TURRET) {
      const turret = placeable as Turret

      // Update turret targeting and shooting
      updateTurret(turret, enemies, timestamp)

      // Create bullets from turret if it should shoot
      if (turret.targetEnemyId) {
        const timeSinceLastShot = timestamp - turret.lastShotTime
        const shotInterval = 1000 / turret.weapon.fireRate
        if (timeSinceLastShot >= shotInterval) {
          const target = enemies.find((e) => e.id === turret.targetEnemyId)
          if (target) {
            // Create bullet from turret to target
            const bullet: Bullet = {
              id: Date.now() + Math.random() * 1000,
              x: turret.x,
              y: turret.y,
              width: turret.weapon.bullet.size,
              height: turret.weapon.bullet.size,
              speed: turret.weapon.bullet.speed,
              angle: turret.angle,
              damage: turret.weapon.bullet.damage,
              penetrationLeft: turret.weapon.penetration || 1,
              targetX: target.x,
              targetY: target.y,
              createdAt: Date.now(),
              particleCount: turret.weapon.bullet.particleCount,
              explosionRadius: turret.weapon.bullet.explosionRadius,
              color: turret.weapon.bullet.color || '#FFD700',
              trailLength: turret.weapon.bullet.trailLength || 1.0,
            }
            bullets.push(bullet)

            // Add muzzle flash animation
            addMuzzleFlash(
              animationState,
              turret.x,
              turret.y,
              turret.angle,
              turret.weapon.weaponType || 'single',
            )
            turret.lastShotTime = timestamp
          }
        }
      }
    }

    // Check if placeable was destroyed
    if (placeable.health <= 0) {
      // Add destruction animation
      const destroyColor = placeable.type === PlaceableType.TURRET ? '#4a6aa6' : '#ff8c42'
      addEnemyDestroy(
        animationState,
        placeable.x,
        placeable.y,
        Math.max(placeable.width, placeable.height),
        destroyColor,
      )

      placeables.splice(i, 1)
    }
  }
}

// Helper functions for key handling
function isMovementKey(key: string): boolean {
  switch (key.toLowerCase()) {
    case 'w':
    case 's':
    case 'a':
    case 'd':
    case 'arrowup':
    case 'arrowdown':
    case 'arrowleft':
    case 'arrowright':
      return true
    default:
      return false
  }
}

function isUpKey(key: string): boolean {
  return key === 'w' || key === 'arrowup'
}

function isDownKey(key: string): boolean {
  return key === 's' || key === 'arrowdown'
}

function isLeftKey(key: string): boolean {
  return key === 'a' || key === 'arrowleft'
}

function isRightKey(key: string): boolean {
  return key === 'd' || key === 'arrowright'
}

function handleKeyPress(event: KeyboardEvent) {
  if (!event.key) return // Guard against undefined key

  const key = event.key.toLowerCase()

  // Handle movement keys
  if (isMovementKey(key)) {
    activeKeys.add(key)
  }

  // Handle action keys
  switch (key) {
    case ' ':
      event.preventDefault()
      const ownedWeaponNames = Object.keys(player.ownedWeapons)
      const currentIndex = ownedWeaponNames.indexOf(player.currentWeapon.name)
      const nextIndex = (currentIndex + 1) % ownedWeaponNames.length
      const nextWeapon = ownedWeaponNames[nextIndex]
      if (nextWeapon) handleSelectWeapon(nextWeapon)
      break

    case 'i':
      event.preventDefault()
      openWeaponShop()
      break

    case 'p':
      event.preventDefault()
      togglePause()
      break

    case 'escape':
      event.preventDefault()
      if (showShop.value) {
        closeShop()
      } else if (placementMode.value.active) {
        cancelPlacement()
      } else {
        togglePause()
      }
      break
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (!event.key) return // Guard against undefined key

  const key = event.key.toLowerCase()
  if (isMovementKey(key)) {
    activeKeys.delete(key)
  }
}

function handleCanvasClick(event: MouseEvent) {
  // Focus the canvas for keyboard events
  if (gameCanvas.value) {
    gameCanvas.value.focus()
  }

  // Handle placement mode
  if (placementMode.value.active && placementPreview.value) {
    const rect = gameCanvas.value?.getBoundingClientRect()
    if (rect) {
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      const worldX = mouseX + game.camera.x
      const worldY = mouseY + game.camera.y

      if (placementPreview.value.isValid) {
        tryPlacePlaceable(worldX, worldY)
      }
    }
  }
}

function handleCanvasMouseMove(event: MouseEvent) {
  if (!placementMode.value.active) return

  const rect = gameCanvas.value?.getBoundingClientRect()
  if (rect) {
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    updatePlacementPreview(mouseX, mouseY)
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
      damage: () => (weapon.bullet.damage = Math.floor(weapon.bullet.damage * 1.2)),
      fireRate: () => (weapon.fireRate *= 1.15),
      range: () => (weapon.range = Math.floor(weapon.range * 1.1)),
      penetration: () => {
        if (weapon.penetration !== undefined) {
          weapon.penetration += 1
        }
      },
      bulletCount: () => {
        if (weapon.bulletCount !== undefined) {
          weapon.bulletCount += 1
        }
      },
      spread: () => {
        if (weapon.spread !== undefined) {
          weapon.spread = Math.max(5, weapon.spread - 2) // Reduce spread by 2 degrees, minimum 5
        }
      },
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

// Placement system functions
function handleStartPlacement(template: PlaceableTemplate) {
  placementMode.value.active = true
  placementMode.value.template = template
  closeShop() // Close shop when starting placement
}

function cancelPlacement() {
  placementMode.value.active = false
  placementMode.value.template = null
  placementPreview.value = null
}

function tryPlacePlaceable(x: number, y: number) {
  const template = placementMode.value.template
  if (!template || !placementPreview.value?.isValid) return false

  if (player.money >= template.cost) {
    // Create and place the placeable
    const newPlaceable = createPlaceable(template, x, y)
    placeables.push(newPlaceable)

    // Deduct money
    player.money -= template.cost

    // Exit placement mode
    cancelPlacement()
    return true
  }
  return false
}

function updatePlacementPreview(mouseX: number, mouseY: number) {
  const template = placementMode.value.template
  if (!template) return

  // Convert screen coordinates to world coordinates
  const worldX = mouseX + game.camera.x
  const worldY = mouseY + game.camera.y

  placementPreview.value = createPlacementPreview(
    template,
    worldX,
    worldY,
    game,
    placeables,
    player,
  )
}

// Wall collision helper function
function isPositionBlockedByWall(x: number, y: number, width: number, height: number): boolean {
  const halfWidth = width / 2
  const halfHeight = height / 2

  for (const placeable of placeables) {
    if (placeable.type === PlaceableType.WALL) {
      const wall = placeable as Wall

      // Check if the entity would overlap with the wall
      const wallLeft = wall.x - wall.width / 2
      const wallRight = wall.x + wall.width / 2
      const wallTop = wall.y - wall.height / 2
      const wallBottom = wall.y + wall.height / 2

      const entityLeft = x - halfWidth
      const entityRight = x + halfWidth
      const entityTop = y - halfHeight
      const entityBottom = y + halfHeight

      // Check for overlap
      if (
        entityLeft < wallRight &&
        entityRight > wallLeft &&
        entityTop < wallBottom &&
        entityBottom > wallTop
      ) {
        return true
      }
    }
  }
  return false
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

  // Collision system is automatically initialized with world dimensions
  // and will be processed each frame in the game loop
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
  background-color: var(--theme-bg-primary);
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
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

  .xp-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;

    .level-display {
      font-size: 1.1em;
      font-weight: bold;
      color: var(--theme-text-primary);
      text-align: center;
    }

    .xp-bar-container {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .xp-bar {
        width: 140px;
        height: 16px;
        background-color: var(--theme-border-light);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--theme-border-light);

        .xp-progress {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s ease;
          border-radius: 7px;
        }
      }

      .xp-text {
        font-size: 0.75em;
        color: var(--theme-text-secondary);
        text-align: center;
      }
    }

    .multiplier-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;

      .multiplier-main {
        font-weight: bold;
        font-size: 1.2em;
        color: #fbbf24;
        text-shadow: 0 0 4px rgba(251, 191, 36, 0.4);
      }

      .multiplier-arc-container {
        position: relative;

        .multiplier-arc {
          transform: rotate(-90deg);

          .multiplier-progress-arc {
            transition: stroke-dashoffset 0.2s ease;
          }
        }
      }
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

    small {
      display: block;
      margin-top: 4px;
      font-size: 0.8em;
      opacity: 0.8;

      span {
        margin-right: 8px;
        font-weight: bold;
      }
    }
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

.powerups-hud {
  position: absolute;
  top: 120px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  border: 2px solid var(--theme-border-light);
  border-radius: 8px;
  padding: 12px;
  max-width: 280px;
  z-index: 100;

  h4 {
    margin: 0 0 8px 0;
    color: var(--theme-text-primary);
    font-family: var(--font-primary);
    font-size: 14px;
    text-align: center;
  }

  .active-powerup {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    margin-bottom: 6px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    border-left: 3px solid #fbbf24;
    transition: all 0.2s ease;

    &:last-child {
      margin-bottom: 0;
    }

    &:hover {
      background-color: rgba(255, 255, 255, 0.15);
    }

    .powerup-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      margin-right: 12px;

      .powerup-name {
        color: var(--theme-text-primary);
        font-weight: bold;
        font-size: 12px;
        margin-bottom: 2px;
      }

      .powerup-desc {
        color: var(--theme-text-secondary);
        font-size: 10px;
      }
    }

    .powerup-timer {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 60px;

      .timer-bar {
        width: 50px;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 2px;

        .timer-progress {
          height: 100%;
          background-color: #fbbf24;
          border-radius: 2px;
          transition: width 0.1s ease-out;
        }
      }

      .timer-text {
        color: var(--theme-text-secondary);
        font-size: 10px;
        font-family: monospace;
      }
    }
  }

  // Responsive powerup HUD
  @media (max-width: 900px) {
    top: 100px;
    right: 5px;
    max-width: 240px;
    padding: 8px;

    h4 {
      font-size: 12px;
      margin-bottom: 6px;
    }

    .active-powerup {
      padding: 4px 6px;

      .powerup-info {
        margin-right: 8px;

        .powerup-name {
          font-size: 11px;
        }

        .powerup-desc {
          font-size: 9px;
        }
      }

      .powerup-timer {
        min-width: 50px;

        .timer-bar {
          width: 40px;
          height: 3px;
        }

        .timer-text {
          font-size: 9px;
        }
      }
    }
  }

  @media (max-width: 600px) {
    max-width: 200px;
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
