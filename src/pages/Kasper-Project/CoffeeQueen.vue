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
    />

    <!-- Offline Progress Modal -->
    <OfflineProgress
      v-if="showOfflineProgress"
      :offlineTime="offlineTime"
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
import { it } from 'node:test'

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

// Offline progress state
const showOfflineProgress = ref<boolean>(false)
const offlineTime = ref<number>(0)
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
  saveToLocalStorage(user.value, 'guest', 'Guest')
  // Reset significant changes flag after saving
  hasSignificantChanges = false
  // Production stats are now automatically included in the save
}

function loadGame(itemKey: string) {
  const result = loadFromLocalStorage(itemKey, machinesConfig.value, itemData.value)
  console.log('Result of load:', result)
  if (result) {
    // Load the game data
    user.value = result.gameData

    // Time offline
    const currentTime = Date.now()
    const timeOffline = currentTime - Date.parse(result.gameData.lastSaved)
    console.log(
      `You were offline for ${timeOffline / 1000} seconds, ${currentTime}, ${Date.parse(result.gameData.lastSaved)}`,
    )

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

    // Show offline progress if there was any
    offlineTime.value = timeOffline
    offlineProductionSummary.value = result.offlineProductionSummary
    offlineExperienceGained.value = result.offlineExperienceGained
    showOfflineProgress.value = true

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

// Sales Manager Processing
function processSalesManagers(deltaTimeMS: number) {
  if (!user.value.upgrades.salesManagers) return

  for (const itemKey in user.value.upgrades.salesManagers) {
    const manager = user.value.upgrades.salesManagers[itemKey as ItemKey]
    if (!manager || manager.level === 0) continue

    const inventoryItem = user.value.inventory[itemKey as ItemKey]
    if (!inventoryItem) continue

    const levelConfig = getSalesManagerLevelConfig(manager.level)
    if (!levelConfig) continue

    // Handle auto-sell
    if (manager.settings.autoSellEnabled && levelConfig.features.canSell) {
      const sellThreshold = manager.settings.sellThreshold || (manager.level === 1 ? 90 : 80)
      const currentPercentage = (inventoryItem.amount / inventoryItem.capacity) * 100

      if (currentPercentage >= sellThreshold && inventoryItem.amount > 0) {
        const itemsAboveThreshold =
          inventoryItem.amount - Math.floor((sellThreshold / 100) * inventoryItem.capacity)

        // Add to accumulator based on sell rate and time elapsed
        if (levelConfig.sellRate === -1) {
          manager.partialItemsToSell += itemsAboveThreshold // Unlimited rate - sell all above threshold
        } else {
          manager.partialItemsToSell += (levelConfig.sellRate * deltaTimeMS) / 1000
        }

        // Only process when we have at least 1 full item to sell
        const itemsToSell = Math.floor(manager.partialItemsToSell)
        if (itemsToSell > 0) {
          const actualItemsToSell = Math.min(itemsToSell, itemsAboveThreshold, inventoryItem.amount)

          if (actualItemsToSell > 0) {
            const sellPrice = inventoryItem.basePrice * inventoryItem.sellMultiplier
            const totalEarned = actualItemsToSell * sellPrice

            // Execute the sale
            inventoryItem.amount -= actualItemsToSell
            user.value.money += totalEarned

            // Update statistics
            manager.statistics.totalItemsSold += actualItemsToSell
            manager.statistics.totalMoneyEarned += totalEarned
            manager.statistics.lastActionTime = Date.now()

            // Record timeseries data
            recordManagerSellAction(manager, actualItemsToSell, totalEarned)

            // Subtract sold items from accumulator (keep remainder)
            manager.partialItemsToSell = Math.max(
              0,
              Math.min(1, manager.partialItemsToSell - actualItemsToSell),
            )

            // Mark for save
            markUnsavedChanges()
          }
        }
      }
    }

    // Handle auto-buy
    if (manager.settings.autoBuyEnabled && levelConfig.features.canBuy && manager.level >= 3) {
      const buyThreshold = manager.settings.buyThreshold || 10
      const currentPercentage = (inventoryItem.amount / inventoryItem.capacity) * 100

      if (currentPercentage <= buyThreshold && inventoryItem.amount < inventoryItem.capacity) {
        const buyPrice = inventoryItem.cost
        const availableSpace = inventoryItem.capacity - inventoryItem.amount

        // Add to accumulator based on buy rate and time elapsed
        if (levelConfig.sellRate === -1) {
          // Unlimited rate - use a high rate for accumulation
          manager.partialItemsToBuy += (1000 * deltaTimeMS) / 1000 // 1000 items/second for "unlimited"
        } else {
          manager.partialItemsToBuy += (levelConfig.sellRate * deltaTimeMS) / 1000
        }

        // Only process when we have at least 1 full item to buy
        const itemsToBuy = Math.floor(manager.partialItemsToBuy)

        if (itemsToBuy > 0) {
          const maxAffordable = Math.floor(user.value.money / buyPrice)
          const spaceBelowThreshold = Math.max(
            0,
            Math.floor((buyThreshold / 100) * inventoryItem.capacity) - inventoryItem.amount,
          )
          const actualItemsToBuy = Math.min(
            itemsToBuy,
            maxAffordable,
            availableSpace,
            spaceBelowThreshold,
          )

          if (actualItemsToBuy > 0 && user.value.money >= buyPrice * actualItemsToBuy) {
            const totalCost = actualItemsToBuy * buyPrice

            // Execute the purchase
            inventoryItem.amount += actualItemsToBuy
            user.value.money -= totalCost

            // Update statistics
            manager.statistics.totalItemsBought += actualItemsToBuy
            manager.statistics.totalMoneySpent += totalCost
            manager.statistics.lastActionTime = Date.now()

            // Record timeseries data
            recordManagerBuyAction(manager, actualItemsToBuy, totalCost)

            // Subtract bought items from accumulator (keep remainder)
            manager.partialItemsToBuy -= actualItemsToBuy

            // Mark for save
            markUnsavedChanges()
          }
        }
      }
    }
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

      // Check if we have enough input materials
      const hasEnoughInputs = usesInventory ? availableAmount >= batchSize : true // No inputs needed

      // Check if there's enough space in output inventory
      const producesItemKey = machineConf.produces as ItemKey
      let outputInventory = user.value.inventory[producesItemKey]

      // If output inventory doesn't exist, create it with proper capacity
      if (!outputInventory) {
        const itemInfo = itemData.value[producesItemKey]
        user.value.inventory[producesItemKey] = {
          name: itemInfo.name,
          icon: itemInfo.icon,
          amount: 0,
          cost: itemInfo.cost,
          basePrice: itemInfo.basePrice,
          sellMultiplier: itemInfo.sellMultiplier,
          capacity: calculateItemCapacity(producesItemKey),
        }
        outputInventory = user.value.inventory[producesItemKey]
      }

      const hasInventorySpace = outputInventory.amount + batchSize <= outputInventory.capacity

      // Reactivate machine if all conditions are met
      if (hasEnoughInputs && hasInventorySpace) {
        machine.isActive = true
        // Item consumption will occur when production completes
        // Progress percent is set to 0 when production is completed
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
              capacity: calculateItemCapacity(producesItemKey),
            }
          }

          // Check if adding bonus items would exceed capacity
          const inventoryItem = user.value.inventory[producesItemKey]!
          const availableSpace = inventoryItem.capacity - inventoryItem.amount
          const itemsToAdd = Math.min(numberOfBonusItems, availableSpace)

          if (itemsToAdd > 0) {
            inventoryItem.amount += itemsToAdd
            machine.itemsProduced += itemsToAdd // Track total items produced
            machine.bonusItems += itemsToAdd // Track bonus items separately

            // Record bonus production in stats
            recordBonusProduction(producesItemKey, itemsToAdd)
          }

          // If we couldn't add all bonus items due to capacity or that the inventory is full after production, pause the machine
          if (itemsToAdd < numberOfBonusItems || inventoryItem.amount >= inventoryItem.capacity) {
            machine.isActive = false
            machine.isRunning = false
          }

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
            capacity: calculateItemCapacity(producesItemKey),
          }
        }

        // Check if adding batch would exceed capacity
        const inventoryItem = user.value.inventory[producesItemKey]!
        const availableSpace = inventoryItem.capacity - inventoryItem.amount
        const itemsToAdd = Math.min(batchSize, availableSpace)

        if (itemsToAdd > 0) {
          inventoryItem.amount += itemsToAdd
          machine.itemsProduced += itemsToAdd // Track items produced

          // Record regular production in stats
          recordProduction(producesItemKey, itemsToAdd)
        }

        // If we couldn't add all items due to capacity or that the inventory is full after production, pause the machine
        if (itemsToAdd < batchSize || inventoryItem.amount >= inventoryItem.capacity) {
          machine.isActive = false
          machine.isRunning = false
        }

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

  // Process Sales Managers
  processSalesManagers(elapsedMS)

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
  loadGame('coffeeQueen_guest')

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
