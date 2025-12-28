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
                            priceHistory: [...itemInfo.priceHistory],
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
        const gameData: SavedGameData = {
            userName: userName,
            money: user.money,
            level: user.level,
            experience: user.experience,
            nextLevelExperience: user.nextLevelExperience,
            machines: user.machines,
            inventory: user.inventory,
            lastSaved: new Date().toISOString(),
        };
        localStorage.setItem(`coffeeQueen_${userId}`, JSON.stringify(gameData));
        console.log("Data saved to localStorage");
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
        money: 100,
        level: 1,
        experience: 0,
        nextLevelExperience: 100,
        machines: {},
        inventory: {},
    };
}
