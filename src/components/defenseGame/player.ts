import type { Player } from "./defenseTypes";
import { EnemyType } from "./defenseTypes";

// Player-related interfaces that can be exported
export interface PlayerXPData {
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
}

export interface PlayerStats {
    health: number;
    maxHealth: number;
    money: number;
    level: number;
}

// XP and Leveling System Functions

/**
 * Calculate XP required for a specific level
 * Uses a scaling formula: 100 * level^1.2 for smooth progression
 */
export function getXpRequiredForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(100 * Math.pow(level, 1.2));
}

/**
 * Calculate actual XP gained from killing an enemy with multiplier
 * Multiplier is floored to int for XP calculation but tracked as float
 */
export function calculateXpGained(
    enemyType: EnemyType,
    multiplier: number,
): number {
    const baseXpValues = {
        [EnemyType.BASIC]: 10,
        [EnemyType.FAST]: 15,
        [EnemyType.SHOOTER]: 20,
        [EnemyType.TANK]: 25,
        [EnemyType.ELITE]: 40,
    };

    const baseXp = baseXpValues[enemyType] || 10;
    const intMultiplier = Math.floor(multiplier);
    return baseXp * intMultiplier;
}

/**
 * Update multiplier based on kill timing
 */
export function updateMultiplier(
    currentMultiplier: number,
    timeSinceLastKill: number,
    deltaTime: number = 16.67, // Default to ~60fps (16.67ms per frame)
): number {
    const deltaSeconds = deltaTime / 1000;
    const t = Math.max(0, timeSinceLastKill) / 1000; // seconds (clamp negative)
    if (t === 0) return currentMultiplier;

    // Base decay scale (small so low multipliers drop slowly)
    const base = 0.02;

    // Make higher multipliers decay faster initially and overall
    const multFactor = Math.pow(currentMultiplier, 1.1);

    let decayAmount: number;

    if (t <= 1) {
        // Gentle start for the first second (quadratic easing)
        // tiny decay near t=0, larger but still small at t=1
        decayAmount = base * multFactor * Math.pow(t, 2);
    } else {
        // After 1s, accelerate decay: quadratic growth amplified by an exponential
        // Coefficients chosen so value is continuous at t=1 and then grows faster
        decayAmount = base * multFactor *
            (0.5 + 0.5 * Math.pow(t, 2) * Math.exp((t - 1) * 0.5));
    }
    const scaledDecay = decayAmount * deltaSeconds;
    return Math.max(1.0, currentMultiplier - scaledDecay);
}

/**
 * Increases multiplier slightly on each kill, with diminishing returns
 */
export function increaseMultiplier(currentMultiplier: number): number {
    // Fresh kill - increase multiplier with diminishing returns
    const increment = 0.1 / (1 + (currentMultiplier - 1) * 0.5); // Slower growth at higher multipliers
    return currentMultiplier + increment;
}

/**
 * Check if player should level up and return new level
 */
export function checkLevelUp(
    currentLevel: number,
    currentXp: number,
    xpToNextLevel: number,
): {
    newLevel: number;
    newXpToNextLevel: number;
    leveledUp: boolean;
} {
    if (currentXp >= xpToNextLevel) {
        const newLevel = currentLevel + 1;
        const newXpToNextLevel = getXpRequiredForLevel(newLevel + 1);
        return {
            newLevel,
            newXpToNextLevel,
            leveledUp: true,
        };
    }
    return {
        newLevel: currentLevel,
        newXpToNextLevel: xpToNextLevel,
        leveledUp: false,
    };
}

/**
 * Create a new player with default stats
 */
export function createPlayer(weaponTemplate: any): Player {
    return {
        x: 600, // Center of world
        y: 450,
        width: 50,
        height: 50,
        speed: 5,
        angle: 0,
        health: 100,
        maxHealth: 100,
        currentWeapon: weaponTemplate,
        money: 10000, // Starting money
        ownedWeapons: {},
        // XP System
        level: 1,
        xp: 0,
        xpToNextLevel: getXpRequiredForLevel(2), // XP needed for level 2
        totalXp: 0,
    };
}
