<template>
  <div class="shop-overlay" v-if="isVisible" @click.self="closeShop">
    <div class="shop-container">
      <div class="shop-header">
        <h2>Weapon Shop</h2>
        <div class="money-display">💰 {{ playerMoney }} coins</div>
        <button class="close-btn" @click="closeShop">✕</button>
      </div>

      <div class="shop-content">
        <!-- Owned Weapons Section -->
        <div class="shop-section">
          <h3>Your Weapons</h3>
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
                <div>Damage: {{ weapon.damage }}</div>
                <div>Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                <div>Range: {{ weapon.range }}</div>
                <div>Penetration: {{ weapon.penetration }}</div>
              </div>

              <!-- Upgrade Section -->
              <div class="upgrades">
                <h5>Upgrades</h5>
                <div class="upgrade-buttons">
                  <button
                    @click="upgradeWeapon(weapon.name, 'damage')"
                    :disabled="!canAfford(getUpgradeCost(weapon, 'damage'))"
                    class="upgrade-btn"
                  >
                    +Dmg ({{ getUpgradeCost(weapon, 'damage') }}💰)
                  </button>
                  <button
                    @click="upgradeWeapon(weapon.name, 'fireRate')"
                    :disabled="!canAfford(getUpgradeCost(weapon, 'fireRate'))"
                    class="upgrade-btn"
                  >
                    +Rate ({{ getUpgradeCost(weapon, 'fireRate') }}💰)
                  </button>
                  <button
                    @click="upgradeWeapon(weapon.name, 'range')"
                    :disabled="!canAfford(getUpgradeCost(weapon, 'range'))"
                    class="upgrade-btn"
                  >
                    +Range ({{ getUpgradeCost(weapon, 'range') }}💰)
                  </button>
                  <button
                    @click="upgradeWeapon(weapon.name, 'penetration')"
                    :disabled="!canAfford(getUpgradeCost(weapon, 'penetration'))"
                    class="upgrade-btn"
                  >
                    +Pen ({{ getUpgradeCost(weapon, 'penetration') }}💰)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Available Weapons Section -->
        <div class="shop-section">
          <h3>Available Weapons</h3>
          <div class="weapons-grid">
            <div
              v-for="weapon in availableWeapons"
              :key="weapon.name"
              class="weapon-card available"
            >
              <div class="weapon-header">
                <h4>{{ weapon.name }}</h4>
                <button
                  @click="buyWeapon(weapon.name)"
                  :disabled="!canAfford(weapon.cost)"
                  class="buy-btn"
                >
                  Buy ({{ weapon.cost }}💰)
                </button>
              </div>
              <div class="weapon-stats">
                <div>Damage: {{ weapon.damage }}</div>
                <div>Fire Rate: {{ weapon.fireRate.toFixed(1) }}/s</div>
                <div>Range: {{ weapon.range }}</div>
                <div>Penetration: {{ weapon.penetration }}</div>
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

const availableWeapons = computed(() => {
  return Object.values(props.weaponTemplates).filter(
    (weapon) => !props.ownedWeapons[weapon.name] && weapon.name !== 'Basic Gun',
  )
})

// Methods
function closeShop() {
  emit('close')
}

function canAfford(cost: number): boolean {
  return props.playerMoney >= cost
}

function buyWeapon(weaponName: string) {
  const weaponTemplate = props.weaponTemplates[weaponName]
  if (weaponTemplate && canAfford(weaponTemplate.cost)) {
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
</script>

<style scoped>
.shop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.shop-container {
  background: #2a2a2a;
  border-radius: 12px;
  max-width: 900px;
  max-height: 80vh;
  width: 90%;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.shop-header {
  background: #1a1a1a;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #444;
}

.shop-header h2 {
  color: #fff;
  margin: 0;
}

.money-display {
  color: #ffd700;
  font-weight: bold;
  font-size: 1.2em;
}

.close-btn {
  background: #ff4444;
  border: none;
  color: white;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2em;
}

.close-btn:hover {
  background: #cc3333;
}

.shop-content {
  padding: 1.5rem;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
}

.shop-section {
  margin-bottom: 2rem;
}

.shop-section h3 {
  color: #fff;
  margin-bottom: 1rem;
  border-bottom: 2px solid #444;
  padding-bottom: 0.5rem;
}

.weapons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.weapon-card {
  background: #333;
  border-radius: 8px;
  padding: 1rem;
  border: 2px solid transparent;
}

.weapon-card.owned {
  border-color: #4a90e2;
}

.weapon-card.available {
  border-color: #666;
}

.weapon-card.active {
  border-color: #ffd700;
  background: #444;
}

.weapon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.weapon-header h4 {
  color: #fff;
  margin: 0;
}

.select-btn,
.buy-btn {
  background: #4a90e2;
  border: none;
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.buy-btn {
  background: #28a745;
}

.select-btn:hover {
  background: #357abd;
}

.buy-btn:hover {
  background: #218838;
}

.select-btn:disabled,
.buy-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.equipped {
  color: #ffd700;
  font-weight: bold;
  font-size: 0.9em;
}

.weapon-stats {
  color: #ccc;
  font-size: 0.9em;
  margin-bottom: 1rem;
}

.weapon-stats div {
  margin-bottom: 0.2rem;
}

.upgrades h5 {
  color: #fff;
  margin: 0 0 0.5rem 0;
  font-size: 0.9em;
}

.upgrade-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.upgrade-btn {
  background: #ff8c00;
  border: none;
  color: white;
  padding: 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
}

.upgrade-btn:hover {
  background: #e67e00;
}

.upgrade-btn:disabled {
  background: #666;
  cursor: not-allowed;
}
</style>
