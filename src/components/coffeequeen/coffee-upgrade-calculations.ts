import type { GameSettings, ProductionCalculation } from "./types";

const gameSettings: GameSettings = {
    // Speed upgrade parameters
    speedBaseMultiplier: 0.4, // Much more modest early game boost
    speedDiminishingFactor: 0.5, // Stronger diminishing returns
    speedIncrement: 1.037, // Incremental speed improvement per upgrade
    batchSizeThreshold: [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500], // Every X upgrades, batch size doubles

    // Efficiency parameters
    efficiencyPerUnit: 0.1, // x% efficiency bonus per upgrade
    efficiencyDiminishingFactor: 0.5, // Diminishing returns factor for efficiency

    // Cost scaling
    speedCostBase: 1.035, // Base cost multiplier for speed
    speedCostAcceleration: 1.01, // Cost acceleration factor for speed
    efficiencyCostBase: 1.04, // Base cost multiplier for efficiency
    efficiencyCostAcceleration: 1.0003, // Cost acceleration factor for efficiency

    // Production time scaling
    batchTimeEfficiency: 0.9, // When batch doubles, time scales more conservatively
};

/**
 * Calculate batch size based on speed upgrades - doubles at specific thresholds
 */
export function calculateBatchSize(
    initialBatchSize: number,
    speedUpgrade: number,
): number {
    const thresholds = gameSettings.batchSizeThreshold;

    // Count how many thresholds we've passed
    let thresholdsPassedCount = 0;
    for (const threshold of thresholds) {
        if (speedUpgrade >= threshold) {
            thresholdsPassedCount++;
        } else {
            break;
        }
    }

    // Each threshold doubles the batch size, starting from 1
    return Math.pow(2, thresholdsPassedCount) * initialBatchSize;
}

/**
 * Calculate speed multiplier with controlled progression
 */
export function calculateSpeedMultiplier(speedUpgrade: number): number {
    if (speedUpgrade === 0) {
        return 1.0;
    }

    const w = Math.min(0.5 / Math.exp(-(0.01 * speedUpgrade)), 0.8); // Cap at 0.8 for w

    const linImprovement = Math.pow(
        speedUpgrade * gameSettings.speedBaseMultiplier,
        Math.pow(speedUpgrade, 0.12),
    ); // Linear component
    const logImprovement = Math.log(speedUpgrade + 1) / Math.log(1.5) *
        gameSettings.speedDiminishingFactor;
    const expImprovement = Math.pow(
        gameSettings.speedIncrement /
            Math.min(
                gameSettings.speedIncrement,
                Math.pow(1.000025, speedUpgrade),
            ),
        speedUpgrade,
    ) - (1 + speedUpgrade * 0.2); // Exponential component

    return 1 + linImprovement + w * logImprovement + expImprovement;
}

/**
 * Calculate production time considering batch size scaling and speed improvements
 */
export function calculateProductionTime(
    initialBatchSize: number,
    speedUpgrade: number,
    baseProductionTime: number,
): number {
    const batchSize = calculateBatchSize(initialBatchSize, speedUpgrade);
    const speedMultiplier = calculateSpeedMultiplier(speedUpgrade);

    // Base time scales with batch size but with efficiency
    const batchTimeMultiplier = Math.pow(
        batchSize / initialBatchSize,
        gameSettings.batchTimeEfficiency,
    );

    // Speed reduces time
    const adjustedTime = (baseProductionTime * batchTimeMultiplier) /
        speedMultiplier;

    // Return adjusted time (enforce minimum production time if needed)
    return adjustedTime;
}

/**
 * Calculate efficiency bonus with logarithmic scaling
 */
export function calculateEfficiencyBonus(efficiencyUpgrade: number): number {
    if (efficiencyUpgrade === 0) {
        return 0;
    }

    const w = Math.min(0.3 / Math.exp(-(0.01 * efficiencyUpgrade)), 0.8);
    const linImprovement = Math.pow(
        efficiencyUpgrade * gameSettings.efficiencyPerUnit,
        1.1,
    );
    const logImprovement = gameSettings.efficiencyDiminishingFactor *
        Math.log(efficiencyUpgrade + 1);
    return linImprovement + w * logImprovement;
}

/**
 * Calculate items produced per second with the new advanced system
 * Returns: { itemsPerSecond, batchSize, productionTime }
 */
export function calculateProduction(
    initialBatchSize: number,
    speedUpgrade: number,
    efficiencyUpgrade: number,
    baseProductionTime: number,
): ProductionCalculation {
    const batchSize = calculateBatchSize(initialBatchSize, speedUpgrade);
    const productionTime = calculateProductionTime(
        batchSize,
        speedUpgrade,
        baseProductionTime / 1000,
    ); // Convert to seconds
    const efficiencyBonus = calculateEfficiencyBonus(efficiencyUpgrade); // Efficiency bonus as a fraction

    // Base items per second
    const baseItemsPerSecond = batchSize / productionTime;

    // Apply efficiency bonus
    const totalItemsPerSecond = baseItemsPerSecond * (1 + efficiencyBonus);

    return {
        itemsPerSecond: totalItemsPerSecond,
        batchSize: batchSize,
        productionTime: productionTime * 1000, // Convert back to milliseconds
    };
}

/**
 * Calculate upgrade cost for speed upgrades
 */
export function calculateSpeedUpgradeCost(
    baseCost: number,
    currentSpeedUpgrade: number,
): number {
    const nextLevel = currentSpeedUpgrade + 1;
    const baseCostMultiplier = Math.pow(gameSettings.speedCostBase, nextLevel);
    const accelerationMultiplier = Math.pow(
        gameSettings.speedCostAcceleration,
        Math.pow(nextLevel, 2),
    );
    return Math.ceil(baseCost * baseCostMultiplier * accelerationMultiplier);
}

/**
 * Calculate upgrade cost for efficiency upgrades
 */
export function calculateEfficiencyUpgradeCost(
    baseCost: number,
    currentEfficiencyUpgrade: number,
): number {
    const nextLevel = currentEfficiencyUpgrade + 1;
    const baseCostMultiplier = Math.pow(
        gameSettings.efficiencyCostBase,
        nextLevel,
    );
    const accelerationMultiplier = Math.pow(
        gameSettings.efficiencyCostAcceleration,
        Math.pow(nextLevel, 2),
    );
    return Math.ceil(baseCost * baseCostMultiplier * accelerationMultiplier);
}

// Export gameSettings for external use if needed
export { gameSettings };
