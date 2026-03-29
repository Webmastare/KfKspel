import type {
    ItemData,
    ItemKey,
    MachineConfig,
    MachineKey,
    User,
} from "./types";
import {
    calculateBatchSize,
    calculateEfficiencyBonus,
} from "./coffee-upgrade-calculations";
import {
    calculateInventoryMultiplier,
    getSalesManagerLevelConfig,
} from "./data-upgrades";

export interface SimulationHooks {
    onProduced?: (payload: {
        itemKey: ItemKey;
        amount: number;
        source: "regular" | "bonus";
    }) => void;
    onItemsLostToCapacity?: (payload: {
        itemKey: ItemKey;
        amount: number;
        source: "regular" | "bonus";
    }) => void;
    onManagerSell?: (payload: {
        itemKey: ItemKey;
        items: number;
        money: number;
    }) => void;
    onManagerBuy?: (payload: {
        itemKey: ItemKey;
        items: number;
        money: number;
    }) => void;
}

export interface SimulationOptions {
    skipManualMachines?: boolean;
    nowMs?: number;
    hooks?: SimulationHooks;
}

export interface SimulationResult {
    didChangeState: boolean;
    experienceGained: number;
}

export function simulateGameStep(
    user: User,
    machinesConfig: Record<MachineKey, MachineConfig>,
    itemData: Record<ItemKey, ItemData>,
    deltaTimeMS: number,
    options: SimulationOptions = {},
): SimulationResult {
    if (deltaTimeMS <= 0) {
        return { didChangeState: false, experienceGained: 0 };
    }

    const skipManualMachines = options.skipManualMachines ?? false;
    const hooks = options.hooks;
    const nowMs = options.nowMs ?? Date.now();

    let didChangeState = false;
    let experienceGained = 0;

    for (const machineKey in user.machines) {
        const machine = user.machines[machineKey];
        const machineConf = machinesConfig[machineKey as MachineKey];

        if (!machine || !machine.isOwned || !machineConf) continue;
        if (skipManualMachines && machine.isManual) continue;
        if (machine.isManual && !machine.isRunning) continue;

        if (!machine.isActive) {
            const batchSize = machine.batchSize ||
                calculateBatchSize(
                    machineConf.baseBatchSize,
                    machine.speedUpgrade,
                );
            const usesItemKey = machineConf.uses as ItemKey;
            const usesInventory = usesItemKey
                ? user.inventory[usesItemKey]
                : null;
            const availableAmount = usesInventory?.amount || 0;
            const hasEnoughInputs = usesInventory
                ? availableAmount >= batchSize
                : true;

            const producesItemKey = machineConf.produces as ItemKey;
            const outputInventory = ensureInventoryItem(
                user,
                itemData,
                producesItemKey,
            );
            const hasInventorySpace =
                outputInventory.amount + batchSize <= outputInventory.capacity;

            if (hasEnoughInputs && hasInventorySpace) {
                machine.isActive = true;
            } else {
                continue;
            }
        }

        const progressPerMS = 1 / machine.productionTime;
        const progressThisFrame = deltaTimeMS * progressPerMS;
        machine.progressPercent += progressThisFrame;

        if (machine.efficiencyUpgrade > 0) {
            const totalEfficiencyBonus = calculateEfficiencyBonus(
                machine.efficiencyUpgrade,
            );
            const efficiencyGainThisFrame = totalEfficiencyBonus *
                progressThisFrame;
            machine.efficiencyProgress += efficiencyGainThisFrame;

            if (machine.efficiencyProgress >= 1) {
                const numberOfBonusItems =
                    Math.floor(machine.efficiencyProgress) * machine.batchSize;
                const producesItemKey = machineConf.produces as ItemKey;
                const inventoryItem = ensureInventoryItem(
                    user,
                    itemData,
                    producesItemKey,
                );

                const availableSpace = inventoryItem.capacity -
                    inventoryItem.amount;
                const itemsToAdd = Math.min(numberOfBonusItems, availableSpace);
                const itemsLost = numberOfBonusItems - itemsToAdd;

                if (itemsToAdd > 0) {
                    inventoryItem.amount += itemsToAdd;
                    machine.itemsProduced += itemsToAdd;
                    machine.bonusItems += itemsToAdd;
                    didChangeState = true;
                    hooks?.onProduced?.({
                        itemKey: producesItemKey,
                        amount: itemsToAdd,
                        source: "bonus",
                    });
                }

                if (itemsLost > 0) {
                    hooks?.onItemsLostToCapacity?.({
                        itemKey: producesItemKey,
                        amount: itemsLost,
                        source: "bonus",
                    });
                }

                if (
                    itemsToAdd < numberOfBonusItems ||
                    inventoryItem.amount >= inventoryItem.capacity
                ) {
                    machine.isActive = false;
                    machine.isRunning = false;
                }

                machine.efficiencyProgress -= Math.floor(
                    machine.efficiencyProgress,
                );
            }
        }

        let cycleGuard = 0;
        while (machine.progressPercent >= 1 && cycleGuard < 1000) {
            cycleGuard += 1;

            const batchSize = machine.batchSize || 1;
            const producesItemKey = machineConf.produces as ItemKey;
            const inventoryItem = ensureInventoryItem(
                user,
                itemData,
                producesItemKey,
            );

            const availableSpace = inventoryItem.capacity -
                inventoryItem.amount;
            const itemsToAdd = Math.min(batchSize, availableSpace);
            const itemsLost = batchSize - itemsToAdd;

            if (itemsToAdd > 0) {
                inventoryItem.amount += itemsToAdd;
                machine.itemsProduced += itemsToAdd;
                didChangeState = true;
                hooks?.onProduced?.({
                    itemKey: producesItemKey,
                    amount: itemsToAdd,
                    source: "regular",
                });
            }

            if (itemsLost > 0) {
                hooks?.onItemsLostToCapacity?.({
                    itemKey: producesItemKey,
                    amount: itemsLost,
                    source: "regular",
                });
            }

            if (
                itemsToAdd < batchSize ||
                inventoryItem.amount >= inventoryItem.capacity
            ) {
                machine.isActive = false;
                machine.isRunning = false;
            }

            user.experience += batchSize;
            experienceGained += batchSize;
            didChangeState = true;

            while (user.experience >= user.nextLevelExperience) {
                user.level += 1;
                user.experience -= user.nextLevelExperience;
                user.nextLevelExperience = Math.ceil(
                    user.nextLevelExperience * 1.2,
                );
            }

            const usesItemKey = machineConf.uses as ItemKey;
            const usesInventory = usesItemKey
                ? user.inventory[usesItemKey]
                : null;
            const availableAmount = usesInventory?.amount || 0;
            let canProduce = true;

            if (availableAmount >= batchSize) {
                if (usesInventory) {
                    usesInventory.amount -= batchSize;
                    didChangeState = true;
                }
            } else if (machineConf.uses != null && machineConf.uses !== "") {
                canProduce = false;
            }

            if (machine.isManual) {
                machine.isRunning = false;
                machine.isActive = false;
            } else if (!canProduce) {
                machine.isActive = false;
            }

            machine.progressPercent -= 1;
            if (!machine.isActive) {
                machine.progressPercent = 0;
                break;
            }
        }
    }

    const salesManagersChanged = processSalesManagers(
        user,
        deltaTimeMS,
        nowMs,
        hooks,
    );
    if (salesManagersChanged) {
        didChangeState = true;
    }

    return { didChangeState, experienceGained };
}

function processSalesManagers(
    user: User,
    deltaTimeMS: number,
    nowMs: number,
    hooks?: SimulationHooks,
): boolean {
    if (!user.upgrades.salesManagers) return false;

    let changed = false;

    for (const itemKey in user.upgrades.salesManagers) {
        const manager = user.upgrades.salesManagers[itemKey as ItemKey];
        if (!manager || manager.level === 0) continue;

        const inventoryItem = user.inventory[itemKey as ItemKey];
        if (!inventoryItem) continue;

        const levelConfig = getSalesManagerLevelConfig(manager.level);
        if (!levelConfig) continue;

        if (manager.settings.autoSellEnabled && levelConfig.features.canSell) {
            const sellThreshold = manager.settings.sellThreshold ||
                (manager.level === 1 ? 90 : 80);
            const currentPercentage =
                (inventoryItem.amount / inventoryItem.capacity) * 100;

            if (
                currentPercentage >= sellThreshold && inventoryItem.amount > 0
            ) {
                const itemsAboveThreshold = inventoryItem.amount -
                    Math.floor((sellThreshold / 100) * inventoryItem.capacity);

                if (levelConfig.sellRate === -1) {
                    manager.partialItemsToSell += itemsAboveThreshold;
                } else {
                    manager.partialItemsToSell +=
                        (levelConfig.sellRate * deltaTimeMS) / 1000;
                }

                const itemsToSell = Math.floor(manager.partialItemsToSell);
                if (itemsToSell > 0) {
                    const actualItemsToSell = Math.min(
                        itemsToSell,
                        itemsAboveThreshold,
                        inventoryItem.amount,
                    );

                    if (actualItemsToSell > 0) {
                        const sellPrice = inventoryItem.basePrice *
                            inventoryItem.sellMultiplier;
                        const totalEarned = actualItemsToSell * sellPrice;

                        inventoryItem.amount -= actualItemsToSell;
                        user.money += totalEarned;

                        manager.statistics.totalItemsSold += actualItemsToSell;
                        manager.statistics.totalMoneyEarned += totalEarned;
                        manager.statistics.lastActionTime = nowMs;

                        manager.partialItemsToSell = Math.max(
                            0,
                            Math.min(
                                1,
                                manager.partialItemsToSell - actualItemsToSell,
                            ),
                        );

                        changed = true;
                        hooks?.onManagerSell?.({
                            itemKey: itemKey as ItemKey,
                            items: actualItemsToSell,
                            money: totalEarned,
                        });
                    }
                }
            }
        }

        if (
            manager.settings.autoBuyEnabled && levelConfig.features.canBuy &&
            manager.level >= 3
        ) {
            const buyThreshold = manager.settings.buyThreshold || 10;
            const currentPercentage =
                (inventoryItem.amount / inventoryItem.capacity) * 100;

            if (
                currentPercentage <= buyThreshold &&
                inventoryItem.amount < inventoryItem.capacity
            ) {
                const buyPrice = inventoryItem.cost;
                const availableSpace = inventoryItem.capacity -
                    inventoryItem.amount;

                if (levelConfig.sellRate === -1) {
                    manager.partialItemsToBuy += (1000 * deltaTimeMS) / 1000;
                } else {
                    manager.partialItemsToBuy +=
                        (levelConfig.sellRate * deltaTimeMS) / 1000;
                }

                const itemsToBuy = Math.floor(manager.partialItemsToBuy);
                if (itemsToBuy > 0) {
                    const maxAffordable = Math.floor(user.money / buyPrice);
                    const spaceBelowThreshold = Math.max(
                        0,
                        Math.floor(
                            (buyThreshold / 100) * inventoryItem.capacity,
                        ) - inventoryItem.amount,
                    );
                    const actualItemsToBuy = Math.min(
                        itemsToBuy,
                        maxAffordable,
                        availableSpace,
                        spaceBelowThreshold,
                    );

                    if (
                        actualItemsToBuy > 0 &&
                        user.money >= buyPrice * actualItemsToBuy
                    ) {
                        const totalCost = actualItemsToBuy * buyPrice;

                        inventoryItem.amount += actualItemsToBuy;
                        user.money -= totalCost;

                        manager.statistics.totalItemsBought += actualItemsToBuy;
                        manager.statistics.totalMoneySpent += totalCost;
                        manager.statistics.lastActionTime = nowMs;

                        manager.partialItemsToBuy -= actualItemsToBuy;

                        changed = true;
                        hooks?.onManagerBuy?.({
                            itemKey: itemKey as ItemKey,
                            items: actualItemsToBuy,
                            money: totalCost,
                        });
                    }
                }
            }
        }
    }

    return changed;
}

function ensureInventoryItem(
    user: User,
    itemData: Record<ItemKey, ItemData>,
    itemKey: ItemKey,
) {
    let inventoryItem = user.inventory[itemKey];
    if (inventoryItem) {
        return inventoryItem;
    }

    const itemInfo = itemData[itemKey];
    const inventoryMultiplier = calculateInventoryMultiplier(
        user.upgrades.inventory,
    );

    user.inventory[itemKey] = {
        name: itemInfo.name,
        icon: itemInfo.icon,
        amount: 0,
        cost: itemInfo.cost,
        basePrice: itemInfo.basePrice,
        sellMultiplier: itemInfo.sellMultiplier,
        capacity: Math.floor(itemInfo.defaultCapacity * inventoryMultiplier),
    };

    return user.inventory[itemKey];
}
