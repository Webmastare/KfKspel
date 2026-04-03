import type { GameSettings, ProductionCalculation } from "./types";

const gameSettings: GameSettings = {
    maxLevel: 500,

    speedMaxMultiplier: 400000,
    speedExponentK: 8,
    speedShapePower: 1.2,
    speedTailGrowthPerLevel: 1.02,

    batchSizeThreshold: [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    batchTimeEfficiency: 0.9,

    efficiencyMaxMultiplier: 20,
    efficiencyExponentK: 2,
    efficiencyShapePower: 1.05,
    efficiencyTailGrowthPerLevel: 1.07,

    speedTimeCurveStartSeconds: 45,
    speedTimeCurveEndSeconds: 600000,
    speedTimeCurveExponentK: 5,
    speedTimeCurveShapePower: 1.5,
    speedTimeCurveTailGrowthPerLevel: 1.008,

    efficiencyTimeCurveStartSeconds: 90,
    efficiencyTimeCurveEndSeconds: 600000000,
    efficiencyTimeCurveExponentK: 10,
    efficiencyTimeCurveShapePower: 1.9,
    efficiencyTimeCurveTailGrowthPerLevel: 1.012,

    speedTargetTimeMultiplier: 1,
    efficiencyTargetTimeMultiplier: 1,

    speedCostReferenceEfficiencyLevel: 0,
    efficiencyCostReferenceSpeedLevel: 0,
    targetAffordabilityFloorFraction: 1,
    minUpgradeTimeSeconds: 10,
    minUpgradeCost: 1,
    upgradeCostFloorFraction: 0,
};

type UpgradeType = "speed" | "efficiency";

function expCurveMultiplier(
    level: number,
    maxLevel: number,
    exponentK: number,
    shapePower: number,
    maxMultiplier: number,
    tailGrowthPerLevel: number,
): number {
    if (level <= 0) {
        return 1;
    }
    const normalized = Math.min(level / maxLevel, 1);

    const numerator = Math.exp(exponentK * Math.pow(normalized, shapePower)) -
        1;
    const denominator = Math.exp(exponentK) - 1;
    const curveProgress = denominator > 0
        ? numerator / denominator
        : normalized;

    let multiplier = 1 + (maxMultiplier - 1) * curveProgress;
    if (level > maxLevel) {
        multiplier *= Math.pow(tailGrowthPerLevel, level - maxLevel);
    }

    return multiplier;
}

/**
 * Calculate batch size based on speed upgrades - doubles at specific thresholds
 */
export function calculateBatchSize(
    initialBatchSize: number,
    speedUpgrade: number,
): number {
    let thresholdsPassedCount = 0;
    for (const threshold of gameSettings.batchSizeThreshold) {
        if (speedUpgrade >= threshold) {
            thresholdsPassedCount++;
        } else {
            break;
        }
    }

    return Math.pow(2, thresholdsPassedCount) * initialBatchSize;
}

/**
 * Speed scales with an exponential level curve and optional post-cap tail growth.
 */
export function calculateSpeedMultiplier(speedUpgrade: number): number {
    return expCurveMultiplier(
        speedUpgrade,
        gameSettings.maxLevel,
        gameSettings.speedExponentK,
        gameSettings.speedShapePower,
        gameSettings.speedMaxMultiplier,
        gameSettings.speedTailGrowthPerLevel,
    );
}

/**
 * Production time in milliseconds.
 */
export function calculateProductionTime(
    initialBatchSize: number,
    speedUpgrade: number,
    baseProductionTimeMs: number,
): number {
    const batchSize = calculateBatchSize(initialBatchSize, speedUpgrade);
    const speedMultiplier = calculateSpeedMultiplier(speedUpgrade);
    const batchTimeMultiplier = Math.pow(
        batchSize / initialBatchSize,
        gameSettings.batchTimeEfficiency,
    );
    return (baseProductionTimeMs * batchTimeMultiplier) / speedMultiplier;
}

/**
 * Additive efficiency bonus where 0.25 means +25% output.
 */
export function calculateEfficiencyBonus(efficiencyUpgrade: number): number {
    const multiplier = expCurveMultiplier(
        efficiencyUpgrade,
        gameSettings.maxLevel,
        gameSettings.efficiencyExponentK,
        gameSettings.efficiencyShapePower,
        gameSettings.efficiencyMaxMultiplier,
        gameSettings.efficiencyTailGrowthPerLevel,
    );
    return Math.max(0, multiplier - 1);
}

export function calculateItemsPerSecond(
    initialBatchSize: number,
    speedUpgrade: number,
    efficiencyUpgrade: number,
    baseProductionTimeMs: number,
): number {
    const batchSize = calculateBatchSize(initialBatchSize, speedUpgrade);
    const productionTimeMs = calculateProductionTime(
        initialBatchSize,
        speedUpgrade,
        baseProductionTimeMs,
    );

    if (productionTimeMs <= 0) {
        return 0;
    }

    const baseItemsPerSecond = batchSize / (productionTimeMs / 1000);
    return baseItemsPerSecond *
        (1 + calculateEfficiencyBonus(efficiencyUpgrade));
}

export function calculateTargetUpgradeTimeSeconds(
    nextLevel: number,
    upgradeType: UpgradeType = "speed",
): number {
    const maxLevel = Math.max(1, Math.floor(gameSettings.maxLevel));
    const normalized = Math.min(nextLevel / maxLevel, 1);

    const isEfficiency = upgradeType === "efficiency";
    const exponentK = isEfficiency
        ? gameSettings.efficiencyTimeCurveExponentK
        : gameSettings.speedTimeCurveExponentK;
    const shapePower = isEfficiency
        ? gameSettings.efficiencyTimeCurveShapePower
        : gameSettings.speedTimeCurveShapePower;
    const startSeconds = isEfficiency
        ? gameSettings.efficiencyTimeCurveStartSeconds
        : gameSettings.speedTimeCurveStartSeconds;
    const endSeconds = isEfficiency
        ? gameSettings.efficiencyTimeCurveEndSeconds
        : gameSettings.speedTimeCurveEndSeconds;

    const numerator = Math.exp(exponentK * Math.pow(normalized, shapePower)) -
        1;
    const denominator = Math.exp(exponentK) - 1;
    const curveProgress = denominator > 0
        ? numerator / denominator
        : normalized;

    let targetSeconds = startSeconds +
        (endSeconds - startSeconds) * curveProgress;

    const tailGrowth = isEfficiency
        ? gameSettings.efficiencyTimeCurveTailGrowthPerLevel
        : gameSettings.speedTimeCurveTailGrowthPerLevel;
    if (nextLevel > maxLevel) {
        targetSeconds *= Math.pow(tailGrowth, nextLevel - maxLevel);
    }

    targetSeconds *= isEfficiency
        ? gameSettings.efficiencyTargetTimeMultiplier
        : gameSettings.speedTargetTimeMultiplier;

    if (
        upgradeType === "speed" &&
        gameSettings.batchSizeThreshold.includes(nextLevel)
    ) {
        targetSeconds *= gameSettings.batchTimeEfficiency;
    }

    return Math.max(gameSettings.minUpgradeTimeSeconds, targetSeconds);
}

/**
 * Calculate items produced per second with the new advanced system
 * Returns: { itemsPerSecond, batchSize, productionTime }
 */
export function calculateProduction(
    initialBatchSize: number,
    speedUpgrade: number,
    efficiencyUpgrade: number,
    baseProductionTimeMs: number,
): ProductionCalculation {
    const batchSize = calculateBatchSize(initialBatchSize, speedUpgrade);
    const productionTime = calculateProductionTime(
        initialBatchSize,
        speedUpgrade,
        baseProductionTimeMs,
    );
    const totalItemsPerSecond = calculateItemsPerSecond(
        initialBatchSize,
        speedUpgrade,
        efficiencyUpgrade,
        baseProductionTimeMs,
    );

    return {
        itemsPerSecond: totalItemsPerSecond,
        batchSize,
        productionTime,
    };
}

/**
 * Deterministic speed upgrade cost.
 * Efficiency level is intentionally held at the configured reference level.
 */
export function calculateSpeedUpgradeCost(
    baseCost: number,
    currentSpeedUpgrade: number,
    initialBatchSize = 1,
    currentEfficiencyUpgrade = gameSettings.speedCostReferenceEfficiencyLevel,
    baseProductionTimeMs = 10000,
    itemValueMultiplier = 1,
): number {
    const pricingEfficiencyLevel =
        gameSettings.speedCostReferenceEfficiencyLevel;
    void currentEfficiencyUpgrade;

    const currentIps = calculateItemsPerSecond(
        initialBatchSize,
        currentSpeedUpgrade,
        pricingEfficiencyLevel,
        baseProductionTimeMs,
    );

    const nextIps = calculateItemsPerSecond(
        initialBatchSize,
        currentSpeedUpgrade + 1,
        pricingEfficiencyLevel,
        baseProductionTimeMs,
    );

    const deltaIncomePerSecond = (nextIps - currentIps) *
        Math.max(0, itemValueMultiplier);
    if (deltaIncomePerSecond <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    const targetSeconds = calculateTargetUpgradeTimeSeconds(
        currentSpeedUpgrade + 1,
        "speed",
    );
    const paybackCost = targetSeconds * deltaIncomePerSecond;

    const currentIncomePerSecond = currentIps *
        Math.max(0, itemValueMultiplier);
    const affordabilityFloorCost = targetSeconds * currentIncomePerSecond *
        gameSettings.targetAffordabilityFloorFraction;

    const floorCost = Math.max(
        gameSettings.minUpgradeCost,
        baseCost * gameSettings.upgradeCostFloorFraction,
    );

    return Math.ceil(Math.max(paybackCost, affordabilityFloorCost, floorCost));
}

/**
 * Deterministic efficiency upgrade cost.
 * Speed level is intentionally held at the configured reference level.
 */
export function calculateEfficiencyUpgradeCost(
    baseCost: number,
    currentEfficiencyUpgrade: number,
    initialBatchSize = 1,
    currentSpeedUpgrade = gameSettings.efficiencyCostReferenceSpeedLevel,
    baseProductionTimeMs = 10000,
    itemValueMultiplier = 1,
): number {
    const pricingSpeedLevel = gameSettings.efficiencyCostReferenceSpeedLevel;
    void currentSpeedUpgrade;

    const currentIps = calculateItemsPerSecond(
        initialBatchSize,
        pricingSpeedLevel,
        currentEfficiencyUpgrade,
        baseProductionTimeMs,
    );
    const nextIps = calculateItemsPerSecond(
        initialBatchSize,
        pricingSpeedLevel,
        currentEfficiencyUpgrade + 1,
        baseProductionTimeMs,
    );

    const deltaIncomePerSecond = (nextIps - currentIps) *
        Math.max(0, itemValueMultiplier);
    if (deltaIncomePerSecond <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    const targetSeconds = calculateTargetUpgradeTimeSeconds(
        currentEfficiencyUpgrade + 1,
        "efficiency",
    );

    const paybackCost = targetSeconds * deltaIncomePerSecond;
    const currentIncomePerSecond = currentIps *
        Math.max(0, itemValueMultiplier);
    const affordabilityFloorCost = targetSeconds * currentIncomePerSecond *
        gameSettings.targetAffordabilityFloorFraction;

    const floorCost = Math.max(
        gameSettings.minUpgradeCost,
        baseCost * gameSettings.upgradeCostFloorFraction,
    );

    return Math.ceil(Math.max(paybackCost, affordabilityFloorCost, floorCost));
}

export function calculateBulkUpgradeCost(
    baseCost: number,
    currentLevel: number,
    upgradesToBuy: number,
    upgradeType: UpgradeType = "speed",
    initialBatchSize = 1,
    baseProductionTimeMs = 10000,
    itemValueMultiplier = 1,
): number {
    let total = 0;

    for (let i = 0; i < upgradesToBuy; i++) {
        const level = currentLevel + i;
        const stepCost = upgradeType === "speed"
            ? calculateSpeedUpgradeCost(
                baseCost,
                level,
                initialBatchSize,
                gameSettings.speedCostReferenceEfficiencyLevel,
                baseProductionTimeMs,
                itemValueMultiplier,
            )
            : calculateEfficiencyUpgradeCost(
                baseCost,
                level,
                initialBatchSize,
                gameSettings.efficiencyCostReferenceSpeedLevel,
                baseProductionTimeMs,
                itemValueMultiplier,
            );

        if (!Number.isFinite(stepCost)) {
            return Number.POSITIVE_INFINITY;
        }

        total += stepCost;
        if (!Number.isFinite(total)) {
            return Number.POSITIVE_INFINITY;
        }
    }

    return total;
}

export { gameSettings };
