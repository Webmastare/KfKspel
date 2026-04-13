import type { ItemData, ItemKey, MachineConfig, UserMachine } from "./types";
import {
    calculateBatchSize,
    calculateBulkUpgradeCost,
    calculateEfficiencyUpgradeCost,
    calculateProductionTime,
    calculateSpeedUpgradeCost,
} from "./coffee-upgrade-calculations";
import { gameSettings } from "./coffee-upgrade-calculations";

export type UpgradeType = "speed" | "efficiency";
export type UpgradeBulkAmount = number | "Max";

export interface UpgradePurchasePlan {
    count: number;
    totalCost: number;
}

export function getMachineItemValueMultiplier(
    machineConfig: MachineConfig,
    itemData: Record<ItemKey, ItemData>,
): number {
    const producedItem = itemData[machineConfig.produces as ItemKey];
    if (!producedItem) {
        return 1;
    }

    return Math.max(0, producedItem.cost * producedItem.sellMultiplier);
}

export function refreshMachineDerivedValues(
    machine: UserMachine,
    machineConfig: MachineConfig,
    itemData: Record<ItemKey, ItemData>,
): void {
    machine.baseBatchSize = machine.baseBatchSize ??
        machineConfig.baseBatchSize;
    machine.speedUpgrade = machine.speedUpgrade ?? 0;
    machine.efficiencyUpgrade = machine.efficiencyUpgrade ?? 0;

    machine.batchSize = calculateBatchSize(
        machine.baseBatchSize,
        machine.speedUpgrade,
    );

    machine.productionTime = calculateProductionTime(
        machine.baseBatchSize,
        machine.speedUpgrade,
        machineConfig.productionTime,
    );

    const itemValueMultiplier = getMachineItemValueMultiplier(
        machineConfig,
        itemData,
    );

    machine.speedUpgradeCost = calculateSpeedUpgradeCost(
        machine.cost,
        machine.speedUpgrade,
        machine.baseBatchSize,
        gameSettings.speedCostReferenceEfficiencyLevel,
        machineConfig.productionTime,
        itemValueMultiplier,
    );

    machine.efficiencyUpgradeCost = calculateEfficiencyUpgradeCost(
        machine.cost,
        machine.efficiencyUpgrade,
        machine.baseBatchSize,
        gameSettings.efficiencyCostReferenceSpeedLevel,
        machineConfig.productionTime,
        itemValueMultiplier,
    );
}

export function getUpgradePurchasePlan(
    machine: UserMachine,
    machineConfig: MachineConfig,
    itemData: Record<ItemKey, ItemData>,
    upgradeType: UpgradeType,
    requestedAmount: UpgradeBulkAmount,
    availableMoney: number,
): UpgradePurchasePlan {
    if (!Number.isFinite(availableMoney) || availableMoney <= 0) {
        return { count: 0, totalCost: 0 };
    }

    const maxRequested = requestedAmount === "Max"
        ? Number.POSITIVE_INFINITY
        : Math.max(0, Math.floor(requestedAmount));

    if (maxRequested <= 0) {
        return { count: 0, totalCost: 0 };
    }

    const itemValueMultiplier = getMachineItemValueMultiplier(
        machineConfig,
        itemData,
    );

    let low = 0;
    let high = maxRequested === Number.POSITIVE_INFINITY ? 1 : maxRequested;

    // Expand search window until cost exceeds budget (for Max mode).
    if (maxRequested === Number.POSITIVE_INFINITY) {
        while (high < 1_000_000) {
            const cost = calculateBulkUpgradeCost(
                machine.cost,
                upgradeType === "speed"
                    ? machine.speedUpgrade
                    : machine.efficiencyUpgrade,
                high,
                upgradeType,
                machine.baseBatchSize,
                machineConfig.productionTime,
                itemValueMultiplier,
            );
            if (!Number.isFinite(cost) || cost > availableMoney) {
                break;
            }
            low = high;
            high *= 2;
        }
    }

    // Binary search the highest affordable amount.
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const cost = calculateBulkUpgradeCost(
            machine.cost,
            upgradeType === "speed"
                ? machine.speedUpgrade
                : machine.efficiencyUpgrade,
            mid,
            upgradeType,
            machine.baseBatchSize,
            machineConfig.productionTime,
            itemValueMultiplier,
        );

        if (Number.isFinite(cost) && cost <= availableMoney) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }

    const count = low;
    if (count <= 0) {
        return { count: 0, totalCost: 0 };
    }

    const totalCost = calculateBulkUpgradeCost(
        machine.cost,
        upgradeType === "speed"
            ? machine.speedUpgrade
            : machine.efficiencyUpgrade,
        count,
        upgradeType,
        machine.baseBatchSize,
        machineConfig.productionTime,
        itemValueMultiplier,
    );

    if (!Number.isFinite(totalCost)) {
        return { count: 0, totalCost: 0 };
    }

    return {
        count,
        totalCost,
    };
}
