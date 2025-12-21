import { EnemyType } from "./defenseTypes";

// Enemy template interface for defining base stats
export interface EnemyTemplate {
    type: EnemyType;
    baseHealth: number;
    baseSpeed: number;
    baseDamage: number;
    baseValue: number;
    size: { width: number; height: number };
    color: string;
    borderColor: string;
    canShoot?: boolean;
    range?: number;
    fireRate?: number;
    bulletSpeed?: number;
    spawnWeight: number; // Higher = more likely to spawn
}

// Enemy templates with base stats for each enemy type
export const enemyTemplates: Record<EnemyType, EnemyTemplate> = {
    [EnemyType.BASIC]: {
        type: EnemyType.BASIC,
        baseHealth: 35, // Reduced from 50
        baseSpeed: 1.2, // Reduced from 1.5
        baseDamage: 8, // Reduced from 10
        baseValue: 5,
        size: { width: 20, height: 20 },
        color: "#ef4444",
        borderColor: "#991b1b",
        spawnWeight: 10,
    },
    [EnemyType.FAST]: {
        type: EnemyType.FAST,
        baseHealth: 25, // Reduced from 30
        baseSpeed: 2.8, // Reduced from 3.5
        baseDamage: 6, // Reduced from 8
        baseValue: 8,
        size: { width: 16, height: 16 },
        color: "#fbbf24",
        borderColor: "#d97706",
        spawnWeight: 6,
    },
    [EnemyType.TANK]: {
        type: EnemyType.TANK,
        baseHealth: 80, // Reduced from 120
        baseSpeed: 0.7, // Reduced from 0.8
        baseDamage: 18, // Reduced from 25
        baseValue: 15,
        size: { width: 32, height: 32 },
        color: "#6b7280",
        borderColor: "#374151",
        spawnWeight: 3,
    },
    [EnemyType.SHOOTER]: {
        type: EnemyType.SHOOTER,
        baseHealth: 30, // Reduced from 40
        baseSpeed: 0.9, // Reduced from 1.0
        baseDamage: 4, // Reduced from 5
        baseValue: 12,
        size: { width: 22, height: 22 },
        color: "#8b5cf6",
        borderColor: "#5b21b6",
        canShoot: true,
        range: 240, // Reduced from 300
        fireRate: 0.6, // Reduced from 1.5
        bulletSpeed: 300,
        spawnWeight: 4,
    },
    [EnemyType.ELITE]: {
        type: EnemyType.ELITE,
        baseHealth: 120, // Reduced from 200
        baseSpeed: 1.6, // Reduced from 2.0
        baseDamage: 22, // Reduced from 35
        baseValue: 25,
        size: { width: 28, height: 28 },
        color: "#dc2626",
        borderColor: "#7f1d1d",
        canShoot: true,
        range: 300, // Reduced from 350
        fireRate: 1.2, // Reduced from 2.0
        bulletSpeed: 450, // Reduced from 500
        spawnWeight: 1,
    },
};

// Difficulty scaling functions - much more gradual progression
export function getDifficultyLevel(enemiesKilled: number): number {
    return Math.floor(enemiesKilled / 25) + 1; // Increased from 10 to 25
}

export function getWaveNumber(enemiesKilled: number): number {
    return Math.floor(enemiesKilled / 30) + 1; // Increased from 15 to 30
}

/**
 * Scale enemy stats based on current difficulty level
 */
export function scaleEnemyStats(template: EnemyTemplate, difficulty: number) {
    // Much more gradual scaling - reduced multipliers
    const healthMultiplier = 1 + (difficulty - 1) * 0.15;
    const speedMultiplier = 1 + (difficulty - 1) * 0.05;
    const damageMultiplier = 1 + (difficulty - 1) * 0.1;
    const valueMultiplier = 1 + (difficulty - 1) * 0.1;

    const stats: any = {
        health: Math.floor(template.baseHealth * healthMultiplier),
        maxHealth: Math.floor(template.baseHealth * healthMultiplier),
        speed: template.baseSpeed * speedMultiplier,
        damage: Math.floor(template.baseDamage * damageMultiplier),
        value: Math.floor(template.baseValue * valueMultiplier),
        width: template.size.width,
        height: template.size.height,
        type: template.type,
    };

    if (template.range !== undefined) {
        const rangeMultiplier = 1 + (difficulty - 1) * 0.02;
        stats.range = template.range * rangeMultiplier;
    }
    if (template.fireRate !== undefined) {
        const fireRateMultiplier = 1 + (difficulty - 1) * 0.03;
        stats.fireRate = template.fireRate * fireRateMultiplier;
    }
    if (template.bulletSpeed !== undefined) {
        const bulletSpeedMultiplier = 1 + (difficulty - 1) * 0.04;
        stats.bulletSpeed = template.bulletSpeed * bulletSpeedMultiplier;
    }
    if (template.canShoot) stats.lastShotTime = 0;

    return stats;
}

/**
 * Select enemy type based on difficulty level with weighted random selection
 */
export function selectEnemyType(difficulty: number): EnemyType {
    // Determine available enemy types based on difficulty
    let availableTypes: Array<{ type: EnemyType; weight: number }> = [
        {
            type: EnemyType.BASIC,
            weight: enemyTemplates[EnemyType.BASIC].spawnWeight,
        },
    ];

    if (difficulty >= 3) {
        // Increased from 2 to 3
        availableTypes.push({
            type: EnemyType.FAST,
            weight: enemyTemplates[EnemyType.FAST].spawnWeight,
        });
    }
    if (difficulty >= 5) {
        // Increased from 3 to 5
        availableTypes.push({
            type: EnemyType.SHOOTER,
            weight: enemyTemplates[EnemyType.SHOOTER].spawnWeight,
        });
    }
    if (difficulty >= 7) {
        // Increased from 4 to 7
        availableTypes.push({
            type: EnemyType.TANK,
            weight: enemyTemplates[EnemyType.TANK].spawnWeight,
        });
    }
    if (difficulty >= 10) {
        // Increased from 6 to 10
        availableTypes.push({
            type: EnemyType.ELITE,
            weight: enemyTemplates[EnemyType.ELITE].spawnWeight,
        });
    }

    // Weighted random selection
    const totalWeight = availableTypes.reduce(
        (sum, enemy) => sum + enemy.weight,
        0,
    );
    let random = Math.random() * totalWeight;

    for (const enemyType of availableTypes) {
        random -= enemyType.weight;
        if (random <= 0) {
            return enemyType.type;
        }
    }

    return EnemyType.BASIC; // Fallback
}

/**
 * Get base XP value for different enemy types
 */
export function getEnemyXpValue(enemyType: EnemyType): number {
    const xpValues = {
        [EnemyType.BASIC]: 10,
        [EnemyType.FAST]: 15,
        [EnemyType.SHOOTER]: 20,
        [EnemyType.TANK]: 25,
        [EnemyType.ELITE]: 40,
    };
    return xpValues[enemyType] || 10;
}
