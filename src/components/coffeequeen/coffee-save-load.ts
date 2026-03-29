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
import { calculateInventoryMultiplier } from "./data-upgrades";
import { simulateGameStep } from "./coffee-simulation";

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
    console.log(
        "Raw coffee beans before simulation:",
        simUser.inventory["rawCoffeeBeans"],
    );

    // Ensure all inventory items have proper capacity based on current upgrades
    const inventoryMultiplier = calculateInventoryMultiplier(
        user.upgrades.inventory,
    );
    for (const itemKey in simUser.inventory) {
        const inventoryItem = simUser.inventory[itemKey];
        const itemInfo = itemData[itemKey as ItemKey];
        if (inventoryItem && itemInfo) {
            inventoryItem.capacity = Math.floor(
                itemInfo.defaultCapacity * inventoryMultiplier,
            );
            // Also ensure starting inventory doesn't exceed capacity (edge case for old saves)
            if (inventoryItem.amount > inventoryItem.capacity) {
                inventoryItem.amount = inventoryItem.capacity;
            }
        }
    }
    console.log(
        "Raw coffee beans before simulation, checked:",
        simUser.inventory["rawCoffeeBeans"],
    );

    console.log(
        `Simulating offline progress for ${
            offlineTimeMS / 1000
        } seconds using time-stepped simulation.`,
    );

    // We cap the offline time to 1 hour (3,600,000 ms) Upgradeable in the future
    offlineTimeMS = Math.min(offlineTimeMS, 3600000);

    // Use a time step for consistent offline progression and performance.
    const timeStepMS = 100;
    const totalSteps = Math.floor(offlineTimeMS / timeStepMS);

    for (let step = 0; step < totalSteps; step++) {
        const stepResult = simulateGameStep(
            simUser,
            machinesConfig,
            itemData,
            timeStepMS,
            {
                skipManualMachines: true,
                hooks: {
                    onProduced: ({ itemKey, amount, source }) => {
                        ensureSummaryItem(productionSummary, itemKey);
                        productionSummary[itemKey]!.amount += amount;
                        if (source === "bonus") {
                            productionSummary[itemKey]!.bonusAmount += amount;
                        }
                    },
                    onItemsLostToCapacity: ({ itemKey, amount }) => {
                        ensureSummaryItem(productionSummary, itemKey);
                        const summaryItem = productionSummary[itemKey]!;
                        summaryItem.itemsLostToCapacity =
                            (summaryItem.itemsLostToCapacity || 0) + amount;
                    },
                    onManagerSell: ({ itemKey, items }) => {
                        ensureSummaryItem(productionSummary, itemKey);
                        const summaryItem = productionSummary[itemKey]!;
                        summaryItem.itemsSold = (summaryItem.itemsSold || 0) +
                            items;
                    },
                    onManagerBuy: ({ itemKey, items }) => {
                        ensureSummaryItem(productionSummary, itemKey);
                        const summaryItem = productionSummary[itemKey]!;
                        summaryItem.itemsBought =
                            (summaryItem.itemsBought || 0) + items;
                    },
                },
            },
        );

        totalExperienceGained += stepResult.experienceGained;
    }

    // Calculate total experience gained

    // Log production summary
    console.log("Production summary:", productionSummary);

    // Copy the simulated state back to the original user object
    user.inventory = simUser.inventory;
    user.experience = simUser.experience;
    user.level = simUser.level;
    user.nextLevelExperience = simUser.nextLevelExperience;
    user.machines = simUser.machines;
    user.money = simUser.money; // Don't forget to copy money back after sales manager operations
    user.upgrades = simUser.upgrades; // Copy sales manager statistics

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

    return { productionSummary, totalExperienceGained };
}

function ensureSummaryItem(
    productionSummary: OfflineProductionSummary,
    itemKey: ItemKey,
) {
    if (!productionSummary[itemKey]) {
        productionSummary[itemKey] = { amount: 0, bonusAmount: 0 };
    }
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
                timestamp: Date.now(),
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
            bucketCounts: productionStats
                ? {
                    tenSeconds:
                        productionStats.statsManager.tenSeconds?.length || 0,
                    oneMinute: productionStats.statsManager.oneMinute?.length ||
                        0,
                    tenMinutes:
                        productionStats.statsManager.tenMinutes?.length || 0,
                    oneHour: productionStats.statsManager.oneHour?.length || 0,
                    tenHours: productionStats.statsManager.tenHours?.length ||
                        0,
                    hundredHours:
                        productionStats.statsManager.hundredHours?.length || 0,
                    allTime: productionStats.statsManager.allTime?.length || 0,
                }
                : {},
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
                    salesManagers: {},
                };
            }

            // Ensure inventory upgrades exist for backward compatibility
            if (!gameData.upgrades.inventory) {
                gameData.upgrades.inventory = {};
            }

            // Ensure sales managers exist for backward compatibility
            if (!gameData.upgrades.salesManagers) {
                gameData.upgrades.salesManagers = {};
            }

            // Migrate sales managers to include accumulator properties
            for (const itemKey in gameData.upgrades.salesManagers) {
                const manager = gameData.upgrades.salesManagers[itemKey];
                if (manager) {
                    // Add accumulator properties if they don't exist
                    if (typeof manager.partialItemsToSell !== "number") {
                        manager.partialItemsToSell = 0;
                    }
                    if (typeof manager.partialItemsToBuy !== "number") {
                        manager.partialItemsToBuy = 0;
                    }
                }
            }

            // Restore production stats to stats manager if available
            if (
                gameData.productionStats && statsManagerRef &&
                statsManagerRef.value
            ) {
                try {
                    if (gameData.productionStats.statsManager) {
                        const savedStats =
                            gameData.productionStats.statsManager;
                        console.log("Statmanager from localStorage:", {
                            ...savedStats,
                        });

                        // Update the stats manager properties individually to maintain reactivity
                        statsManagerRef.value.gameTimeMs =
                            savedStats.gameTimeMs || Date.now();
                        statsManagerRef.value.currentBucketIndex =
                            savedStats.currentBucketIndex || 0;
                        statsManagerRef.value.tenSeconds =
                            savedStats.tenSeconds || [];
                        statsManagerRef.value.oneMinute =
                            savedStats.oneMinute || [];
                        statsManagerRef.value.tenMinutes =
                            savedStats.tenMinutes || [];
                        statsManagerRef.value.oneHour = savedStats.oneHour ||
                            [];
                        statsManagerRef.value.tenHours = savedStats.tenHours ||
                            [];
                        statsManagerRef.value.hundredHours =
                            savedStats.hundredHours || [];
                        statsManagerRef.value.allTime = savedStats.allTime ||
                            [];
                        statsManagerRef.value.lastSaveTime =
                            savedStats.lastSaveTime || Date.now();

                        console.log(
                            "📈 Production stats restored from localStorage:",
                            {
                                bucketCounts: {
                                    tenSeconds:
                                        statsManagerRef.value.tenSeconds
                                            ?.length || "none",
                                    oneMinute:
                                        statsManagerRef.value.oneMinute
                                            ?.length || "none",
                                    tenMinutes:
                                        statsManagerRef.value.tenMinutes
                                            ?.length || "none",
                                    oneHour:
                                        statsManagerRef.value.oneHour?.length ||
                                        "none",
                                    tenHours:
                                        statsManagerRef.value.tenHours
                                            ?.length || "none",
                                    hundredHours:
                                        statsManagerRef.value.hundredHours
                                            ?.length || "none",
                                    allTime:
                                        statsManagerRef.value.allTime?.length ||
                                        "none",
                                },
                            },
                        );
                        console.log(
                            "Restored stats manager tenSeconds sample:",
                            statsManagerRef.value.tenSeconds.slice(0, 3),
                        );

                        // Normalize buckets to ensure complete intervals for smooth charts
                        normalizeBucketsForAllTimeScales(
                            statsManagerRef.value.gameTimeMs,
                        );

                        console.log("🔧 Buckets normalized, final counts:", {
                            bucketCounts: {
                                tenSeconds:
                                    statsManagerRef.value.tenSeconds?.length ||
                                    "none",
                                oneMinute:
                                    statsManagerRef.value.oneMinute?.length ||
                                    "none",
                                tenMinutes:
                                    statsManagerRef.value.tenMinutes?.length ||
                                    "none",
                                oneHour:
                                    statsManagerRef.value.oneHour?.length ||
                                    "none",
                                tenHours:
                                    statsManagerRef.value.tenHours?.length ||
                                    "none",
                                hundredHours:
                                    statsManagerRef.value.hundredHours
                                        ?.length || "none",
                                allTime:
                                    statsManagerRef.value.allTime?.length ||
                                    "none",
                            },
                        });
                    }
                } catch (statsError) {
                    console.error(
                        "Failed to restore production stats, initializing fresh:",
                        statsError,
                    );
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
                console.log(
                    "📈 No production stats found in save data or stats manager not available",
                );
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
            console.log(
                "Calculating offline progress..., offlineTimeMS:",
                offlineTimeMS,
            );
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
            salesManagers: {},
        },
        lastSaved: new Date().toISOString(),
        productionStats: null,
    };
}
