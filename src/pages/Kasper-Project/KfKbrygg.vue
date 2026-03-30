<template>
  <div class="coffee-queen-game">
    <h1>KfKbrygg</h1>

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

    <div class="speed-controls">
      <span class="speed-controls__label">Speed</span>
      <div class="speed-controls__buttons">
        <button
          v-for="speed in speedOptions"
          :key="`speed-${speed}`"
          :class="{ active: gameSpeedMultiplier === speed }"
          @click="setGameSpeed(speed)"
        >
          {{ speed }}x
        </button>
      </div>
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
      :sales-managers="user.upgrades.salesManagers || {}"
      :item-data="itemData"
      @buy-item="buyItem"
      @sell-item="sellItem"
      @close="showInventory = false"
      @update-multi-action="updateInventoryMultiAction"
      @update-custom-percentage="updateCustomPercentage"
      @update-manager-settings="updateManagerSettings"
    />

    <!-- Shop Modal -->
    <Shop
      v-if="showShop"
      :user-money="user.money"
      :user-level="user.level"
      :upgrades="user.upgrades"
      @buy-upgrade="buyUpgrade"
      @buy-sales-manager="buySalesManager"
      @close="showShop = false"
    />

    <!-- Load Data Overlay -->
    <LoadDataOverlay
      v-if="showLoadDataOverlay"
      :loaded-data="loadedData"
      :storage-type="loadedDataStorageType"
      @close="showLoadDataOverlay = false"
      @load-data="loadGame"
      @create-new-save="createNewGame"
      @rename-save="renameSave"
      @delete-save="deleteSave"
    />

    <!-- Offline Progress Modal -->
    <OfflineProgress
      v-if="showOfflineProgress"
      :offlineTime="offlineTime"
      :simulatedTime="offlineSimulatedTime"
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
  OfflineProductionSummary,
} from '@/components/coffeequeen/types'
import { machineDataList } from '@/components/coffeequeen/data-machines'
import { itemDataList } from '@/components/coffeequeen/data-items'
import {
  managerUpgrades,
  getManagerForMachine,
  inventoryUpgrades,
  calculateInventoryMultiplier,
  createSalesManager,
  getSalesManagerUpgradeCost,
  getSalesManagerLevelConfig,
} from '@/components/coffeequeen/data-upgrades'
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
  calculateSpeedUpgradeCost,
  calculateEfficiencyUpgradeCost,
} from '@/components/coffeequeen/coffee-upgrade-calculations'
import { simulateGameStep } from '@/components/coffeequeen/coffee-simulation'
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  displayLocalSaves,
  createNewUser,
  setStatsManagerReference,
  initializeKfKbryggSaveSystem,
  createNewLocalSave,
  renameLocalSave,
  deleteLocalSave,
  getActiveSaveId,
  setActiveSaveId,
  simulateOfflineProgress,
} from '@/components/coffeequeen/coffee-save-load'
import { useThemeStore } from '@/stores/theme'
import {
  useProductionStats,
  recordProduction,
  recordBonusProduction,
  setUserReference,
  updateProductionBuckets,
} from '@/composables/coffeequeen/statsManager'
import {
  initializeManagerTimeseries,
  recordManagerSellAction,
  recordManagerBuyAction,
} from '@/composables/coffeequeen/managerStatsManager'

// Initialize theme store and stats
const themeStore = useThemeStore()
themeStore.init()

// Initialize production stats
const productionStats = useProductionStats()
const { normalizeBucketsForAllTimeScales } = productionStats

// Set up stats manager reference for save/load integration
setStatsManagerReference(productionStats.statsManager)

// Test normalization function
normalizeBucketsForAllTimeScales()

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
const activeSaveId = ref<string>('')
const activeSaveName = ref<string>('Guest')

// Offline progress state
const showOfflineProgress = ref<boolean>(false)
const offlineTime = ref<number>(0)
const offlineSimulatedTime = ref<number>(0)
const offlineProductionSummary = ref<OfflineProductionSummary>({})
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
let hiddenAtTimestamp: number | null = null
const gameSpeedMultiplier = ref<number>(1)
const speedOptions = [1, 2, 3, 10, 100]

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
        capacity: calculateItemCapacity(itemKey),
      }
    }
  }

  return inventory
})

// Functions
function buyItem({ itemKey, quantity = 1 }: { itemKey: string; quantity?: number }) {
  const item = inventoryForDisplay.value[itemKey]
  if (!item) return

  // Check if inventory item exists and has capacity
  if (!user.value.inventory[itemKey as ItemKey]) {
    user.value.inventory[itemKey as ItemKey] = {
      ...item,
      amount: 0,
      capacity: calculateItemCapacity(itemKey as ItemKey),
    }
  }

  const userInventoryItem = user.value.inventory[itemKey as ItemKey]
  if (!userInventoryItem) return

  // Check capacity limit
  const availableSpace = userInventoryItem.capacity - userInventoryItem.amount
  const actualQuantity = Math.min(quantity, availableSpace)

  if (actualQuantity <= 0) {
    console.log(`Cannot buy ${itemKey}: inventory is full`)
    return
  }

  const totalCost = item.cost * actualQuantity
  if (user.value.money >= totalCost) {
    user.value.money -= totalCost
    userInventoryItem.amount += actualQuantity
    markUnsavedChanges()

    if (actualQuantity < quantity) {
      console.log(`Only bought ${actualQuantity}/${quantity} ${itemKey} due to capacity limit`)
    }
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

function setGameSpeed(speed: number) {
  gameSpeedMultiplier.value = speed
}

function updateManagerSettings(payload: {
  itemKey: string
  settings: {
    sellThreshold?: number
    buyThreshold?: number
    autoSellEnabled?: boolean
    autoBuyEnabled?: boolean
  }
}) {
  const { itemKey, settings } = payload
  const manager = user.value.upgrades.salesManagers?.[itemKey as ItemKey]
  if (!manager) return

  if (settings.sellThreshold !== undefined) {
    manager.settings.sellThreshold = settings.sellThreshold
  }
  if (settings.buyThreshold !== undefined) {
    manager.settings.buyThreshold = settings.buyThreshold
  }
  if (settings.autoSellEnabled !== undefined) {
    manager.settings.autoSellEnabled = settings.autoSellEnabled
  }
  if (settings.autoBuyEnabled !== undefined) {
    manager.settings.autoBuyEnabled = settings.autoBuyEnabled
  }

  markUnsavedChanges()
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
  // Try to find manager upgrade first
  const managerUpgrade = managerUpgrades.find((u) => u.id === upgradeId)
  if (managerUpgrade) {
    // Check if user can afford and meets requirements
    if (user.value.money < managerUpgrade.cost || user.value.level < managerUpgrade.levelRequired)
      return

    // Check if already purchased
    if (user.value.upgrades.managers[upgradeId]) return

    // Purchase the upgrade
    user.value.money -= managerUpgrade.cost
    user.value.upgrades.managers[upgradeId] = true

    // Apply the automation to the machine
    const machine = user.value.machines[managerUpgrade.machineKey]
    if (machine && machine.isOwned) {
      machine.isManual = false
      machine.isActive = true // Auto-start if it has resources
      machine.isRunning = false // Reset running state
    }

    markUnsavedChanges(true)
    return
  }

  // Try to find inventory upgrade
  const inventoryUpgrade = inventoryUpgrades.find((u) => u.id === upgradeId)
  if (inventoryUpgrade) {
    // Check if user can afford and meets requirements
    if (
      user.value.money < inventoryUpgrade.cost ||
      user.value.level < inventoryUpgrade.levelRequired
    )
      return

    // Check if already purchased
    if (user.value.upgrades.inventory[upgradeId]) return

    // Purchase the upgrade
    user.value.money -= inventoryUpgrade.cost
    user.value.upgrades.inventory[upgradeId] = true

    // Update inventory capacities for all items
    updateInventoryCapacities()

    markUnsavedChanges(true)
    return
  }
}

function buySalesManager(itemKey: ItemKey, targetLevel: number) {
  // Get current sales manager for this item
  const currentManager = user.value.upgrades.salesManagers[itemKey]
  const currentLevel = currentManager?.level || 0

  // Check if we can upgrade to target level
  if (currentLevel >= targetLevel) return

  const cost = getSalesManagerUpgradeCost(currentLevel, targetLevel)
  const levelConfig = getSalesManagerLevelConfig(targetLevel)

  if (!levelConfig) return

  // Check if user can afford and meets requirements
  if (user.value.money < cost || user.value.level < levelConfig.levelRequired) return

  // Purchase/upgrade the sales manager
  user.value.money -= cost

  if (!user.value.upgrades.salesManagers[itemKey]) {
    // Create new sales manager with smart defaults
    user.value.upgrades.salesManagers[itemKey] = createSalesManager(itemKey, targetLevel)
    // Enable auto-sell by default for all levels (they bought it to use it!)
    user.value.upgrades.salesManagers[itemKey].settings.autoSellEnabled = true
    // Initialize timeseries data
    initializeManagerTimeseries(user.value.upgrades.salesManagers[itemKey])
  } else {
    // Upgrade existing sales manager
    user.value.upgrades.salesManagers[itemKey].level = targetLevel
    const newConfig = getSalesManagerLevelConfig(targetLevel)
    if (newConfig) {
      // Update settings based on new level capabilities
      user.value.upgrades.salesManagers[itemKey].settings.sellRate = newConfig.sellRate
      user.value.upgrades.salesManagers[itemKey].settings.offlineWork =
        newConfig.features.offlineWork

      // Set default thresholds if this level supports threshold control
      if (newConfig.features.canSetThresholds) {
        // Only set defaults if not already configured
        if (!user.value.upgrades.salesManagers[itemKey].settings.sellThreshold) {
          user.value.upgrades.salesManagers[itemKey].settings.sellThreshold = 80
        }
        if (!user.value.upgrades.salesManagers[itemKey].settings.buyThreshold) {
          user.value.upgrades.salesManagers[itemKey].settings.buyThreshold = 10
        }
      } else if (targetLevel === 1) {
        // Level 1 has fixed 90% threshold
        user.value.upgrades.salesManagers[itemKey].settings.sellThreshold = 90
      }

      // Auto-buy stays disabled by default (more conservative)
      if (newConfig.features.canBuy) {
        // Keep existing setting or default to false
        if (user.value.upgrades.salesManagers[itemKey].settings.autoBuyEnabled === undefined) {
          user.value.upgrades.salesManagers[itemKey].settings.autoBuyEnabled = false
        }
      }

      // Auto-sell should be enabled when they upgrade (they want to use the feature!)
      user.value.upgrades.salesManagers[itemKey].settings.autoSellEnabled = true
    }
  }

  markUnsavedChanges(true)
}

// Helper function to update all inventory capacities based on purchased upgrades
function updateInventoryCapacities() {
  const multiplier = calculateInventoryMultiplier(user.value.upgrades.inventory)

  for (const itemKey in user.value.inventory) {
    const itemInfo = itemDataList[itemKey as ItemKey]
    if (itemInfo && user.value.inventory[itemKey]) {
      user.value.inventory[itemKey]!.capacity = Math.floor(itemInfo.defaultCapacity * multiplier)
    }
  }
}

// Helper function to calculate capacity for a new inventory item
function calculateItemCapacity(itemKey: ItemKey): number {
  const itemInfo = itemDataList[itemKey]
  const multiplier = calculateInventoryMultiplier(user.value.upgrades.inventory)
  return Math.floor(itemInfo.defaultCapacity * multiplier)
}

function openLoadDataOverlay() {
  loadedData.value = displayLocalSaves()
  loadedDataStorageType.value = 'localStorage'
  showLoadDataOverlay.value = true
}

function createNewGame(saveName: string) {
  const newSaveId = createNewLocalSave(saveName)
  activeSaveId.value = newSaveId
  activeSaveName.value = saveName.trim() || 'Guest'
  loadGame(newSaveId)
  loadedData.value = displayLocalSaves()
}

function renameSave(payload: { saveId: string; newName: string }) {
  const { saveId, newName } = payload
  const didRename = renameLocalSave(saveId, newName)
  if (!didRename) return

  if (activeSaveId.value === saveId) {
    activeSaveName.value = newName.trim() || 'Guest'
  }

  loadedData.value = displayLocalSaves()
}

function deleteSave(saveId: string) {
  const wasActiveSave = activeSaveId.value === saveId
  deleteLocalSave(saveId)

  const saves = displayLocalSaves()
  loadedData.value = saves

  if (!wasActiveSave) {
    return
  }

  const nextActiveSaveId = getActiveSaveId()
  if (nextActiveSaveId) {
    loadGame(nextActiveSaveId)
    return
  }

  const fallbackSaveId = createNewLocalSave('Guest')
  loadGame(fallbackSaveId)
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
  if (!activeSaveId.value) {
    activeSaveId.value = initializeKfKbryggSaveSystem(activeSaveName.value)
  }

  const nowIso = new Date().toISOString()
  user.value.lastSaved = nowIso
  if (!user.value.lastActiveAt) {
    user.value.lastActiveAt = nowIso
  }

  saveToLocalStorage(user.value, activeSaveId.value, activeSaveName.value)
  lastLocalStorageSave = Date.now()
  hasUnsavedChanges = false
  hasSignificantChanges = false
  // Production stats are now automatically included in the save
}

function applyOfflineCatchup(timeAwayMS: number): void {
  const cappedAwayMS = Math.min(Math.max(timeAwayMS, 0), 3600 * 1000)
  if (cappedAwayMS <= 1000) return

  const result = simulateOfflineProgress(
    user.value,
    machinesConfig.value,
    itemData.value,
    cappedAwayMS,
  )
  offlineTime.value = Math.max(timeAwayMS, 0)
  offlineSimulatedTime.value = cappedAwayMS
  offlineProductionSummary.value = result.productionSummary
  offlineExperienceGained.value = result.totalExperienceGained
  showOfflineProgress.value = true

  markUnsavedChanges()
}

function loadGame(saveId: string) {
  const result = loadFromLocalStorage(saveId, machinesConfig.value, itemData.value)
  console.log('Result of load:', result)
  if (result) {
    activeSaveId.value = saveId
    setActiveSaveId(saveId)

    // Load the game data
    user.value = result.gameData
    const matchingSave = displayLocalSaves().find(
      (save) => (save.saveId || save.itemKey) === saveId,
    )
    activeSaveName.value = matchingSave?.userName?.trim() || activeSaveName.value || 'Guest'

    // Time offline
    user.value.lastActiveAt = new Date().toISOString()

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

    // Migrate inventory items - ensure they have capacity
    for (const itemKey in user.value.inventory) {
      const item = user.value.inventory[itemKey]
      if (item && item.capacity === undefined) {
        // Old save without capacity - calculate it
        item.capacity = calculateItemCapacity(itemKey as ItemKey)
      }
    }

    // Ensure inventory upgrades exist for backward compatibility
    if (!user.value.upgrades.inventory) {
      user.value.upgrades.inventory = {}
    }

    // Update all inventory capacities in case new upgrades were added
    updateInventoryCapacities()

    // Initialize timeseries for existing sales managers if not present
    if (user.value.upgrades.salesManagers) {
      for (const itemKey in user.value.upgrades.salesManagers) {
        const manager = user.value.upgrades.salesManagers[itemKey as ItemKey]
        if (manager && !manager.statistics.timeseries) {
          initializeManagerTimeseries(manager)
        }
      }
    }

    // Show offline progress only for meaningful offline sessions
    offlineTime.value = result.offlineTimeMS
    offlineSimulatedTime.value = result.simulatedOfflineTimeMS
    offlineProductionSummary.value = result.offlineProductionSummary
    offlineExperienceGained.value = result.offlineExperienceGained
    showOfflineProgress.value = result.offlineTimeMS > 1000

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

// Page visibility change handler
function handleVisibilityChange() {
  isPageVisible = !document.hidden
  if (!isPageVisible) {
    hiddenAtTimestamp = Date.now()
    user.value.lastActiveAt = new Date(hiddenAtTimestamp).toISOString()
    saveToLocalStorageNow()
    return
  }

  const now = Date.now()
  if (hiddenAtTimestamp) {
    applyOfflineCatchup(now - hiddenAtTimestamp)
    hiddenAtTimestamp = null
  }
  user.value.lastActiveAt = new Date(now).toISOString()
  lastTimestamp = null
}

// Beforeunload handler for emergency saves
function handleBeforeUnload() {
  // Always save any pending changes
  if (hasUnsavedChanges) {
    saveToLocalStorageNow()
  }
}

// Unified game loop driven by shared simulation core.
function updateGame(timestamp: number) {
  if (!isPageVisible) {
    lastTimestamp = timestamp
    animationFrameId = requestAnimationFrame(updateGame)
    return
  }

  if (!lastTimestamp) {
    lastTimestamp = timestamp
  }

  const deltaTime = timestamp - lastTimestamp
  lastTimestamp = timestamp
  const elapsedMS = deltaTime * gameSpeedMultiplier.value

  const simulationResult = simulateGameStep(
    user.value,
    machinesConfig.value,
    itemData.value,
    elapsedMS,
    {
      hooks: {
        onProduced: ({ itemKey, amount, source }) => {
          if (source === 'bonus') {
            recordBonusProduction(itemKey, amount)
          } else {
            recordProduction(itemKey, amount)
          }
        },
        onManagerSell: ({ itemKey, items, money }) => {
          const manager = user.value.upgrades.salesManagers[itemKey]
          if (manager) {
            recordManagerSellAction(manager, items, money)
          }
        },
        onManagerBuy: ({ itemKey, items, money }) => {
          const manager = user.value.upgrades.salesManagers[itemKey]
          if (manager) {
            recordManagerBuyAction(manager, items, money)
          }
        },
      },
    },
  )

  if (simulationResult.didChangeState) {
    markUnsavedChanges()
  }

  // Periodic saves
  if (hasUnsavedChanges && shouldSaveToLocalStorage()) {
    saveToLocalStorageNow()
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

  // Initialize save slots (includes migration from legacy coffeeQueen keys)
  const initialSaveId = initializeKfKbryggSaveSystem('Guest')
  loadGame(initialSaveId)

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
  margin-bottom: clamp(10px, 4vw, 20px);
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1.5rem, 5vw, 2.5rem);
  color: var(--coffee-text-secondary);
  transition: all 0.3s ease;
}

.coffee-queen-game {
  background: linear-gradient(135deg, var(--coffee-bg-primary) 0%, var(--coffee-bg-secondary) 100%);
  color: var(--coffee-text-primary);
  transition: all 0.3s ease;
  padding: clamp(10px, 3vw, 20px);
  min-height: calc(100vh - 140px);
  padding-bottom: clamp(100px, 15vh, 140px); // Space for fixed bottom overlay
}

.controls {
  display: flex;
  justify-content: center;
  gap: clamp(5px, 3vw, 20px);
  margin-bottom: clamp(15px, 4vw, 30px);
  flex-wrap: wrap;
  padding: 0 clamp(10px, 2vw, 0px);

  button {
    flex: 1 1;
    max-width: 250px;
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    transition: all 0.3s ease;
    padding: clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px);
    font-size: clamp(12px, 2.5vw, 16px);
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Courier New', Courier, monospace;
    white-space: nowrap;
    min-height: 44px; // Touch target minimum

    &:hover {
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.speed-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: clamp(18px, 4vw, 30px);
}

.speed-controls__label {
  color: var(--coffee-text-secondary);
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(0.9rem, 2vw, 1rem);
  font-weight: bold;
}

.speed-controls__buttons {
  display: flex;
  gap: 8px;

  button {
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    min-width: 52px;
    transition: all 0.2s ease;

    &.active {
      transform: translateY(-1px);
      box-shadow: 0 0 0 2px var(--coffee-text-secondary);
    }
  }
}

.machines-container {
  margin-bottom: clamp(80px, 12vh, 120px); // Space for overlay
}

.machine-row-container {
  margin-bottom: clamp(20px, 4vw, 30px);
}

.machine-type-header {
  color: var(--coffee-text-secondary);
  transition: all 0.3s ease;
  text-align: center;
  font-size: clamp(1.2rem, 3.5vw, 1.5rem);
  margin-bottom: clamp(10px, 2vw, 15px);
}

.machine-row {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch; // Smooth scrolling on iOS
  padding: 10px 0;
  gap: clamp(8px, 2vw, 15px);
  flex-wrap: nowrap; // Prevent wrapping for horizontal scroll

  &::before,
  &::after {
    content: '';
    flex: 1 0 auto;
  }

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--coffee-border-secondary);
    border-radius: 4px;
  }

  > * {
    flex-shrink: 0; // Prevent items from shrinking
    scroll-snap-align: start;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .machine-row {
    justify-content: flex-start;
    padding-left: clamp(10px, 3vw, 20px);
    padding-right: clamp(10px, 3vw, 20px);
  }

  .controls {
    align-items: center;
    gap: 10px;
  }

  .speed-controls {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .coffee-queen-game {
    padding: clamp(5px, 2vw, 10px);
  }

  .controls button {
    padding: 12px 16px;
    font-size: 14px;
  }
}
</style>
