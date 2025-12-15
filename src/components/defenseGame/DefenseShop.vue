<template>
  <div class="shop-overlay" v-if="isVisible" @click.self="closeShop">
    <div class="shop-container">
      <div class="shop-header">
        <h2>🛡️ Weapon Shop</h2>
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

      <div class="shop-content">
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
                <span v-else class="equipped">⚡ Equipped</span>
              </div>
              <div class="weapon-stats">
                <div>💥 Damage: {{ weapon.damage }}</div>
                <div>⚡ Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                <div>📏 Range: {{ weapon.range }}</div>
                <div>🎯 Penetration: {{ weapon.penetration }}</div>
              </div>

              <!-- Upgrade Section -->
              <div class="upgrades">
                <h5>⬆️ Upgrades</h5>
                <div class="upgrade-buttons">
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
                  <button
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
                <div>💥 Damage: {{ weapon.damage }}</div>
                <div>⚡ Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                <div>📏 Range: {{ weapon.range }}</div>
                <div>🎯 Penetration: {{ weapon.penetration }}</div>
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
                <div>💥 Damage: {{ weapon.damage }}</div>
                <div>⚡ Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                <div>📏 Range: {{ weapon.range }}</div>
                <div>🎯 Penetration: {{ weapon.penetration }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Weapon } from './defenseTypes'
import { calculateUpgradeCost } from './defenseData'

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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  buyWeapon: [weaponName: string, cost: number]
  selectWeapon: [weaponName: string]
  upgradeWeapon: [weaponName: string, stat: string, cost: number]
}>()

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

// Methods
function closeShop() {
  emit('close')
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
      return Math.floor(baseWeapon.damage * 0.2).toString()
    case 'fireRate':
      return (baseWeapon.fireRate * 0.15).toFixed(1)
    case 'range':
      return Math.floor(baseWeapon.range * 0.1).toString()
    case 'penetration':
      return '1'
    default:
      return '?'
  }
}

function getUpgradePreview(weapon: Weapon, stat: string): string {
  const increase = getStatIncrease(weapon, stat)
  const cost = getUpgradeCost(weapon, stat)

  switch (stat) {
    case 'damage':
      return `Increase damage by ${increase} (${weapon.damage} → ${weapon.damage + parseInt(increase)}) for ${cost} coins`
    case 'fireRate':
      return `Increase fire rate by ${increase}/s (${weapon.fireRate.toFixed(1)} → ${(weapon.fireRate + parseFloat(increase)).toFixed(1)}) for ${cost} coins`
    case 'range':
      return `Increase range by ${increase} (${weapon.range} → ${weapon.range + parseInt(increase)}) for ${cost} coins`
    case 'penetration':
      return `Increase penetration by ${increase} (${weapon.penetration} → ${weapon.penetration + 1}) for ${cost} coins`
    default:
      return `Upgrade ${stat} for ${cost} coins`
  }
}
</script>

<style lang="scss" scoped>
// Color palette - Green theme with accent colors
$primary-green: #2d5a2d;
$light-green: #4a7c4a;
$dark-green: #1a3a1a;
$accent-green: #66b266;
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
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.shop-container {
  background: $primary-green;
  border-radius: 16px;
  max-width: 1000px;
  max-height: 85vh;
  width: 92%;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  border: 2px solid $accent-green;
}

.shop-header {
  background: $dark-green;
  padding: 1.2rem 1.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid $accent-green;

  h2 {
    color: $text-light;
    margin: 0;
    font-size: 1.4em;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
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
          background: $dark-bg;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid $accent-green;

          .xp-progress {
            height: 100%;
            background: linear-gradient(90deg, $accent-green, $bright-green);
            transition: width 0.3s ease;
          }
        }

        .xp-text {
          color: $text-muted;
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
      background: darken($accent-red, 10%);
      transform: scale(1.1);
    }
  }
}

.shop-content {
  padding: 1.8rem;
  max-height: calc(85vh - 100px);
  overflow-y: auto;
  background: linear-gradient(135deg, $primary-green 0%, $light-green 100%);
}

.shop-section {
  margin-bottom: 2.5rem;

  h3 {
    color: $text-light;
    margin-bottom: 1.2rem;
    border-bottom: 3px solid $accent-green;
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
  background: $card-bg;
  border-radius: 12px;
  padding: 1.2rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &.owned {
    border-color: $secondary-blue;
    background: lighten($card-bg, 5%);
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
    background: desaturate($card-bg, 30%);
    opacity: 0.7;

    .locked-stats {
      opacity: 0.6;
    }
  }

  &.active {
    border-color: $bright-green;
    background: lighten($card-bg, 8%);
    box-shadow: 0 6px 20px rgba(102, 178, 102, 0.3);
  }
}

.weapon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;

  h4 {
    color: $text-light;
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
    background: lighten($secondary-blue, 10%);
    transform: scale(1.05);
  }
}

.buy-btn {
  background: linear-gradient(135deg, $accent-green, $bright-green);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, lighten($accent-green, 10%), lighten($bright-green, 10%));
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
    background: $dark-bg;
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid $accent-green;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, $accent-orange, $accent-yellow);
      transition: width 0.4s ease;
    }
  }

  .progress-text {
    display: block;
    font-size: 0.8em;
    color: $text-muted;
    margin-top: 0.3rem;
    text-align: center;
  }
}

.weapon-stats {
  color: $text-muted;
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
    border-bottom: 1px solid $accent-green;
    padding-bottom: 0.3rem;
  }

  .upgrade-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;

    .upgrade-btn {
      background: linear-gradient(135deg, $dark-green, $accent-green);
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
        background: linear-gradient(135deg, lighten($dark-green, 15%), lighten($accent-green, 15%));
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

  .weapons-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .upgrade-buttons {
    grid-template-columns: 1fr !important;
  }
}
</style>
