<template>
  <div class="coffee-queen-game">
    <h1>Coffee Queen</h1>

    <!-- Game Overlay with User Stats -->
    <GameOverlay :user="user" :inventory="inventoryForDisplay" />

    <!-- Controls -->
    <div class="controls">
      <button @click="showInventory = !showInventory">
        {{ showInventory ? 'Close' : 'Open' }} Inventory
      </button>
      <button @click="showShop = !showShop">{{ showShop ? 'Close' : 'Open' }} Shop</button>
      <button @click="showStats = !showStats">{{ showStats ? 'Close' : 'Open' }} Statistics</button>
      <button @click="openLoadDataOverlay">Load Game</button>
    </div>

    <!-- Machines Container -->
    <div class="machines-container">
      <div v-for="(group, type) in groupedMachines" :key="type" class="machine-row-container">
        <h3 class="machine-type-header">{{ type.charAt(0).toUpperCase() + type.slice(1) }}</h3>
        <div class="machine-row">
          <MachineCard
            v-for="machine in group"
            :key="machine.key"
            :machine="machine"
            :user-money="user.money"
            :user-level="user.level"
            @upgrade-machine="handleUpgrade"
            @buy-machine="buyMachine"
            @start-machine="startMachine"
          />
        </div>
      </div>
    </div>

    <!-- Inventory Modal -->
    <Inventory
      v-if="showInventory"
      :inventory="inventoryForDisplay"
      :user-money="user.money"
      :multi-action="inventoryMultiAction"
      :custom-percentage="customPercentage"
      @buy-item="buyItem"
      @sell-item="sellItem"
      @close="showInventory = false"
      @update-multi-action="updateInventoryMultiAction"
      @update-custom-percentage="updateCustomPercentage"
    />

    <!-- Shop Modal -->
    <Shop
      v-if="showShop"
      :user-money="user.money"
      :user-level="user.level"
      :upgrades="user.upgrades"
      @buy-upgrade="buyUpgrade"
      @close="showShop = false"
    />

    <!-- Load Data Overlay -->
    <LoadDataOverlay
      v-if="showLoadDataOverlay"
      :loaded-data="loadedData"
      :storage-type="loadedDataStorageType"
      @close="showLoadDataOverlay = false"
      @load-data="loadGame"
    />

    <!-- Offline Progress Modal -->
    <OfflineProgress
      v-if="showOfflineProgress"
      :summary="offlineProductionSummary"
      :experience="offlineExperienceGained"
      :item-data="itemData"
      @close="showOfflineProgress = false"
    />

    <!-- Production Statistics Modal -->
    <ProductionStats v-if="showStats" :item-data="itemData" @close="showStats = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type {
  User,
  UserMachine,
  MachineConfig,
  ItemData,
  InventoryItem,
  MultiActionValue,
  ItemKey,
  MachineKey,
  MachineType,
  SavedGameData,
} from '@/components/coffeequeen/types'
import { machineDataList } from '@/components/coffeequeen/data-machines'
import { itemDataList } from '@/components/coffeequeen/data-items'
import { managerUpgrades, getManagerForMachine } from '@/components/coffeequeen/data-upgrades'
import MachineCard from '@/components/coffeequeen/MachineCard.vue'
import GameOverlay from '@/components/coffeequeen/GameOverlay.vue'
import Inventory from '@/components/coffeequeen/Inventory.vue'
import Shop from '@/components/coffeequeen/Shop.vue'
import LoadDataOverlay from '@/components/coffeequeen/LoadDataOverlay.vue'
import OfflineProgress from '@/components/coffeequeen/OfflineProgress.vue'
import ProductionStats from '@/components/coffeequeen/ProductionStats.vue'
import {
  calculateBatchSize,
  calculateProductionTime,
  calculateEfficiencyBonus,
  calculateSpeedUpgradeCost,
  calculateEfficiencyUpgradeCost,
} from '@/components/coffeequeen/coffee-upgrade-calculations'
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  displayLocalSaves,
  createNewUser,
  setStatsManagerReference,
  debugStatsManager,
} from '@/components/coffeequeen/coffee-save-load'
import { useThemeStore } from '@/stores/theme'
import {
  useProductionStats,
  recordProduction,
  recordBonusProduction,
  setUserReference,
  updateProductionBuckets,
} from '@/composables/coffeequeen/statsManager'

// Initialize theme store and stats
const themeStore = useThemeStore()
themeStore.init()

// Initialize production stats
const productionStats = useProductionStats()
const { normalizeBucketsForAllTimeScales } = productionStats

// Set up stats manager reference for save/load integration
setStatsManagerReference(productionStats.statsManager)

// Debug stats manager setup
debugStatsManager()

// Test normalization function
normalizeBucketsForAllTimeScales()
debugStatsManager()

let animationFrameId: number | null = null
let lastTimestamp: number | null = null

// Load machines and items data
const machinesConfig = ref<Record<MachineKey, MachineConfig>>(machineDataList)
const itemData = ref<Record<ItemKey, ItemData>>(itemDataList)

// User state
const user = ref<User>(createNewUser())

// UI state
const showInventory = ref<boolean>(false)
const showShop = ref<boolean>(false)
const showStats = ref<boolean>(false)
const inventoryMultiAction = ref<MultiActionValue>(1)
const customPercentage = ref<number>(25)

// Data loading state
const showLoadDataOverlay = ref<boolean>(false)
const loadedData = ref<SavedGameData[]>([])
const loadedDataStorageType = ref<string>('')

// Offline progress state
const showOfflineProgress = ref<boolean>(false)
const offlineProductionSummary = ref<any>({})
const offlineExperienceGained = ref<number>(0)

// Save management
const SAVE_INTERVALS = {
  localStorage: 30000, // 30 seconds
}
let lastLocalStorageSave = 0
let isPageVisible = true
let saveTimeoutId: number | null = null
let hasUnsavedChanges = false
let hasSignificantChanges = false // Track important changes like purchases, upgrades
let lastBucketUpdate = 0 // OPTIMIZATION: Track when we last updated buckets

// Computed properties for display
const allMachinesForDisplay = computed(() => {
  const allMachines: UserMachine[] = []

  for (const [key, config] of Object.entries(machinesConfig.value)) {
    const machineKey = key as MachineKey
    let machine: UserMachine

    if (user.value.machines[machineKey]) {
      machine = user.value.machines[machineKey]
    } else {
      // Create default machine state
      machine = {
        key: machineKey,
        name: config.name,
        type: config.type,
        icon: config.icon,
        cost: config.cost,
        levelRequired: config.levelRequired,
        baseBatchSize: config.baseBatchSize,
        batchSize: config.baseBatchSize,
        productionTime: config.productionTime,
        uses: config.uses,
        produces: config.produces,
        isOwned: false,
        isActive: false,
        isManual: true,
        isRunning: false,
        progressPercent: 0,
        efficiencyProgress: 0,
        speedUpgrade: 0,
        efficiencyUpgrade: 0,
        speedUpgradeCost: calculateSpeedUpgradeCost(config.cost, 0),
        efficiencyUpgradeCost: calculateEfficiencyUpgradeCost(config.cost, 0),
        lastUpdateTime: Date.now(),

        itemsProduced: 0,
        bonusItems: 0,
      }
    }

    // Check if automation manager is purchased for this machine
    const manager = getManagerForMachine(machineKey)
    if (manager && user.value.upgrades.managers[manager.id] && machine.isOwned) {
      machine.isManual = false
    }

    allMachines.push(machine)
  }

  return allMachines
})

const groupedMachines = computed(() => {
  const groups: Record<string, UserMachine[]> = {}

  for (const machine of allMachinesForDisplay.value) {
    const type = machine.type
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(machine)
  }

  return groups
})

const inventoryForDisplay = computed(() => {
  const inventory: Record<string, InventoryItem> = {}

  for (const [key, itemInfo] of Object.entries(itemData.value)) {
    const itemKey = key as ItemKey

    if (user.value.inventory[itemKey]) {
      inventory[key] = user.value.inventory[itemKey]
    } else {
      inventory[key] = {
        name: itemInfo.name,
        icon: itemInfo.icon,
        amount: 0,
        cost: itemInfo.cost,
        basePrice: itemInfo.basePrice,
        sellMultiplier: itemInfo.sellMultiplier,
      }
    }
  }

  return inventory
})

// Functions
function buyItem({ itemKey, quantity = 1 }: { itemKey: string; quantity?: number }) {
  const item = inventoryForDisplay.value[itemKey]
  if (!item) return

  const totalCost = item.cost * quantity
  if (user.value.money >= totalCost) {
    user.value.money -= totalCost

    if (!user.value.inventory[itemKey as ItemKey]) {
      user.value.inventory[itemKey as ItemKey] = {
        ...item,
        amount: 0,
      }
    }

    const userInventoryItem = user.value.inventory[itemKey as ItemKey]
    if (userInventoryItem) {
      userInventoryItem.amount += quantity
    }
    markUnsavedChanges()
  }
}

function sellItem({ itemKey, quantity = 1 }: { itemKey: string; quantity?: number }) {
  const item = user.value.inventory[itemKey as ItemKey]
  if (!item || item.amount < quantity) return

  const sellPrice = item.cost * item.sellMultiplier
  const totalValue = sellPrice * quantity

  user.value.money += totalValue
  item.amount -= quantity
  markUnsavedChanges()
}

function updateInventoryMultiAction(newValue: MultiActionValue) {
  inventoryMultiAction.value = newValue
}

function updateCustomPercentage(newValue: number) {
  customPercentage.value = newValue
}

function buyMachine(machineKey: MachineKey) {
  const config = machinesConfig.value[machineKey]
  if (!config) return

  if (user.value.money >= config.cost && user.value.level >= config.levelRequired) {
    user.value.money -= config.cost

    // Create the machine instance
    user.value.machines[machineKey] = {
      key: machineKey,
      name: config.name,
      type: config.type,
      icon: config.icon,
      cost: config.cost,
      levelRequired: config.levelRequired,
      baseBatchSize: config.baseBatchSize,
      batchSize: config.baseBatchSize,
      productionTime: config.productionTime,
      uses: config.uses,
      produces: config.produces,
      // Initial state
      isOwned: true,
      isActive: false, // Start as inactive (red status) for manual machines
      isManual: true, // All machines start as manual
      isRunning: false, // Not currently producing
      progressPercent: 0,
      efficiencyProgress: 0,
      speedUpgrade: 0,
      efficiencyUpgrade: 0,
      speedUpgradeCost: calculateSpeedUpgradeCost(config.cost, 0),
      efficiencyUpgradeCost: calculateEfficiencyUpgradeCost(config.cost, 0),
      lastUpdateTime: Date.now(),

      itemsProduced: 0, // Property to track items produced
      bonusItems: 0, // Property to track bonus items produced
    }

    markUnsavedChanges(true)
  }
}

function startMachine(machineKey: MachineKey) {
  const machine = user.value.machines[machineKey]
  if (!machine || !machine.isManual || machine.isRunning) return

  // Check if we have required inputs (if machine uses something)
  if (machine.uses) {
    const requiredItem = user.value.inventory[machine.uses as ItemKey]
    if (!requiredItem || requiredItem.amount < machine.batchSize) {
      console.log(`Not enough ${machine.uses} to start ${machine.name}`)
      return
    }
  }

  // Start the machine
  machine.isRunning = true
  machine.isActive = true
  machine.progressPercent = 0
  machine.lastUpdateTime = Date.now()

  markUnsavedChanges(true)
}

function buyUpgrade(upgradeId: string) {
  // Find the upgrade
  const upgrade = managerUpgrades.find((u) => u.id === upgradeId)
  if (!upgrade) return

  // Check if user can afford and meets requirements
  if (user.value.money < upgrade.cost || user.value.level < upgrade.levelRequired) return

  // Check if already purchased
  if (user.value.upgrades.managers[upgradeId]) return

  // Purchase the upgrade
  user.value.money -= upgrade.cost
  user.value.upgrades.managers[upgradeId] = true

  // Apply the automation to the machine
  const machine = user.value.machines[upgrade.machineKey]
  if (machine && machine.isOwned) {
    machine.isManual = false
    machine.isActive = true // Auto-start if it has resources
    machine.isRunning = false // Reset running state
  }

  markUnsavedChanges(true)
}

function openLoadDataOverlay() {
  loadedData.value = displayLocalSaves()
  loadedDataStorageType.value = 'localStorage'
  showLoadDataOverlay.value = true
}

function handleUpgrade({
  machineKey,
  upgradeType,
}: {
  machineKey: MachineKey
  upgradeType: string
}) {
  upgradeMachine(machineKey, upgradeType)
}

function upgradeMachine(machineKey: MachineKey, upgradeType: string) {
  const machine = user.value.machines[machineKey]
  if (!machine) return

  let upgradeCost = 0

  if (upgradeType === 'speed') {
    upgradeCost = machine.speedUpgradeCost
    if (user.value.money >= upgradeCost) {
      user.value.money -= upgradeCost
      machine.speedUpgrade++

      // Recalculate machine properties
      machine.batchSize = calculateBatchSize(machine.baseBatchSize, machine.speedUpgrade)
      machine.productionTime = calculateProductionTime(
        machine.baseBatchSize,
        machine.speedUpgrade,
        machinesConfig.value[machineKey].productionTime,
      )
      machine.speedUpgradeCost = calculateSpeedUpgradeCost(machine.cost, machine.speedUpgrade)

      markUnsavedChanges(true)
    }
  } else if (upgradeType === 'efficiency') {
    upgradeCost = machine.efficiencyUpgradeCost
    if (user.value.money >= upgradeCost) {
      user.value.money -= upgradeCost
      machine.efficiencyUpgrade++
      machine.efficiencyUpgradeCost = calculateEfficiencyUpgradeCost(
        machine.cost,
        machine.efficiencyUpgrade,
      )

      markUnsavedChanges(true)
    }
  }
}

// Save to localStorage
function saveToLocalStorageNow() {
  console.log('💾 Saving game state...')
  debugStatsManager() // Debug before save
  saveToLocalStorage(user.value, 'guest', 'Guest')
  // Reset significant changes flag after saving
  hasSignificantChanges = false
  // Production stats are now automatically included in the save
}

function loadGame(itemKey: string) {
  const result = loadFromLocalStorage(itemKey, machinesConfig.value, itemData.value)
  if (result) {
    // Load the game data
    user.value = result.gameData

    // Migrate old save data - add missing properties to machines
    for (const machineKey in user.value.machines) {
      const machine = user.value.machines[machineKey]
      if (machine) {
        if (machine.isManual === undefined) {
          machine.isManual = true // Default to manual for old saves
        }
        if (machine.isRunning === undefined) {
          machine.isRunning = false
        }
      }
    }

    // Show offline progress if there was any
    if (
      Object.keys(result.offlineProductionSummary).length > 0 ||
      result.offlineExperienceGained > 0
    ) {
      offlineProductionSummary.value = result.offlineProductionSummary
      offlineExperienceGained.value = result.offlineExperienceGained
      showOfflineProgress.value = true
    }

    showLoadDataOverlay.value = false
    console.log('Game loaded successfully')
  }
}

// Mark that changes have occurred
function markUnsavedChanges(isSignificant = false) {
  hasUnsavedChanges = true

  if (isSignificant) {
    hasSignificantChanges = true
    // Save immediately for significant changes
    saveToLocalStorageNow()
  }
}

// Check if we should save to localStorage
function shouldSaveToLocalStorage() {
  return Date.now() - lastLocalStorageSave > SAVE_INTERVALS.localStorage
}

// Check if there are significant unsaved changes (not just production data)
function hasSignificantUnsavedChanges(): boolean {
  // Show warning if there are significant changes (purchases, upgrades, etc.)
  // that haven't been saved yet, OR if it's been a very long time since last save
  const timeSinceLastSave = Date.now() - lastLocalStorageSave
  const veryLongTime = 10 * 60 * 1000 // 10 minutes

  return hasSignificantChanges || (hasUnsavedChanges && timeSinceLastSave > veryLongTime)
}

// Page visibility change handler
function handleVisibilityChange() {
  isPageVisible = !document.hidden
  if (!isPageVisible && hasUnsavedChanges) {
    // Save when page becomes hidden
    saveToLocalStorageNow()
  }
}

// Beforeunload handler for emergency saves
function handleBeforeUnload(event: BeforeUnloadEvent) {
  // Always save any pending changes
  if (hasUnsavedChanges) {
    saveToLocalStorageNow()
  }

  // Only show warning for significant unsaved changes
  // (Don't warn users about minor production data that auto-saves every 30 seconds)
  if (hasSignificantUnsavedChanges()) {
    event.preventDefault()
    event.returnValue = ''
  }
}

// Enhanced game loop with separate efficiency progress
function updateGame(timestamp: number) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp
  }

  const deltaTime = timestamp - lastTimestamp
  lastTimestamp = timestamp
  const elapsedMS = deltaTime

  // Update all owned machines
  for (const machineKey in user.value.machines) {
    const machine = user.value.machines[machineKey]
    const machineConf = machinesConfig.value[machineKey as MachineKey]

    if (!machine || !machine.isOwned || !machineConf || (machine.isManual && !machine.isRunning))
      continue

    // Check if the machine is active
    if (!machine.isActive) {
      const batchSize =
        machine.batchSize || calculateBatchSize(machineConf.baseBatchSize, machine.speedUpgrade)
      const usesItemKey = machineConf.uses as ItemKey
      const usesInventory = usesItemKey ? user.value.inventory[usesItemKey] : null
      const availableAmount = usesInventory?.amount || 0

      if (availableAmount >= batchSize) {
        machine.isActive = true // Reactivate if resources are available
        if (usesInventory) {
          usesInventory.amount -= batchSize // Consume batch amount
        }
        machine.progressPercent = 0 // Start new production cycle
      } else {
        continue // Skip to next machine if not active
      }
    }

    if (machine.progressPercent < 1) {
      // Calculate progress per millisecond based on current production time
      const progressPerMS = 1 / machine.productionTime // Progress per millisecond
      const progressThisFrame = elapsedMS * progressPerMS

      // Update progress
      machine.progressPercent += progressThisFrame

      // Update efficiency progress gradually during production (separate from normal production)
      if (machine.efficiencyUpgrade > 0) {
        const totalEfficiencyBonus = calculateEfficiencyBonus(machine.efficiencyUpgrade)
        const efficiencyGainThisFrame = totalEfficiencyBonus * progressThisFrame
        machine.efficiencyProgress += efficiencyGainThisFrame

        // Check if we've accumulated enough for bonus items (can produce at any time)
        if (machine.efficiencyProgress >= 1) {
          const numberOfBonusItems = Math.floor(machine.efficiencyProgress) * machine.batchSize
          const producesItemKey = machineConf.produces as ItemKey

          // Ensure inventory item exists
          if (!user.value.inventory[producesItemKey]) {
            const itemInfo = itemData.value[producesItemKey]
            user.value.inventory[producesItemKey] = {
              name: itemInfo.name,
              icon: itemInfo.icon,
              amount: 0,
              cost: itemInfo.cost,
              basePrice: itemInfo.basePrice,
              sellMultiplier: itemInfo.sellMultiplier,
            }
          }

          user.value.inventory[producesItemKey].amount += numberOfBonusItems
          machine.itemsProduced += numberOfBonusItems // Track total items produced
          machine.bonusItems += numberOfBonusItems // Track bonus items separately

          // Record bonus production in stats
          recordBonusProduction(producesItemKey, numberOfBonusItems)

          machine.efficiencyProgress -= Math.floor(machine.efficiencyProgress) // Reset efficiency progress for next cycle
        }
      }

      if (machine.progressPercent >= 1) {
        // Production complete - produce main items based on batch size
        const batchSize = machine.batchSize || 1
        const producesItemKey = machineConf.produces as ItemKey

        // Ensure inventory item exists
        if (!user.value.inventory[producesItemKey]) {
          const itemInfo = itemData.value[producesItemKey]
          user.value.inventory[producesItemKey] = {
            name: itemInfo.name,
            icon: itemInfo.icon,
            amount: 0,
            cost: itemInfo.cost,
            basePrice: itemInfo.basePrice,
            sellMultiplier: itemInfo.sellMultiplier,
          }
        }

        user.value.inventory[producesItemKey].amount += batchSize
        machine.itemsProduced += batchSize // Track items produced

        // Record regular production in stats
        recordProduction(producesItemKey, batchSize)

        user.value.experience += batchSize // Experience based on batch size

        // Check for level up
        if (user.value.experience >= user.value.nextLevelExperience) {
          user.value.level++
          user.value.experience -= user.value.nextLevelExperience
          user.value.nextLevelExperience = Math.ceil(user.value.nextLevelExperience * 1.2)
        }

        // Reset for next production cycle and consume resources
        machine.progressPercent = 0 // Reset progress immediately

        const usesItemKey = machineConf.uses as ItemKey
        const usesInventory = usesItemKey ? user.value.inventory[usesItemKey] : null
        const availableAmount = usesInventory?.amount || 0
        let canProduce = true

        if (availableAmount >= batchSize) {
          if (usesInventory) {
            usesInventory.amount -= batchSize // Consume batch amount
          }
          // Machine can continue running with fresh cycle
        } else if (machineConf.uses != null && machineConf.uses !== '') {
          console.log(`Not enough ${machineConf.uses} to produce ${machineConf.produces}.`)
          canProduce = false
        }

        // Reset production progress and handle manual vs automated
        if (machine.isManual) {
          // Manual machines stop after one batch of normal production
          machine.isRunning = false
          machine.isActive = false
        } else {
          // Automated machines continue if they have resources
          if (!canProduce) {
            machine.isActive = false
          }
        }

        markUnsavedChanges()
      }
    }
  }

  // Periodic saves
  if (hasUnsavedChanges && shouldSaveToLocalStorage()) {
    saveToLocalStorageNow()
    lastLocalStorageSave = Date.now()
    hasUnsavedChanges = false
    hasSignificantChanges = false
  }

  // This prevents massive performance issues from bucket operations on every frame
  const now = Date.now()
  const timeSinceLastBucketUpdate = now - (lastBucketUpdate || 0)
  if (timeSinceLastBucketUpdate > 500) {
    // Only update once per second max
    updateProductionBuckets(now)
    lastBucketUpdate = now
  }

  animationFrameId = requestAnimationFrame(updateGame)
}

// Lifecycle
onMounted(async () => {
  // Set up user reference for stats integration
  setUserReference(user.value)

  // Try to load existing save
  const result = loadFromLocalStorage('coffeeQueen_guest', machinesConfig.value, itemData.value)
  if (result) {
    user.value = result.gameData

    // Production stats are automatically restored in loadFromLocalStorage
    // No need to call loadStats() again as the stats manager is already updated
    console.log('📈 Game loaded, checking stats manager state:')
    debugStatsManager() // Debug after load

    // Show offline progress if there was any
    if (
      Object.keys(result.offlineProductionSummary).length > 0 ||
      result.offlineExperienceGained > 0
    ) {
      offlineProductionSummary.value = result.offlineProductionSummary
      offlineExperienceGained.value = result.offlineExperienceGained
      showOfflineProgress.value = true
    }
  } else {
    // If no save data exists, stats manager will initialize itself with fresh data
    console.log('No save data found, stats manager initialized with fresh data')
  }

  // Setup event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)

  // Start game loop
  animationFrameId = requestAnimationFrame(updateGame)
})

onUnmounted(() => {
  // Save before unmounting
  if (hasUnsavedChanges) {
    saveToLocalStorageNow()
  }

  // Cleanup
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  if (saveTimeoutId !== null) {
    clearTimeout(saveTimeoutId)
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', handleBeforeUnload)

  animationFrameId = null
  lastTimestamp = null
})
</script>

<style scoped lang="scss">
h1 {
  text-align: center;
  margin-bottom: 20px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 2.5rem;
  color: var(--coffee-text-secondary);
  transition: all 0.3s ease;
}

.coffee-queen-game {
  background: linear-gradient(135deg, var(--coffee-bg-primary) 0%, var(--coffee-bg-secondary) 100%);
  color: var(--coffee-text-primary);
  transition: all 0.3s ease;
  padding: 20px;
  min-height: calc(100vh - 140px);
}

.controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;

  button {
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    transition: all 0.3s ease;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Courier New', Courier, monospace;

    &:hover {
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.machines-container {
  margin-bottom: 100px; // Space for overlay
}

.machine-row-container {
  margin-bottom: 30px;
}

.machine-type-header {
  color: var(--coffee-text-secondary);
  transition: all 0.3s ease;
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 15px;
}

.machine-row {
  display: flex;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--coffee-border-secondary);
    border-radius: 4px;
  }
  padding: 10px 0;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

// Responsive adjustments
@media (max-width: 900px) {
  .machine-row {
    justify-content: flex-start;
  }
}
</style>
