import type { ItemData, ItemKey, MachineConfig, UserMachine } from "./types";
import {
    calculateBatchSize,
    calculateEfficiencyUpgradeCost,
    calculateProductionTime,
    calculateSpeedUpgradeCost,
} from "./coffee-upgrade-calculations";
import { gameSettings } from "./coffee-upgrade-calculations";

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
