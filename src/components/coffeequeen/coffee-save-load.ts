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

import { normalizeBucketsForAllTimeScales } from "@/composables/coffeequeen/statsManager";

// Get stats manager instance for saving/loading
let statsManagerRef: any = null;

export function setStatsManagerReference(statsManager: any) {
    statsManagerRef = statsManager;
    console.log('🔗 Stats manager reference set in save/load module');
    console.log('Stats manager ref check:', {
        exists: !!statsManagerRef,
        hasValue: !!(statsManagerRef && statsManagerRef.value),
        currentBuckets: statsManagerRef && statsManagerRef.value ? {
            tenSeconds: statsManagerRef.value.tenSeconds?.length || 0,
            oneMinute: statsManagerRef.value.oneMinute?.length || 0
        } : 'no value'
    });
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

    console.log(
        `Simulating offline progress for ${
            offlineTimeMS / 1000
        } seconds using time-stepped simulation.`,
    );

    // Use a time step of 100ms for fast but accurate simulation
    const timeStepMS = 100;
    const totalSteps = Math.floor(offlineTimeMS / timeStepMS);

    for (let step = 0; step < totalSteps; step++) {
        // Process all machines in this time step (similar to game loop)
        for (const machineKey in simUser.machines) {
            const machine = simUser.machines[machineKey];
            if (!machine) continue;

            const machineConf = machinesConfig[machineKey as MachineKey];
            if (!machineConf) continue;

            // Check if the machine is active
            if (!machine.isActive) {
                continue;
            }

            // Update production progress
            if (machine.progressPercent < 1) {
                const deltaTime = timeStepMS;
                const productionTime = machine.productionTime;

                if (productionTime > 0) {
                    const progress = deltaTime / productionTime;
                    machine.progressPercent = Math.min(
                        1,
                        machine.progressPercent + progress,
                    );

                    // Update efficiency progress
                    if (machine.efficiencyUpgrade > 0) {
                        const efficiencyBonus = calculateEfficiencyBonus(
                            machine.efficiencyUpgrade,
                        );
                        const efficiencyProgress = progress * efficiencyBonus;
                        machine.efficiencyProgress = Math.min(
                            1,
                            machine.efficiencyProgress + efficiencyProgress,
                        );
                    }
                }
            }

            // If production cycle is complete
            if (machine.progressPercent >= 1) {
                // Calculate actual production
                let itemsProduced = machine.batchSize || 1;

                // Add efficiency bonus items
                if (machine.efficiencyProgress >= 1) {
                    const efficiencyBonus = calculateEfficiencyBonus(
                        machine.efficiencyUpgrade,
                    );
                    const bonusItems = Math.floor(
                        itemsProduced * efficiencyBonus,
                    );
                    itemsProduced += bonusItems;
                    machine.efficiencyProgress = 0; // Reset efficiency progress
                }

                // Check if we have input materials
                const inputItem = machine.uses;
                let canProduce = true;

                if (inputItem && simUser.inventory[inputItem as ItemKey]) {
                    const inventoryItem =
                        simUser.inventory[inputItem as ItemKey];
                    if (inventoryItem) {
                        const available = inventoryItem.amount;
                        const needed = itemsProduced;

                        if (available >= needed) {
                            inventoryItem.amount -= needed;
                        } else {
                            canProduce = false;
                        }
                    } else {
                        canProduce = false;
                    }
                }

                if (canProduce) {
                    // Produce output items
                    const outputItem = machine.produces as ItemKey;
                    if (!simUser.inventory[outputItem]) {
                        const itemInfo = itemData[outputItem];
                        simUser.inventory[outputItem] = {
                            name: itemInfo.name,
                            icon: itemInfo.icon,
                            amount: 0,
                            cost: itemInfo.cost,
                            basePrice: itemInfo.basePrice,
                            sellMultiplier: itemInfo.sellMultiplier,
                        };
                    }

                    simUser.inventory[outputItem].amount += itemsProduced;

                    // Track production for summary
                    if (!productionSummary[outputItem]) {
                        productionSummary[outputItem] = { amount: 0 };
                    }
                    productionSummary[outputItem].amount += itemsProduced;

                    // Gain experience
                    const experienceGain = itemsProduced * 10; // 10 XP per item
                    simUser.experience += experienceGain;
                    totalExperienceGained += experienceGain;
                }

                // Reset production progress
                machine.progressPercent = 0;
            }
        }
    }

    // Handle level ups
    while (simUser.experience >= simUser.nextLevelExperience) {
        simUser.level++;
        simUser.experience -= simUser.nextLevelExperience;
        simUser.nextLevelExperience = Math.ceil(
            simUser.nextLevelExperience * 1.2,
        );
    }

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
        `productionSummary:`,
        productionSummary,
        `totalExperienceGained:`,
        totalExperienceGained,
    );
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
                };
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

            // Only calculate offline progress if there was significant time away (> 30 seconds)
            if (offlineTimeMS > 30000) {
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
        },
        productionStats: null,
    };
}

/**
 * Debug function to test stats manager save/load
 */
export function debugStatsManager() {
    console.log('🧪 Debug Stats Manager:', {
        statsManagerRefExists: !!statsManagerRef,
        statsManagerValueExists: !!(statsManagerRef && statsManagerRef.value),
        currentData: statsManagerRef && statsManagerRef.value ? {
            gameTimeMs: statsManagerRef.value.gameTimeMs,
            buckets: {
                tenSeconds: statsManagerRef.value.tenSeconds?.length || 0,
                oneMinute: statsManagerRef.value.oneMinute?.length || 0,
                tenMinutes: statsManagerRef.value.tenMinutes?.length || 0,
                oneHour: statsManagerRef.value.oneHour?.length || 0,
                tenHours: statsManagerRef.value.tenHours?.length || 0,
                hundredHours: statsManagerRef.value.hundredHours?.length || 0,
                allTime: statsManagerRef.value.allTime?.length || 0
            },
            sampleBucket: statsManagerRef.value.tenSeconds?.[0] || 'none'
        } : 'no data'
    });
}
