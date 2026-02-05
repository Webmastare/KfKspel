import { type Enemy, EnemyType } from "./defenseTypes";

// Base config type for non-shooting enemies
type BaseEnemyConfig = {
    health: number;
    speed: number;
    damage: number;
    value: number;
    width: number;
    height: number;
    color: string;
    borderColor: string;
    spawnWeight: number;
};

// Extended config for shooting enemies
type ShootingEnemyConfig = BaseEnemyConfig & {
    range: number;
    fireRate: number;
    bulletSpeed: number;
    lastShotTime: number;
};

// Simplified enemy configs
const enemyConfigs = {
    [EnemyType.BASIC]: {
        health: 35,
        speed: 1.2,
        damage: 8,
        value: 5,
        width: 20,
        height: 20,
        color: "#ef4444",
        borderColor: "#991b1b",
        spawnWeight: 10,
    } satisfies BaseEnemyConfig,
    [EnemyType.FAST]: {
        health: 25,
        speed: 2.8,
        damage: 6,
        value: 8,
        width: 16,
        height: 16,
        color: "#fbbf24",
        borderColor: "#d97706",
        spawnWeight: 6,
    } satisfies BaseEnemyConfig,
    [EnemyType.TANK]: {
        health: 80,
        speed: 0.7,
        damage: 18,
        value: 15,
        width: 32,
        height: 32,
        color: "#6b7280",
        borderColor: "#374151",
        spawnWeight: 3,
    } satisfies BaseEnemyConfig,
    [EnemyType.SHOOTER]: {
        health: 30,
        speed: 0.9,
        damage: 4,
        value: 12,
        width: 22,
        height: 22,
        color: "#8b5cf6",
        borderColor: "#5b21b6",
        spawnWeight: 4,
        range: 240,
        fireRate: 0.6,
        bulletSpeed: 300,
        lastShotTime: 0,
    } satisfies ShootingEnemyConfig,
    [EnemyType.ELITE]: {
        health: 120,
        speed: 1.6,
        damage: 22,
        value: 25,
        width: 28,
        height: 28,
        color: "#dc2626",
        borderColor: "#7f1d1d",
        spawnWeight: 1,
        range: 300,
        fireRate: 1.2,
        bulletSpeed: 450,
        lastShotTime: 0,
    } satisfies ShootingEnemyConfig,
};

// Helper to check if enemy has shooting config
const hasShootingConfig = (
    config: BaseEnemyConfig | ShootingEnemyConfig,
): config is ShootingEnemyConfig => "range" in config;

// Simplified difficulty functions
export const getDifficultyLevel = (enemiesKilled: number) =>
    Math.floor(enemiesKilled / 25) + 1;
export const getWaveNumber = (enemiesKilled: number) =>
    Math.floor(enemiesKilled / 30) + 1;

/**
 * Create enemy with scaled stats based on difficulty
 */
export function createEnemy(
    type: EnemyType,
    difficulty: number,
    id: number,
): Enemy {
    const config = enemyConfigs[type];
    const healthMult = 1 + (difficulty - 1) * 0.15;
    const speedMult = 1 + (difficulty - 1) * 0.05;
    const damageMult = 1 + (difficulty - 1) * 0.1;
    const valueMult = 1 + (difficulty - 1) * 0.1;

    const scaledHealth = Math.floor(config.health * healthMult);

    const baseEnemy = {
        id,
        x: 0,
        y: 0,
        angle: 0, // Position set by spawn logic
        type,
        health: scaledHealth,
        maxHealth: scaledHealth,
        speed: config.speed * speedMult,
        damage: Math.floor(config.damage * damageMult),
        value: Math.floor(config.value * valueMult),
        width: config.width,
        height: config.height,
        color: config.color,
        borderColor: config.borderColor,
    };

    // Add shooting properties if enemy can shoot
    if (hasShootingConfig(config)) {
        return {
            ...baseEnemy,
            range: config.range * (1 + (difficulty - 1) * 0.02),
            fireRate: config.fireRate * (1 + (difficulty - 1) * 0.03),
            bulletSpeed: config.bulletSpeed * (1 + (difficulty - 1) * 0.04),
            lastShotTime: 0,
        };
    }

    return baseEnemy;
}

/**
 * Select enemy type based on difficulty with weighted random selection
 */
export function selectEnemyType(difficulty: number): EnemyType {
    const availableTypes = [
        {
            type: EnemyType.BASIC,
            weight: enemyConfigs[EnemyType.BASIC].spawnWeight,
        },
        ...(difficulty >= 3
            ? [{
                type: EnemyType.FAST,
                weight: enemyConfigs[EnemyType.FAST].spawnWeight,
            }]
            : []),
        ...(difficulty >= 5
            ? [{
                type: EnemyType.SHOOTER,
                weight: enemyConfigs[EnemyType.SHOOTER].spawnWeight,
            }]
            : []),
        ...(difficulty >= 7
            ? [{
                type: EnemyType.TANK,
                weight: enemyConfigs[EnemyType.TANK].spawnWeight,
            }]
            : []),
        ...(difficulty >= 10
            ? [{
                type: EnemyType.ELITE,
                weight: enemyConfigs[EnemyType.ELITE].spawnWeight,
            }]
            : []),
    ];

    const totalWeight = availableTypes.reduce(
        (sum, enemy) => sum + enemy.weight,
        0,
    );
    let random = Math.random() * totalWeight;

    for (const enemyType of availableTypes) {
        random -= enemyType.weight;
        if (random <= 0) return enemyType.type;
    }

    return EnemyType.BASIC;
}

/**
 * Get XP value for enemy types
 */
export const getEnemyXpValue = (enemyType: EnemyType) =>
    ({
        [EnemyType.BASIC]: 10,
        [EnemyType.FAST]: 15,
        [EnemyType.SHOOTER]: 20,
        [EnemyType.TANK]: 25,
        [EnemyType.ELITE]: 40,
    })[enemyType] || 10;

// Export configs for external use (rendering, etc.)
export { enemyConfigs };
