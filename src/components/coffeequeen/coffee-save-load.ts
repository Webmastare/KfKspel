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
import {
    clampSpeedupBuffer,
    createDefaultSpeedupBufferState,
    refillSpeedupBuffer,
} from "./speedup-buffer";

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
export function simulateOfflineProgress(
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

interface SaveIndexEntry {
    id: string;
    name: string;
    lastSaved: string;
}

interface SaveIndex {
    version: 1;
    saves: SaveIndexEntry[];
}

const KFKBRYGG_SAVE_PREFIX = "kfkbrygg_save_";
const KFKBRYGG_INDEX_KEY = "kfkbrygg_saves_index_v1";
const KFKBRYGG_ACTIVE_SAVE_KEY = "kfkbrygg_active_save_id";

const LEGACY_COFFEEQUEEN_PREFIX = "coffeeQueen_";

/**
 * Saves the current game state to localStorage.
 */
export function saveToLocalStorage(
    user: User,
    saveId: string,
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
            saveId,
            money: user.money,
            level: user.level,
            experience: user.experience,
            nextLevelExperience: user.nextLevelExperience,
            machines: user.machines,
            inventory: user.inventory,
            upgrades: user.upgrades,
            speedupBuffer: clampSpeedupBuffer(
                user.speedupBuffer || createDefaultSpeedupBufferState(),
            ),
            productionStats: productionStats,
            lastSaved: new Date().toISOString(),
            lastActiveAt: user.lastActiveAt || user.lastSaved ||
                new Date().toISOString(),
        };
        localStorage.setItem(
            getSaveStorageKey(saveId),
            JSON.stringify(gameData),
        );
        updateSaveIndex(saveId, userName, gameData.lastSaved);
        setActiveSaveId(saveId);
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
    saveId: string,
    machinesConfig: Record<MachineKey, MachineConfig>,
    itemData: Record<ItemKey, ItemData>,
): LoadGameResult | null {
    try {
        const key = resolveSaveStorageKey(saveId);
        const savedData = key ? localStorage.getItem(key) : null;
        if (savedData) {
            const gameData: SavedGameData = JSON.parse(savedData);
            gameData.saveId = saveId;

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

            if (!gameData.speedupBuffer) {
                gameData.speedupBuffer = createDefaultSpeedupBufferState();
            } else {
                gameData.speedupBuffer = clampSpeedupBuffer(
                    gameData.speedupBuffer,
                );
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
                                    tenSeconds: statsManagerRef.value.tenSeconds
                                        ?.length || "none",
                                    oneMinute: statsManagerRef.value.oneMinute
                                        ?.length || "none",
                                    tenMinutes: statsManagerRef.value.tenMinutes
                                        ?.length || "none",
                                    oneHour:
                                        statsManagerRef.value.oneHour?.length ||
                                        "none",
                                    tenHours: statsManagerRef.value.tenHours
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
                                hundredHours: statsManagerRef.value.hundredHours
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
            const activityAnchor = new Date(
                gameData.lastActiveAt || gameData.lastSaved || now,
            );
            let offlineTimeMS = now.getTime() - activityAnchor.getTime();

            // Cap offline simulation to 1 hour (3,600,000 ms)
            const maxIdleTimeMS = 3600 * 1000;
            if (offlineTimeMS < 0 || Number.isNaN(offlineTimeMS)) {
                offlineTimeMS = 0;
            }

            const simulatedOfflineTimeMS = Math.min(
                offlineTimeMS,
                maxIdleTimeMS,
            );

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
                    simulatedOfflineTimeMS,
                );
                offlineProductionSummary = result.productionSummary;
                offlineExperienceGained = result.totalExperienceGained;
            }

            const refillResult = refillSpeedupBuffer(
                gameData.speedupBuffer,
                offlineTimeMS / 1000,
                gameData.speedupBuffer.offlineRefillIntervalSeconds,
            );
            gameData.speedupBuffer = clampSpeedupBuffer(refillResult.nextState);

            return {
                gameData,
                offlineTimeMS,
                simulatedOfflineTimeMS,
                offlineProductionSummary,
                offlineExperienceGained,
                offlineSpeedupRefilledSeconds: refillResult.addedSeconds,
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
    const index = readSaveIndex();
    const allItems: SavedGameData[] = [];

    for (const entry of index.saves) {
        const key = getSaveStorageKey(entry.id);
        try {
            const savedData = localStorage.getItem(key);
            if (!savedData) continue;

            const gameData: SavedGameData = JSON.parse(savedData);
            gameData.itemKey = entry.id;
            gameData.saveId = entry.id;
            gameData.userName = entry.name || gameData.userName || "Guest";
            allItems.push(gameData);
        } catch (error) {
            console.error(
                `Failed to parse saved data for key: ${key}`,
                error,
            );
        }
    }

    return allItems.sort((a, b) => {
        const aTime = Date.parse(a.lastSaved || "") || 0;
        const bTime = Date.parse(b.lastSaved || "") || 0;
        return bTime - aTime;
    });
}

export function initializeKfKbryggSaveSystem(
    defaultSaveName = "Guest",
): string {
    migrateLegacyCoffeeQueenSavesToKfKbrygg();

    const index = readSaveIndex();
    if (index.saves.length === 0) {
        const saveId = createSaveId();
        const user = createNewUser();
        saveToLocalStorage(user, saveId, normalizeSaveName(defaultSaveName));
        return saveId;
    }

    const active = getActiveSaveId();
    const activeExists = active &&
        index.saves.some((save) => save.id === active);
    if (active && activeExists) {
        return active;
    }

    const firstSave = index.saves[0];
    if (firstSave) {
        setActiveSaveId(firstSave.id);
        return firstSave.id;
    }

    const fallbackSaveId = createSaveId();
    saveToLocalStorage(
        createNewUser(),
        fallbackSaveId,
        normalizeSaveName(defaultSaveName),
    );
    return fallbackSaveId;
}

export function createNewLocalSave(saveName: string): string {
    const saveId = createSaveId();
    saveToLocalStorage(createNewUser(), saveId, normalizeSaveName(saveName));
    return saveId;
}

export function renameLocalSave(saveId: string, newName: string): boolean {
    const normalized = normalizeSaveName(newName);
    const index = readSaveIndex();
    const target = index.saves.find((save) => save.id === saveId);
    if (!target) return false;

    target.name = normalized;
    writeSaveIndex(index);

    const key = getSaveStorageKey(saveId);
    const raw = localStorage.getItem(key);
    if (raw) {
        try {
            const gameData: SavedGameData = JSON.parse(raw);
            gameData.userName = normalized;
            gameData.saveId = saveId;
            localStorage.setItem(key, JSON.stringify(gameData));
        } catch (error) {
            console.error("Failed to rename save payload:", error);
        }
    }

    return true;
}

export function deleteLocalSave(saveId: string): void {
    const key = getSaveStorageKey(saveId);
    localStorage.removeItem(key);

    const index = readSaveIndex();
    index.saves = index.saves.filter((save) => save.id !== saveId);
    writeSaveIndex(index);

    const active = getActiveSaveId();
    if (active === saveId) {
        if (index.saves[0]) {
            setActiveSaveId(index.saves[0].id);
        } else {
            localStorage.removeItem(KFKBRYGG_ACTIVE_SAVE_KEY);
        }
    }
}

export function getActiveSaveId(): string | null {
    return localStorage.getItem(KFKBRYGG_ACTIVE_SAVE_KEY);
}

export function setActiveSaveId(saveId: string): void {
    localStorage.setItem(KFKBRYGG_ACTIVE_SAVE_KEY, saveId);
}

/**
 * Legacy migration block:
 * Moves old coffeeQueen_* save keys to the new kfkbrygg save-slot format,
 * updates the index, and removes old keys after successful migration.
 */
export function migrateLegacyCoffeeQueenSavesToKfKbrygg(): void {
    const index = readSaveIndex();
    const legacyKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LEGACY_COFFEEQUEEN_PREFIX)) {
            legacyKeys.push(key);
        }
    }

    if (legacyKeys.length === 0) {
        return;
    }

    for (const legacyKey of legacyKeys) {
        const raw = localStorage.getItem(legacyKey);
        if (!raw) continue;

        try {
            const gameData: SavedGameData = JSON.parse(raw);
            const legacyId =
                legacyKey.slice(LEGACY_COFFEEQUEEN_PREFIX.length) || "legacy";

            let newSaveId = `legacy_${slugifyId(legacyId)}`;
            while (
                localStorage.getItem(getSaveStorageKey(newSaveId)) ||
                index.saves.some((save) => save.id === newSaveId)
            ) {
                newSaveId = `${newSaveId}_${Math.floor(Math.random() * 1000)}`;
            }

            const migratedName = normalizeSaveName(
                gameData.userName || `Migrated ${legacyId}`,
            );
            gameData.userName = migratedName;
            gameData.saveId = newSaveId;

            localStorage.setItem(
                getSaveStorageKey(newSaveId),
                JSON.stringify(gameData),
            );
            index.saves.push({
                id: newSaveId,
                name: migratedName,
                lastSaved: gameData.lastSaved || new Date().toISOString(),
            });

            if (!getActiveSaveId() && legacyId === "guest") {
                setActiveSaveId(newSaveId);
            }

            // Remove old key once migrated.
            localStorage.removeItem(legacyKey);
        } catch (error) {
            console.error(
                `Failed to migrate legacy save key ${legacyKey}:`,
                error,
            );
        }
    }

    writeSaveIndex(index);
}

function readSaveIndex(): SaveIndex {
    const raw = localStorage.getItem(KFKBRYGG_INDEX_KEY);
    if (!raw) {
        return { version: 1, saves: [] };
    }

    try {
        const parsed = JSON.parse(raw) as SaveIndex;
        if (!parsed || !Array.isArray(parsed.saves)) {
            return { version: 1, saves: [] };
        }
        return { version: 1, saves: parsed.saves };
    } catch {
        return { version: 1, saves: [] };
    }
}

function writeSaveIndex(index: SaveIndex): void {
    localStorage.setItem(KFKBRYGG_INDEX_KEY, JSON.stringify(index));
}

function updateSaveIndex(
    saveId: string,
    name: string,
    lastSaved: string,
): void {
    const index = readSaveIndex();
    const existing = index.saves.find((save) => save.id === saveId);
    if (existing) {
        existing.name = normalizeSaveName(name);
        existing.lastSaved = lastSaved;
    } else {
        index.saves.push({
            id: saveId,
            name: normalizeSaveName(name),
            lastSaved,
        });
    }
    writeSaveIndex(index);
}

function resolveSaveStorageKey(saveIdOrKey: string): string | null {
    if (!saveIdOrKey) return null;
    if (saveIdOrKey.startsWith(KFKBRYGG_SAVE_PREFIX)) {
        return saveIdOrKey;
    }
    const key = getSaveStorageKey(saveIdOrKey);
    return key;
}

function getSaveStorageKey(saveId: string): string {
    return `${KFKBRYGG_SAVE_PREFIX}${saveId}`;
}

function createSaveId(): string {
    return `save_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function normalizeSaveName(name: string): string {
    const trimmed = (name || "").trim();
    return trimmed.length > 0 ? trimmed.slice(0, 40) : "Guest";
}

function slugifyId(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return slug || "legacy";
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
        speedupBuffer: createDefaultSpeedupBufferState(),
        lastSaved: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        productionStats: null,
    };
}
