import type { Powerup } from "./defenseTypes";
import { PowerupType } from "./defenseTypes";

// Simplified powerup configs
const powerupConfigs = {
    [PowerupType.HEALTH_PACK]: {
        name: "Health Pack",
        description: ["Restore", "health"],
        color: "#10b981",
        glowColor: "#6ee7b7",
        lifetime: 20000,
        rarity: 0.3,
        effectType: "instant",
        effectValue: 40,
    },
    [PowerupType.DAMAGE_BOOST]: {
        name: "Damage Boost",
        description: ["+", "% damage for 15s"],
        color: "#ef4444",
        glowColor: "#fca5a5",
        lifetime: 15000,
        rarity: 0.2,
        effectType: "duration",
        effectValue: 50,
        effectDuration: 15000,
    },
    [PowerupType.SPEED_BOOST]: {
        name: "Speed Boost",
        description: ["+", "% movement speed for 12s"],
        color: "#3b82f6",
        glowColor: "#93c5fd",
        lifetime: 15000,
        rarity: 0.2,
        effectType: "duration",
        effectValue: 40,
        effectDuration: 12000,
    },
    [PowerupType.FIRE_RATE_BOOST]: {
        name: "Rapid Fire",
        description: ["+", "% fire rate for 10s"],
        color: "#f59e0b",
        glowColor: "#fcd34d",
        lifetime: 15000,
        rarity: 0.15,
        effectType: "duration",
        effectValue: 100,
        effectDuration: 10000,
    },
    [PowerupType.SHIELD]: {
        name: "Shield",
        description: ["Block next", "hits"],
        color: "#8b5cf6",
        glowColor: "#c4b5fd",
        lifetime: 18000,
        rarity: 0.1,
        effectType: "duration",
        effectValue: 3,
        effectDuration: 60000,
    },
    [PowerupType.MULTISHOT]: {
        name: "Multishot",
        description: ["Shoot", "bullets for 20s"],
        color: "#06b6d4",
        glowColor: "#67e8f9",
        lifetime: 15000,
        rarity: 0.08,
        effectType: "duration",
        effectValue: 3,
        effectDuration: 20000,
    },
    [PowerupType.PENETRATION_BOOST]: {
        name: "Pierce Shot",
        description: ["+", "penetration for 25s"],
        color: "#a855f7",
        glowColor: "#d8b4fe",
        lifetime: 15000,
        rarity: 0.05,
        effectType: "duration",
        effectValue: 2,
        effectDuration: 25000,
    },
    [PowerupType.CASH_BONUS]: {
        name: "Cash Bonus",
        description: ["Gain", "coins"],
        color: "#ffd700",
        glowColor: "#fff59d",
        lifetime: 25000,
        rarity: 0.25,
        effectType: "instant",
        effectValue: 100,
    },
} as const;

/**
 * Create a powerup at the specified location
 */
export function createPowerup(x: number, y: number): Powerup {
    // Select random powerup type based on rarity
    const availableTypes = Object.keys(powerupConfigs) as PowerupType[];
    const weights = availableTypes.map((type) =>
        1 - powerupConfigs[type].rarity
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let random = Math.random() * totalWeight;
    let selectedType = PowerupType.HEALTH_PACK;

    for (let i = 0; i < availableTypes.length; i++) {
        const weight = weights[i];
        const type = availableTypes[i];
        if (weight !== undefined && type !== undefined) {
            random -= weight;
            if (random <= 0) {
                selectedType = type;
                break;
            }
        }
    }

    const config = powerupConfigs[selectedType];
    const spawnTime = Date.now();

    return {
        id: Date.now() + Math.random(),
        x,
        y,
        width: 20,
        height: 20,
        speed: 0,
        angle: 0,
        type: selectedType,
        name: config.name,
        description: [...config.description],
        color: config.color,
        glowColor: config.glowColor,
        spawnTime,
        lifetime: config.lifetime,
        effectType: config.effectType as "instant" | "duration",
        effectValue: config.effectValue,
        ...("effectDuration" in config
            ? { effectDuration: config.effectDuration }
            : {}),
    };
}

/**
 * Check if a powerup should despawn
 */
export function shouldPowerupDespawn(powerup: Powerup): boolean {
    return Date.now() - powerup.spawnTime > powerup.lifetime;
}

/**
 * Calculate powerup spawn probability based on game state
 */
export function getPowerupSpawnChance(
    enemiesKilled: number,
    difficulty: number,
): number {
    const baseChance = 0.02 + (difficulty - 1) * 0.005;
    const killBonus = Math.min(0.03, enemiesKilled * 0.001);
    return Math.min(0.1, baseChance + killBonus);
}

/**
 * Generate random spawn position for powerup (not too close to player)
 */
export function getRandomPowerupSpawnPosition(
    worldWidth: number,
    worldHeight: number,
    playerX: number,
    playerY: number,
    minDistanceFromPlayer: number = 150,
): { x: number; y: number } {
    let x, y, distance;
    let attempts = 0;

    do {
        x = Math.random() * worldWidth;
        y = Math.random() * worldHeight;
        distance = Math.hypot(x - playerX, y - playerY);
        attempts++;

        if (attempts > 20) {
            const angle = Math.random() * Math.PI * 2;
            x = playerX + Math.cos(angle) * minDistanceFromPlayer;
            y = playerY + Math.sin(angle) * minDistanceFromPlayer;
            x = Math.max(20, Math.min(worldWidth - 20, x));
            y = Math.max(20, Math.min(worldHeight - 20, y));
            break;
        }
    } while (distance < minDistanceFromPlayer);

    return { x, y };
}

// Export for external use
export { powerupConfigs };
