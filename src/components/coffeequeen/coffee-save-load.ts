import type {
    ItemData,
    ItemKey,
    LoadGameResult,
    MachineConfig,
    MachineKey,
    OfflineProductionSummary,
    SavedGameData,
    User,
} from "./types";
import {
    calculateBatchSize,
    calculateEfficiencyBonus,
} from "./coffee-upgrade-calculations";
import { calculateInventoryMultiplier } from "./data-upgrades";

import { normalizeBucketsForAllTimeScales } from "@/composables/coffeequeen/statsManager";

// Get stats manager instance for saving/loading
let statsManagerRef: any = null;

export function setStatsManagerReference(statsManager: any) {
    statsManagerRef = statsManager;
}

// --- OFFLINE PROGRESS CALCULATION ---

/**
 * Simulates game progress for the time the user was offline using time-stepped simulation.
 */
function simulateOfflineProgress(
    user: User,
    machinesConfig: Record<MachineKey, MachineConfig>,
    itemData: Record<ItemKey, ItemData>,
    offlineTimeMS: number,
): {
    productionSummary: OfflineProductionSummary;
    totalExperienceGained: number;
} {
    const productionSummary: OfflineProductionSummary = {};
    let totalExperienceGained = 0;

    // Create a deep copy of the user state to avoid modifying the original during simulation
    const simUser: User = JSON.parse(JSON.stringify(user));
    console.log('Raw coffee beans before simulation:', simUser.inventory['rawCoffeeBeans']);

    // Ensure all inventory items have proper capacity based on current upgrades
    const inventoryMultiplier = calculateInventoryMultiplier(user.upgrades.inventory);
    for (const itemKey in simUser.inventory) {
        const inventoryItem = simUser.inventory[itemKey];
        const itemInfo = itemData[itemKey as ItemKey];
        if (inventoryItem && itemInfo) {
            inventoryItem.capacity = Math.floor(itemInfo.defaultCapacity * inventoryMultiplier);
            // Also ensure starting inventory doesn't exceed capacity (edge case for old saves)
            if (inventoryItem.amount > inventoryItem.capacity) {
                inventoryItem.amount = inventoryItem.capacity;
            }
        }
    }
    console.log('Raw coffee beans before simulation, checked:', simUser.inventory['rawCoffeeBeans']);


    console.log(
        `Simulating offline progress for ${
            offlineTimeMS / 1000
        } seconds using time-stepped simulation.`,
    );

    // We cap the offline time to 1 hour (3,600,000 ms) Upgradeable in the future
    offlineTimeMS = Math.min(offlineTimeMS, 3600000);

    // Use a time step of 100ms for fast but accurate simulation
    const timeStepMS = 100;
    const totalSteps = Math.floor(offlineTimeMS / timeStepMS);

    for (let step = 0; step < totalSteps; step++) {
        // Process all machines in this time step (similar to game loop)
        for (const machineKey in simUser.machines) {
            const machine = simUser.machines[machineKey];
            const machineConf = machinesConfig[machineKey as MachineKey];

            if (!machine || !machine.isOwned || !machineConf) continue;
            
            // Skip manual machines during offline simulation
            if (machine.isManual) continue;

            // Check if the machine is active
            if (!machine.isActive) {
                const batchSize = machine.batchSize || calculateBatchSize(machineConf.baseBatchSize, machine.speedUpgrade);
                const usesItemKey = machineConf.uses as ItemKey;
                const usesInventory = usesItemKey ? simUser.inventory[usesItemKey] : null;
                const availableAmount = usesInventory?.amount || 0;

                // Check if we have enough input materials
                const hasEnoughInputs = usesInventory ? availableAmount >= batchSize : true;

                // Check if there's enough space in output inventory
                const producesItemKey = machineConf.produces as ItemKey;
                let outputInventory = simUser.inventory[producesItemKey];

                // If output inventory doesn't exist, create it with proper capacity
                if (!outputInventory) {
                    const itemInfo = itemData[producesItemKey];
                    const inventoryMultiplier = calculateInventoryMultiplier(user.upgrades.inventory);
                    simUser.inventory[producesItemKey] = {
                        name: itemInfo.name,
                        icon: itemInfo.icon,
                        amount: 0,
                        cost: itemInfo.cost,
                        basePrice: itemInfo.basePrice,
                        sellMultiplier: itemInfo.sellMultiplier,
                        capacity: Math.floor(itemInfo.defaultCapacity * inventoryMultiplier),
                    };
                    outputInventory = simUser.inventory[producesItemKey];
                }

                // Reactivate machine if all conditions are met
                if (hasEnoughInputs) {
                    machine.isActive = true;
                } else {
                    continue; // Skip to next machine if not active
                }
            }

            if (machine.progressPercent < 1) {
                // Calculate progress per millisecond based on current production time
                const progressPerMS = 1 / machine.productionTime;
                const progressThisFrame = timeStepMS * progressPerMS;

                // Update progress
                machine.progressPercent += progressThisFrame;

                // Update efficiency progress gradually during production
                if (machine.efficiencyUpgrade > 0) {
                    const totalEfficiencyBonus = calculateEfficiencyBonus(machine.efficiencyUpgrade);
                    const efficiencyGainThisFrame = totalEfficiencyBonus * progressThisFrame;
                    machine.efficiencyProgress += efficiencyGainThisFrame;

                    // Check if we've accumulated enough for bonus items
                    if (machine.efficiencyProgress >= 1) {
                        const numberOfBonusItems = Math.floor(machine.efficiencyProgress) * machine.batchSize;
                        const producesItemKey = machineConf.produces as ItemKey;

                        // Ensure inventory item exists
                        if (!simUser.inventory[producesItemKey]) {
                            const itemInfo = itemData[producesItemKey];
                            const inventoryMultiplier = calculateInventoryMultiplier(user.upgrades.inventory);
                            simUser.inventory[producesItemKey] = {
                                name: itemInfo.name,
                                icon: itemInfo.icon,
                                amount: 0,
                                cost: itemInfo.cost,
                                basePrice: itemInfo.basePrice,
                                sellMultiplier: itemInfo.sellMultiplier,
                                capacity: Math.floor(itemInfo.defaultCapacity * inventoryMultiplier),
                            };
                        }

                        // Check if adding bonus items would exceed capacity
                        const inventoryItem = simUser.inventory[producesItemKey];
                        const availableSpace = inventoryItem.capacity - inventoryItem.amount;
                        const itemsToAdd = Math.min(numberOfBonusItems, availableSpace);
                        const itemsLost = numberOfBonusItems - itemsToAdd;

                        if (itemsToAdd > 0) {
                            inventoryItem.amount += itemsToAdd;
                            
                            // Track production for summary
                            if (!productionSummary[producesItemKey]) {
                                productionSummary[producesItemKey] = { amount: 0, bonusAmount: 0 };
                            }
                            productionSummary[producesItemKey].amount += itemsToAdd;
                            productionSummary[producesItemKey].bonusAmount += itemsToAdd;
                        }

                        // Track items lost to capacity
                        if (itemsLost > 0) {
                            if (!productionSummary[producesItemKey]) {
                                productionSummary[producesItemKey] = { amount: 0, bonusAmount: 0 };
                            }
                            if (!productionSummary[producesItemKey].itemsLostToCapacity) {
                                productionSummary[producesItemKey].itemsLostToCapacity = 0;
                            }
                            productionSummary[producesItemKey].itemsLostToCapacity! += itemsLost;
                        }

                        machine.efficiencyProgress -= Math.floor(machine.efficiencyProgress);
                    }
                }
            }

            if (machine.progressPercent >= 1) {
                // Production complete - produce main items based on batch size
                const batchSize = machine.batchSize || 1;
                const producesItemKey = machineConf.produces as ItemKey;

                // Ensure inventory item exists
                if (!simUser.inventory[producesItemKey]) {
                    const itemInfo = itemData[producesItemKey];
                    const inventoryMultiplier = calculateInventoryMultiplier(user.upgrades.inventory);
                    simUser.inventory[producesItemKey] = {
                        name: itemInfo.name,
                        icon: itemInfo.icon,
                        amount: 0,
                        cost: itemInfo.cost,
                        basePrice: itemInfo.basePrice,
                        sellMultiplier: itemInfo.sellMultiplier,
                        capacity: Math.floor(itemInfo.defaultCapacity * inventoryMultiplier),
                    };
                }

                // Consume item inputs
                const usesItemKey = machineConf.uses as ItemKey;
                const usesInventory = usesItemKey ? simUser.inventory[usesItemKey] : null;
                const availableAmount = usesInventory?.amount || 0;

                // Check if adding batch would exceed capacity
                const inventoryItem = simUser.inventory[producesItemKey];
                const availableSpace = inventoryItem.capacity - inventoryItem.amount;
                const itemsToAdd = Math.min(batchSize, availableSpace);
                const itemsLost = batchSize - itemsToAdd;

                if (itemsToAdd > 0) {
                    inventoryItem.amount += itemsToAdd;
                    
                    // Track production for summary
                    if (!productionSummary[producesItemKey]) {
                        productionSummary[producesItemKey] = { amount: 0, bonusAmount: 0 };
                    }
                    productionSummary[producesItemKey].amount += itemsToAdd;

                    // Award XP for items actually added
                    simUser.experience += itemsToAdd;
                    totalExperienceGained += itemsToAdd;

                    // Only consume inputs if we were able to produce otherwise no inputs are consumed
                    if (usesInventory && availableAmount >= batchSize) {
                        usesInventory.amount -= batchSize;
                    } 
                }

                // Track items lost to capacity
                if (itemsLost > 0) {
                    if (!productionSummary[producesItemKey]) {
                        productionSummary[producesItemKey] = { amount: 0, bonusAmount: 0 };
                    }
                    if (!productionSummary[producesItemKey].itemsLostToCapacity) {
                        productionSummary[producesItemKey].itemsLostToCapacity = 0;
                    }
                    productionSummary[producesItemKey].itemsLostToCapacity! += itemsLost;
                }

                // Check for level up
                if (simUser.experience >= simUser.nextLevelExperience) {
                    simUser.level++;
                    simUser.experience -= simUser.nextLevelExperience;
                    simUser.nextLevelExperience = Math.ceil(simUser.nextLevelExperience * 1.2);
                }

                // Reset for next production cycle and consume resources
                machine.progressPercent = 0;
            }
    }

    // Calculate total experience gained

    // Log production summary
    console.log('Production summary:', productionSummary);

    // Copy the simulated state back to the original user object
    user.inventory = simUser.inventory;
    user.experience = simUser.experience;
    user.level = simUser.level;
    user.nextLevelExperience = simUser.nextLevelExperience;
    user.machines = simUser.machines;

    // Add item names and icons to the production summary
    for (const itemKey in productionSummary) {
        const itemInfo = itemData[itemKey as ItemKey];
        const summaryItem = productionSummary[itemKey];
        if (itemInfo && summaryItem) {
            summaryItem.name = itemInfo.name;
            summaryItem.icon = itemInfo.icon;
        }
    }

    console.log(
        `📈 Final production summary:`,
        productionSummary,
        `💫 Total experience gained:`,
        totalExperienceGained,
    );
}
return { productionSummary, totalExperienceGained };
}

// --- SAVE/LOAD LOGIC ---

/**
 * Saves the current game state to localStorage.
 */
export function saveToLocalStorage(
    user: User,
    userId: string = "guest",
    userName: string = "Guest",
): void {
    try {
        // Get current production stats from the stats manager
        let productionStats = null;
        if (statsManagerRef && statsManagerRef.value) {
            productionStats = {
                statsManager: statsManagerRef.value,
                timestamp: Date.now()
            };
        }

        const gameData: SavedGameData = {
            userName: userName,
            money: user.money,
            level: user.level,
            experience: user.experience,
            nextLevelExperience: user.nextLevelExperience,
            machines: user.machines,
            inventory: user.inventory,
            upgrades: user.upgrades,
            productionStats: productionStats,
            lastSaved: new Date().toISOString(),
        };
        localStorage.setItem(`coffeeQueen_${userId}`, JSON.stringify(gameData));
        console.log("Data saved to localStorage with production stats:", {
            statsExists: !!productionStats,
            bucketCounts: productionStats ? {
                tenSeconds: productionStats.statsManager.tenSeconds?.length || 0,
                oneMinute: productionStats.statsManager.oneMinute?.length || 0,
                tenMinutes: productionStats.statsManager.tenMinutes?.length || 0,
                oneHour: productionStats.statsManager.oneHour?.length || 0,
                tenHours: productionStats.statsManager.tenHours?.length || 0,
                hundredHours: productionStats.statsManager.hundredHours?.length || 0,
                allTime: productionStats.statsManager.allTime?.length || 0
            } : {}
        });
    } catch (error) {
        console.error("Failed to save to localStorage:", error);
    }
}

/**
 * Loads game state from a localStorage key and calculates offline progress.
 */
export function loadFromLocalStorage(
    key: string,
    machinesConfig: Record<MachineKey, MachineConfig>,
    itemData: Record<ItemKey, ItemData>,
): LoadGameResult | null {
    try {
        const savedData = localStorage.getItem(key);
        if (savedData) {
            const gameData: SavedGameData = JSON.parse(savedData);

            // Ensure upgrades exist for backward compatibility
            if (!gameData.upgrades) {
                gameData.upgrades = {
                    managers: {},
                    inventory: {},
                };
            }
            
            // Ensure inventory upgrades exist for backward compatibility
            if (!gameData.upgrades.inventory) {
                gameData.upgrades.inventory = {};
            }

            // Restore production stats to stats manager if available
            if (gameData.productionStats && statsManagerRef && statsManagerRef.value) {
                try {
                    if (gameData.productionStats.statsManager) {
                        const savedStats = gameData.productionStats.statsManager;
                        console.log('Statmanager from localStorage:', {...savedStats});
                        
                        // Update the stats manager properties individually to maintain reactivity
                        statsManagerRef.value.gameTimeMs = savedStats.gameTimeMs || Date.now();
                        statsManagerRef.value.currentBucketIndex = savedStats.currentBucketIndex || 0;
                        statsManagerRef.value.tenSeconds = savedStats.tenSeconds || [];
                        statsManagerRef.value.oneMinute = savedStats.oneMinute || [];
                        statsManagerRef.value.tenMinutes = savedStats.tenMinutes || [];
                        statsManagerRef.value.oneHour = savedStats.oneHour || [];
                        statsManagerRef.value.tenHours = savedStats.tenHours || [];
                        statsManagerRef.value.hundredHours = savedStats.hundredHours || [];
                        statsManagerRef.value.allTime = savedStats.allTime || [];
                        statsManagerRef.value.lastSaveTime = savedStats.lastSaveTime || Date.now();
                        
                        console.log('📈 Production stats restored from localStorage:', {
                            bucketCounts: {
                                tenSeconds: statsManagerRef.value.tenSeconds?.length || 'none',
                                oneMinute: statsManagerRef.value.oneMinute?.length || 'none',
                                tenMinutes: statsManagerRef.value.tenMinutes?.length || 'none',
                                oneHour: statsManagerRef.value.oneHour?.length || 'none',
                                tenHours: statsManagerRef.value.tenHours?.length || 'none',
                                hundredHours: statsManagerRef.value.hundredHours?.length || 'none',
                                allTime: statsManagerRef.value.allTime?.length || 'none'
                            }
                        });
                        console.log('Restored stats manager tenSeconds sample:', statsManagerRef.value.tenSeconds.slice(0, 3));
                        
                        // Normalize buckets to ensure complete intervals for smooth charts
                        normalizeBucketsForAllTimeScales(statsManagerRef.value.gameTimeMs);
                        
                        console.log('🔧 Buckets normalized, final counts:', {
                            bucketCounts: {
                                tenSeconds: statsManagerRef.value.tenSeconds?.length || 'none',
                                oneMinute: statsManagerRef.value.oneMinute?.length || 'none',
                                tenMinutes: statsManagerRef.value.tenMinutes?.length || 'none',
                                oneHour: statsManagerRef.value.oneHour?.length || 'none',
                                tenHours: statsManagerRef.value.tenHours?.length || 'none',
                                hundredHours: statsManagerRef.value.hundredHours?.length || 'none',
                                allTime: statsManagerRef.value.allTime?.length || 'none'
                            }
                        });
                    }
                } catch (statsError) {
                    console.error('Failed to restore production stats, initializing fresh:', statsError);
                    // Initialize fresh stats in the statsManagerRef if restoration fails
                    if (statsManagerRef && statsManagerRef.value) {
                        const gameTime = Date.now();
                        statsManagerRef.value.gameTimeMs = gameTime;
                        statsManagerRef.value.currentBucketIndex = 0;
                        statsManagerRef.value.tenSeconds = [];
                        statsManagerRef.value.oneMinute = [];
                        statsManagerRef.value.tenMinutes = [];
                        statsManagerRef.value.oneHour = [];
                        statsManagerRef.value.tenHours = [];
                        statsManagerRef.value.hundredHours = [];
                        statsManagerRef.value.allTime = [];
                        statsManagerRef.value.lastSaveTime = gameTime;
                        
                        // Initialize with proper bucket structure
                        normalizeBucketsForAllTimeScales(gameTime);
                    }
                }
            } else {
                console.log('📈 No production stats found in save data or stats manager not available');
                // Initialize fresh stats in the statsManagerRef if no data found
                if (statsManagerRef && statsManagerRef.value) {
                    const gameTime = Date.now();
                    statsManagerRef.value.gameTimeMs = gameTime;
                    statsManagerRef.value.currentBucketIndex = 0;
                    statsManagerRef.value.tenSeconds = [];
                    statsManagerRef.value.oneMinute = [];
                    statsManagerRef.value.tenMinutes = [];
                    statsManagerRef.value.oneHour = [];
                    statsManagerRef.value.tenHours = [];
                    statsManagerRef.value.hundredHours = [];
                    statsManagerRef.value.allTime = [];
                    statsManagerRef.value.lastSaveTime = gameTime;
                    
                    // Initialize with proper bucket structure  
                    normalizeBucketsForAllTimeScales(gameTime);
                }
            }

            // Calculate offline progress
            const now = new Date();
            const lastSaved = new Date(gameData.lastSaved || now);
            let offlineTimeMS = now.getTime() - lastSaved.getTime();

            // Cap offline time to 1 hour (3,600,000 ms)
            const maxIdleTimeMS = 3600 * 1000;
            if (offlineTimeMS > maxIdleTimeMS) {
                offlineTimeMS = maxIdleTimeMS;
            }

            let offlineProductionSummary: OfflineProductionSummary = {};
            let offlineExperienceGained = 0;

            // Only calculate offline progress if there was significant time away (> 1 second)
            console.log('Calculating offline progress..., offlineTimeMS:', offlineTimeMS);
            if (offlineTimeMS > 1000) {
                const result = simulateOfflineProgress(
                    gameData,
                    machinesConfig,
                    itemData,
                    offlineTimeMS,
                );
                offlineProductionSummary = result.productionSummary;
                offlineExperienceGained = result.totalExperienceGained;
            }

            return {
                gameData,
                offlineProductionSummary,
                offlineExperienceGained,
            };
        }
    } catch (error) {
        console.error("Failed to load from localStorage:", error);
    }
    return null;
}

/**
 * Retrieves all saved games from localStorage.
 */
export function displayLocalSaves(): SavedGameData[] {
    const allItems: SavedGameData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("coffeeQueen_")) {
            try {
                const savedData = localStorage.getItem(key);
                if (savedData) {
                    const gameData: SavedGameData = JSON.parse(savedData);
                    gameData.itemKey = key; // Add the key for loading later
                    allItems.push(gameData);
                }
            } catch (error) {
                console.error(
                    `Failed to parse saved data for key: ${key}`,
                    error,
                );
            }
        }
    }
    return allItems;
}

/**
 * Creates a new user with default values
 */
export function createNewUser(): User {
    return {
        money: 10000,
        level: 1,
        experience: 0,
        nextLevelExperience: 100,
        machines: {},
        inventory: {},
        upgrades: {
            managers: {},
            inventory: {},
        },
        productionStats: null,
    };
}
