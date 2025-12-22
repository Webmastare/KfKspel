<template>
  <div class="shop-overlay" v-if="isVisible" @click.self="closeShop">
    <div class="shop-container">
      <div class="shop-header">
        <h2>🛡️ Defense Shop</h2>
        <div class="player-info">
          <div class="money-display">💰 {{ playerMoney }} coins</div>
          <div class="level-display">
            <div class="level-info">
              <span class="level-text">Level {{ playerLevel }}</span>
              <div class="xp-bar">
                <div class="xp-progress" :style="{ width: xpProgress + '%' }"></div>
              </div>
              <span class="xp-text">{{ currentXp }}/{{ xpToNext }} XP</span>
            </div>
          </div>
        </div>
        <button class="close-btn" @click="closeShop">✕</button>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'weapons' }"
          @click="switchTab('weapons')"
        >
          ⚔️ Weapons
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'placeables' }"
          @click="switchTab('placeables')"
        >
          🏗️ Placeables
        </button>
      </div>

      <div class="shop-content">
        <!-- Weapons Tab -->
        <div v-show="activeTab === 'weapons'" class="tab-content">
          <!-- Owned Weapons Section -->
          <div class="shop-section">
            <h3>🎯 Your Arsenal</h3>
            <div class="weapons-grid">
              <div
                v-for="weapon in ownedWeapons"
                :key="weapon.name"
                class="weapon-card owned"
                :class="{ active: currentWeapon.name === weapon.name }"
              >
                <div class="weapon-header">
                  <h4>{{ weapon.name }}</h4>
                  <button
                    v-if="currentWeapon.name !== weapon.name"
                    @click="selectWeapon(weapon.name)"
                    class="select-btn"
                  >
                    Select
                  </button>
                  <span v-else class="equipped">Equipped</span>
                </div>
                <div class="weapon-stats">
                  <div>💥 Damage: {{ weapon.bullet.damage }}</div>
                  <div>⚡ Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                  <div>📏 Range: {{ weapon.range }}</div>
                  <template v-if="weapon.weaponType === 'shotgun'">
                    <div>🔫 Bullets: {{ weapon.bulletCount }}</div>
                    <div>📐 Spread: {{ weapon.spread }}°</div>
                  </template>
                  <template v-else>
                    <div>🎯 Penetration: {{ weapon.penetration }}</div>
                  </template>
                </div>

                <!-- Upgrade Section -->
                <div class="upgrades">
                  <h5>⬆️ Upgrades</h5>
                  <div class="upgrade-buttons">
                    <!-- Common upgrades for all weapons -->
                    <button
                      @click="upgradeWeapon(weapon.name, 'damage')"
                      :disabled="!canAfford(getUpgradeCost(weapon, 'damage'))"
                      class="upgrade-btn"
                      :title="getUpgradePreview(weapon, 'damage')"
                    >
                      +{{ getStatIncrease(weapon, 'damage') }} Dmg
                      <span class="cost">({{ getUpgradeCost(weapon, 'damage') }}💰)</span>
                    </button>
                    <button
                      @click="upgradeWeapon(weapon.name, 'fireRate')"
                      :disabled="!canAfford(getUpgradeCost(weapon, 'fireRate'))"
                      class="upgrade-btn"
                      :title="getUpgradePreview(weapon, 'fireRate')"
                    >
                      +{{ getStatIncrease(weapon, 'fireRate') }} Rate
                      <span class="cost">({{ getUpgradeCost(weapon, 'fireRate') }}💰)</span>
                    </button>
                    <button
                      @click="upgradeWeapon(weapon.name, 'range')"
                      :disabled="!canAfford(getUpgradeCost(weapon, 'range'))"
                      class="upgrade-btn"
                      :title="getUpgradePreview(weapon, 'range')"
                    >
                      +{{ getStatIncrease(weapon, 'range') }} Range
                      <span class="cost">({{ getUpgradeCost(weapon, 'range') }}💰)</span>
                    </button>

                    <!-- Shotgun-specific upgrades -->
                    <template v-if="weapon.weaponType === 'shotgun'">
                      <button
                        @click="upgradeWeapon(weapon.name, 'bulletCount')"
                        :disabled="!canAfford(getUpgradeCost(weapon, 'bulletCount'))"
                        class="upgrade-btn"
                        :title="getUpgradePreview(weapon, 'bulletCount')"
                      >
                        +{{ getStatIncrease(weapon, 'bulletCount') }} Bullet
                        <span class="cost">({{ getUpgradeCost(weapon, 'bulletCount') }}💰)</span>
                      </button>
                      <button
                        @click="upgradeWeapon(weapon.name, 'spread')"
                        :disabled="!canAfford(getUpgradeCost(weapon, 'spread'))"
                        class="upgrade-btn"
                        :title="getUpgradePreview(weapon, 'spread')"
                      >
                        -{{ getStatIncrease(weapon, 'spread') }} Spread
                        <span class="cost">({{ getUpgradeCost(weapon, 'spread') }}💰)</span>
                      </button>
                    </template>

                    <!-- Regular weapon penetration upgrade -->
                    <button
                      v-else
                      @click="upgradeWeapon(weapon.name, 'penetration')"
                      :disabled="!canAfford(getUpgradeCost(weapon, 'penetration'))"
                      class="upgrade-btn"
                      :title="getUpgradePreview(weapon, 'penetration')"
                    >
                      +{{ getStatIncrease(weapon, 'penetration') }} Pen
                      <span class="cost">({{ getUpgradeCost(weapon, 'penetration') }}💰)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Available Weapons Section -->
          <div class="shop-section">
            <h3>🔓 Available Weapons</h3>
            <div class="weapons-grid">
              <div
                v-for="weapon in availableWeapons"
                :key="weapon.name"
                class="weapon-card available"
                :class="{ locked: !canUnlockWeapon(weapon) }"
              >
                <div class="weapon-header">
                  <h4>{{ weapon.name }}</h4>
                  <button
                    v-if="canUnlockWeapon(weapon)"
                    @click="buyWeapon(weapon.name)"
                    :disabled="!canAfford(weapon.cost)"
                    class="buy-btn"
                  >
                    Buy ({{ weapon.cost }}💰)
                  </button>
                  <div v-else class="lock-info">
                    <span class="lock-icon">🔒</span>
                    <span class="level-req">Level {{ weapon.levelRequired }}</span>
                  </div>
                </div>

                <!-- Level Progress Bar for Locked Weapons -->
                <div v-if="!canUnlockWeapon(weapon)" class="level-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLevelProgress(weapon) + '%' }"
                    ></div>
                  </div>
                  <span class="progress-text">
                    Level {{ playerLevel }}/{{ weapon.levelRequired }}
                  </span>
                </div>

                <div class="weapon-stats">
                  <div>💥 Damage: {{ weapon.bullet.damage }}</div>
                  <div>⚡ Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                  <div>📏 Range: {{ weapon.range }}</div>
                  <template v-if="weapon.weaponType === 'shotgun'">
                    <div>🔫 Bullets: {{ weapon.bulletCount }}</div>
                    <div>📐 Spread: {{ weapon.spread }}°</div>
                  </template>
                  <template v-else>
                    <div>🎯 Penetration: {{ weapon.penetration }}</div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Locked Weapons Section -->
          <div class="shop-section" v-if="lockedWeapons.length > 0">
            <h3>🔐 Locked Weapons</h3>
            <div class="weapons-grid">
              <div v-for="weapon in lockedWeapons" :key="weapon.name" class="weapon-card locked">
                <div class="weapon-header">
                  <h4>{{ weapon.name }}</h4>
                  <div class="lock-info">
                    <span class="lock-icon">🔒</span>
                    <span class="level-req">Level {{ weapon.levelRequired }}</span>
                  </div>
                </div>

                <!-- Level Progress Bar -->
                <div class="level-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLevelProgress(weapon) + '%' }"
                    ></div>
                  </div>
                  <span class="progress-text">
                    Level {{ playerLevel }}/{{ weapon.levelRequired }}
                  </span>
                </div>

                <div class="weapon-stats locked-stats">
                  <div>💥 Damage: {{ weapon.bullet.damage }}</div>
                  <div>⚡ Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                  <div>📏 Range: {{ weapon.range }}</div>
                  <template v-if="weapon.weaponType === 'shotgun'">
                    <div>🔫 Bullets: {{ weapon.bulletCount }}</div>
                    <div>📐 Spread: {{ weapon.spread }}°</div>
                  </template>
                  <template v-else>
                    <div>🎯 Penetration: {{ weapon.penetration }}</div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Placeables Tab -->
        <div v-show="activeTab === 'placeables'" class="tab-content">
          <!-- Placeables Section -->
          <div class="shop-section">
            <h3>🏗️ Placeables</h3>
            <div class="placeables-grid">
              <!-- Turrets -->
              <div
                v-for="template in availableTurrets"
                :key="template.name"
                class="placeable-card turret"
              >
                <div class="placeable-header">
                  <h4>🔫 {{ template.name }}</h4>
                  <div class="placeable-cost">{{ template.cost }}💰</div>
                </div>
                <div class="placeable-stats">
                  <div>❤️ Health: {{ template.health }}</div>
                  <div>📏 Range: {{ template.range }}</div>
                  <div>🎯 Weapon: {{ template.weaponName }}</div>
                </div>
                <div class="placeable-description">{{ template.description }}</div>
                <button
                  @click="startPlacement(template)"
                  :disabled="!canAfford(template.cost)"
                  class="place-btn"
                >
                  Place ({{ template.cost }}💰)
                </button>
              </div>

              <!-- Walls -->
              <div
                v-for="template in availableWalls"
                :key="template.name"
                class="placeable-card wall"
              >
                <div class="placeable-header">
                  <h4>🧱 {{ template.name }}</h4>
                  <div class="placeable-cost">{{ template.cost }}💰</div>
                </div>
                <div class="placeable-stats">
                  <div>❤️ Health: {{ template.health }}</div>
                  <div>📐 Size: {{ template.width }}x{{ template.height }}</div>
                  <div v-if="template.blocksBullets">🛡️ Blocks: Movement & Bullets</div>
                  <div v-else>🚧 Blocks: Movement Only</div>
                </div>
                <div class="placeable-description">{{ template.description }}</div>
                <button
                  @click="startPlacement(template)"
                  :disabled="!canAfford(template.cost)"
                  class="place-btn"
                >
                  Place ({{ template.cost }}💰)
                </button>
              </div>
            </div>

            <!-- Locked Placeables -->
            <div v-if="lockedPlaceables.length > 0" class="locked-placeables">
              <h4>🔒 Locked Placeables</h4>
              <div class="placeables-grid">
                <div
                  v-for="template in lockedPlaceables"
                  :key="template.name"
                  class="placeable-card locked"
                >
                  <div class="placeable-header">
                    <h4>{{ template.type === 'turret' ? '🔫' : '🧱' }} {{ template.name }}</h4>
                    <div class="level-requirement">Lvl {{ template.levelRequired }}</div>
                  </div>
                  <div class="level-progress-container">
                    <div class="level-progress-bar">
                      <div
                        class="progress-fill"
                        :style="{ width: getPlaceableLevelProgress(template) + '%' }"
                      ></div>
                    </div>
                    <span class="progress-text"
                      >Level {{ playerLevel }}/{{ template.levelRequired }}</span
                    >
                  </div>
                  <div class="placeable-stats locked-stats">
                    <div>❤️ Health: {{ template.health }}</div>
                    <div v-if="template.type === 'turret'">📏 Range: {{ template.range }}</div>
                    <div v-if="template.type === 'turret'">
                      🎯 Weapon: {{ template.weaponName }}
                    </div>
                    <div v-if="template.type === 'wall'">
                      📐 Size: {{ template.width }}x{{ template.height }}
                    </div>
                  </div>
                  <div class="placeable-description">{{ template.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Weapon, PlaceableTemplate } from './defenseTypes'
import { PlaceableType } from './defenseTypes'
import { calculateUpgradeCost } from './weapons'

// Props and Emits
interface Props {
  isVisible: boolean
  playerMoney: number
  playerLevel: number
  currentXp: number
  xpToNext: number
  currentWeapon: Weapon
  ownedWeapons: Record<string, Weapon>
  weaponTemplates: Record<string, Weapon>
  placeableTemplates: Record<string, PlaceableTemplate>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  buyWeapon: [weaponName: string, cost: number]
  selectWeapon: [weaponName: string]
  upgradeWeapon: [weaponName: string, stat: string, cost: number]
  startPlacement: [template: PlaceableTemplate]
}>()

// Tab management
const activeTab = ref<'weapons' | 'placeables'>('weapons')

// Computed properties
const ownedWeapons = computed(() => Object.values(props.ownedWeapons))

const xpProgress = computed(() => {
  if (props.xpToNext === 0) return 100
  return (props.currentXp / props.xpToNext) * 100
})

const availableWeapons = computed(() => {
  return Object.values(props.weaponTemplates).filter(
    (weapon) =>
      !props.ownedWeapons[weapon.name] && weapon.name !== 'Basic Gun' && canUnlockWeapon(weapon),
  )
})

const lockedWeapons = computed(() => {
  return Object.values(props.weaponTemplates).filter(
    (weapon) =>
      !props.ownedWeapons[weapon.name] && weapon.name !== 'Basic Gun' && !canUnlockWeapon(weapon),
  )
})

// Placeable computed properties
const availableTurrets = computed(() => {
  return Object.values(props.placeableTemplates).filter(
    (template) => template.type === PlaceableType.TURRET && canUnlockPlaceable(template),
  )
})

const availableWalls = computed(() => {
  return Object.values(props.placeableTemplates).filter(
    (template) => template.type === PlaceableType.WALL && canUnlockPlaceable(template),
  )
})

const lockedPlaceables = computed(() => {
  return Object.values(props.placeableTemplates).filter((template) => !canUnlockPlaceable(template))
})

// Methods
function closeShop() {
  emit('close')
}

function switchTab(tab: 'weapons' | 'placeables') {
  activeTab.value = tab
}

function canAfford(cost: number): boolean {
  return props.playerMoney >= cost
}

function canUnlockWeapon(weapon: Weapon): boolean {
  return props.playerLevel >= (weapon.levelRequired || 1)
}

function getLevelProgress(weapon: Weapon): number {
  const required = weapon.levelRequired || 1
  if (props.playerLevel >= required) return 100
  return Math.max(0, (props.playerLevel / required) * 100)
}

function buyWeapon(weaponName: string) {
  const weaponTemplate = props.weaponTemplates[weaponName]
  if (weaponTemplate && canAfford(weaponTemplate.cost) && canUnlockWeapon(weaponTemplate)) {
    emit('buyWeapon', weaponName, weaponTemplate.cost)
  }
}

function selectWeapon(weaponName: string) {
  emit('selectWeapon', weaponName)
}

function upgradeWeapon(weaponName: string, stat: string) {
  const weapon = props.ownedWeapons[weaponName]
  const baseWeapon = props.weaponTemplates[weaponName]
  if (weapon && baseWeapon) {
    const cost = calculateUpgradeCost(weapon, stat, baseWeapon)
    if (canAfford(cost)) {
      emit('upgradeWeapon', weaponName, stat, cost)
    }
  }
}

function getUpgradeCost(weapon: Weapon, stat: string): number {
  const baseWeapon = props.weaponTemplates[weapon.name]
  return baseWeapon ? calculateUpgradeCost(weapon, stat, baseWeapon) : 999999
}

function getStatIncrease(weapon: Weapon, stat: string): string {
  const baseWeapon = props.weaponTemplates[weapon.name]
  if (!baseWeapon) return '?'

  switch (stat) {
    case 'damage':
      return Math.floor(baseWeapon.bullet.damage * 0.2).toString()
    case 'fireRate':
      return (baseWeapon.fireRate * 0.15).toFixed(1)
    case 'range':
      return Math.floor(baseWeapon.range * 0.1).toString()
    case 'penetration':
      return '1'
    case 'bulletCount':
      return '1'
    case 'spread':
      return '2°'
    default:
      return '?'
  }
}

function getUpgradePreview(weapon: Weapon, stat: string): string {
  const increase = getStatIncrease(weapon, stat)
  const cost = getUpgradeCost(weapon, stat)

  switch (stat) {
    case 'damage':
      return `Increase damage by ${increase} (${weapon.bullet.damage} → ${weapon.bullet.damage + parseInt(increase)}) for ${cost} coins`
    case 'fireRate':
      return `Increase fire rate by ${increase}/s (${weapon.fireRate.toFixed(1)} → ${(weapon.fireRate + parseFloat(increase)).toFixed(1)}) for ${cost} coins`
    case 'range':
      return `Increase range by ${increase} (${weapon.range} → ${weapon.range + parseInt(increase)}) for ${cost} coins`
    case 'penetration':
      return weapon.penetration !== undefined
        ? `Increase penetration by ${increase} (${weapon.penetration} → ${weapon.penetration + 1}) for ${cost} coins`
        : `Upgrade ${stat} for ${cost} coins`
    case 'bulletCount':
      return weapon.bulletCount !== undefined
        ? `Add ${increase} bullet (${weapon.bulletCount} → ${weapon.bulletCount + 1}) for ${cost} coins`
        : `Upgrade ${stat} for ${cost} coins`
    case 'spread':
      return weapon.spread !== undefined
        ? `Reduce spread by ${increase} (${weapon.spread}° → ${Math.max(5, weapon.spread - 2)}°) for ${cost} coins`
        : `Upgrade ${stat} for ${cost} coins`
    default:
      return `Upgrade ${stat} for ${cost} coins`
  }
}

// Placeable functions
function canUnlockPlaceable(template: PlaceableTemplate): boolean {
  return props.playerLevel >= template.levelRequired
}

function getPlaceableLevelProgress(template: PlaceableTemplate): number {
  if (props.playerLevel >= template.levelRequired) return 100
  return Math.max(0, (props.playerLevel / template.levelRequired) * 100)
}

function startPlacement(template: PlaceableTemplate) {
  emit('startPlacement', template)
}
</script>

<style lang="scss" scoped>
@use '@/styles/theme.scss';
// Color palette - Green theme with accent colors
$primary-green: #2d5a2d;
$light-green: #4a7c4a;
$dark-green: #1a3a1a;
$accent-green: #447944;
$bright-green: #7ed07e;

$secondary-blue: #4a6aa6;
$accent-orange: #ff8c42;
$accent-yellow: #ffd700;
$accent-red: #e74c3c;

$dark-bg: #1a1a1a;
$card-bg: #2c3e2c;
$light-bg: #3a4a3a;
$text-light: #e8f5e8;
$text-muted: #a8c8a8;

.shop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(1px);
}

.shop-container {
  background: var(--theme-bg-primary);
  border-radius: 16px;
  max-width: 1000px;
  max-height: 85vh;
  width: 92%;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  border: 2px solid var(--theme-modal-border);
}

.shop-header {
  background: var(--theme-bg-primary);
  padding: 1.2rem 1.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid var(--theme-modal-border);

  h2 {
    color: var(--theme-text-primary);
    margin: 0;
    font-size: 1.4em;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }

  .player-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;

    .money-display {
      color: $accent-yellow;
      font-weight: bold;
      font-size: 1.3em;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    }

    .level-display {
      .level-info {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        font-size: 0.9em;

        .level-text {
          color: $bright-green;
          font-weight: bold;
          min-width: 60px;
        }

        .xp-bar {
          width: 120px;
          height: 8px;
          background: var(--theme-bg-primary);
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--theme-modal-border);

          .xp-progress {
            height: 100%;
            background: linear-gradient(90deg, $accent-green, $bright-green);
            transition: width 0.3s ease;
          }
        }

        .xp-text {
          color: var(--theme-text-secondary);
          font-size: 0.8em;
          min-width: 70px;
        }
      }
    }
  }

  .close-btn {
    background: $accent-red;
    border: none;
    color: white;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.3em;
    transition: all 0.2s ease;

    &:hover {
      filter: brightness(0.9);
      transform: scale(1.1);
    }
  }
}

.tab-navigation {
  display: flex;
  background: var(--theme-bg-secondary);
  border-bottom: 2px solid var(--theme-modal-border);
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 1rem 1.5rem;
  color: var(--theme-text-muted);
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;

  &:hover {
    background: var(--theme-bg-primary);
    color: var(--theme-text-secondary);
  }

  &.active {
    background: var(--theme-bg-primary);
    color: $bright-green;
    border-bottom-color: $bright-green;
  }
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.shop-content {
  padding: 1.8rem;
  max-height: calc(85vh - 100px);
  overflow-y: auto;
  background: var(--theme-bg-primary);
}

.shop-section {
  margin-bottom: 2.5rem;

  h3 {
    color: var(--theme-text-primary);
    margin-bottom: 1.2rem;
    border-bottom: 3px solid var(--theme-modal-border);
    padding-bottom: 0.6rem;
    font-size: 1.2em;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }
}

.weapons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.2rem;
}

.weapon-card {
  background: var(--theme-bg-secondary);
  border-radius: 12px;
  padding: 1.2rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &.owned {
    border-color: $secondary-blue;
    filter: brightness(1.1);
  }

  &.available {
    border-color: $accent-green;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    }
  }

  &.locked {
    border-color: #666;
    opacity: 0.7;

    .locked-stats {
      opacity: 0.6;
    }
  }

  &.active {
    border-color: $accent-green;
    filter: brightness(1.1);
    box-shadow: 0 6px 20px rgba(102, 178, 102, 0.3);
  }
}

.weapon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;

  h4 {
    color: var(--theme-text-secondary);
    margin: 0;
    font-size: 1.1em;
  }

  .lock-info {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.9em;

    .lock-icon {
      font-size: 1.1em;
    }

    .level-req {
      color: $accent-orange;
      font-weight: bold;
    }
  }
}

.select-btn,
.buy-btn {
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: bold;
  transition: all 0.2s ease;

  &:disabled {
    background: #666 !important;
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.select-btn {
  background: $secondary-blue;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: scale(1.05);
  }
}

.buy-btn {
  background: var(--theme-button-primary-bg);

  &:hover:not(:disabled) {
    background: var(--theme-button-primary-hover);
    filter: brightness(1.1);
    transform: scale(1.05);
  }
}

.equipped {
  color: $accent-yellow;
  font-weight: bold;
  font-size: 0.95em;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.level-progress {
  margin: 0.8rem 0;

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--theme-bg-primary);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--theme-modal-border);

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, $accent-orange, $accent-yellow);
      transition: width 0.4s ease;
    }
  }

  .progress-text {
    display: block;
    font-size: 0.8em;
    color: var(--theme-text-secondary);
    margin-top: 0.3rem;
    text-align: center;
  }
}

.weapon-stats {
  color: var(--theme-text-secondary);
  font-size: 0.9em;
  margin-bottom: 1.2rem;

  div {
    margin-bottom: 0.3rem;
    padding: 0.2rem 0;
  }
}

.upgrades {
  h5 {
    color: $text-light;
    margin: 0 0 0.8rem 0;
    font-size: 1em;
    border-bottom: 1px solid var(--theme-modal-border);
    padding-bottom: 0.3rem;
  }

  .upgrade-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;

    .upgrade-btn {
      background: var(--theme-button-primary-bg);
      border: none;
      color: white;
      padding: 0.6rem 0.4rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8em;
      font-weight: bold;
      transition: all 0.2s ease;
      text-align: center;
      position: relative;

      .cost {
        display: block;
        font-size: 0.75em;
        opacity: 0.8;
        margin-top: 0.1rem;
      }

      &:hover:not(:disabled) {
        background: var(--theme-button-primary-hover);
        filter: brightness(1.1);
        transform: translateY(-1px);
      }

      &:disabled {
        background: #666;
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
  }
}

// Placeable specific styles
.placeables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.placeable-card {
  background: var(--theme-bg-secondary);
  border-radius: 10px;
  padding: 1rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);

  &.turret {
    border-color: $secondary-blue;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(74, 106, 166, 0.3);
    }
  }

  &.wall {
    border-color: $accent-orange;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(255, 140, 66, 0.3);
    }
  }

  &.locked {
    border-color: #666;
    opacity: 0.7;

    .placeable-stats {
      opacity: 0.6;
    }
  }
}

.placeable-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;

  h4 {
    color: var(--theme-text-secondary);
    margin: 0;
    font-size: 1rem;
  }

  .placeable-cost {
    color: $accent-yellow;
    font-weight: bold;
    font-size: 0.9rem;
  }

  .level-requirement {
    color: $accent-orange;
    font-weight: bold;
    font-size: 0.9rem;
  }
}

.placeable-stats {
  margin-bottom: 0.8rem;

  div {
    color: var(--theme-text-muted);
    font-size: 0.85rem;
    margin-bottom: 0.2rem;
  }

  &.locked-stats {
    opacity: 0.6;
  }
}

.placeable-description {
  color: var(--theme-text-muted);
  font-size: 0.8rem;
  margin-bottom: 1rem;
  font-style: italic;
  line-height: 1.3;
}

.place-btn {
  width: 100%;
  background: $bright-green;
  color: $dark-bg;
  border: none;
  padding: 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(126, 208, 126, 0.3);
  }

  &:disabled {
    background: #666;
    color: #999;
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.locked-placeables {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  h4 {
    color: var(--theme-text-muted);
    margin-bottom: 1rem;
  }
}

// Scrollbar styling
.shop-content::-webkit-scrollbar {
  width: 8px;
}

.shop-content::-webkit-scrollbar-track {
  background: $dark-green;
  border-radius: 4px;
}

.shop-content::-webkit-scrollbar-thumb {
  background: $accent-green;
  border-radius: 4px;

  &:hover {
    background: $bright-green;
  }
}

// Mobile responsiveness
@media (max-width: 768px) {
  .shop-container {
    width: 95%;
    max-height: 90vh;
  }

  .shop-header {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;

    .player-info .level-info {
      flex-direction: column;
      gap: 0.5rem;
    }
  }

  .tab-btn {
    padding: 0.8rem 1rem;
    font-size: 0.9rem;
  }

  .weapons-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .placeables-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .upgrade-buttons {
    grid-template-columns: 1fr !important;
  }
}
</style>
