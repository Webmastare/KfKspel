import type { Powerup, PowerupEffect } from "./defenseTypes";
import { PowerupType } from "./defenseTypes";

// Powerup templates with effects and visual properties
interface PowerupTemplate {
    type: PowerupType;
    name: string;
    description: string;
    color: string;
    glowColor: string;
    lifetime: number; // How long it stays on map (ms)
    rarity: number; // 0-1, higher = more rare
    effect: PowerupEffect;
}

const powerupTemplates: Record<PowerupType, PowerupTemplate> = {
    [PowerupType.HEALTH_PACK]: {
        type: PowerupType.HEALTH_PACK,
        name: "Health Pack",
        description: "Restore 40 health",
        color: "#10b981",
        glowColor: "#6ee7b7",
        lifetime: 20000, // 20 seconds
        rarity: 0.3, // Common
        effect: {
            type: "instant",
            value: 40,
        },
    },
    [PowerupType.DAMAGE_BOOST]: {
        type: PowerupType.DAMAGE_BOOST,
        name: "Damage Boost",
        description: "+50% damage for 15s",
        color: "#ef4444",
        glowColor: "#fca5a5",
        lifetime: 15000,
        rarity: 0.2,
        effect: {
            type: "duration",
            duration: 15000,
            value: 1.5, // 50% boost (multiply by 1.5)
        },
    },
    [PowerupType.SPEED_BOOST]: {
        type: PowerupType.SPEED_BOOST,
        name: "Speed Boost",
        description: "+40% movement speed for 12s",
        color: "#3b82f6",
        glowColor: "#93c5fd",
        lifetime: 15000,
        rarity: 0.2,
        effect: {
            type: "duration",
            duration: 12000,
            value: 1.4,
        },
    },
    [PowerupType.FIRE_RATE_BOOST]: {
        type: PowerupType.FIRE_RATE_BOOST,
        name: "Rapid Fire",
        description: "+100% fire rate for 10s",
        color: "#f59e0b",
        glowColor: "#fcd34d",
        lifetime: 15000,
        rarity: 0.15,
        effect: {
            type: "duration",
            duration: 10000,
            value: 2.0,
        },
    },
    [PowerupType.SHIELD]: {
        type: PowerupType.SHIELD,
        name: "Shield",
        description: "Block next 3 hits",
        color: "#8b5cf6",
        glowColor: "#c4b5fd",
        lifetime: 18000,
        rarity: 0.1,
        effect: {
            type: "duration",
            duration: 60000, // Long duration, but limited by hit count
            value: 3, // Number of hits to block
        },
    },
    [PowerupType.MULTISHOT]: {
        type: PowerupType.MULTISHOT,
        name: "Multishot",
        description: "Shoot 3 bullets for 20s",
        color: "#06b6d4",
        glowColor: "#67e8f9",
        lifetime: 15000,
        rarity: 0.08,
        effect: {
            type: "duration",
            duration: 20000,
            value: 3,
        },
    },
    [PowerupType.PENETRATION_BOOST]: {
        type: PowerupType.PENETRATION_BOOST,
        name: "Piercing Shots",
        description: "+2 penetration for 15s",
        color: "#ec4899",
        glowColor: "#f9a8d4",
        lifetime: 15000,
        rarity: 0.12,
        effect: {
            type: "duration",
            duration: 15000,
            value: 2,
        },
    },
    [PowerupType.CASH_BONUS]: {
        type: PowerupType.CASH_BONUS,
        name: "Cash Bonus",
        description: "Gain $50 instantly",
        color: "#fbbf24",
        glowColor: "#fde68a",
        lifetime: 25000,
        rarity: 0.25,
        effect: {
            type: "instant",
            value: 50,
        },
    },
};

// === Powerup System Functions ===

/**
 * Create a powerup at a specific location
 */
function createPowerup(x: number, y: number, type?: PowerupType): Powerup {
    const powerupType = type || selectRandomPowerup();
    const template = powerupTemplates[powerupType];

    return {
        id: Date.now() + Math.random(),
        x,
        y,
        width: 16,
        height: 16,
        speed: 0,
        angle: 0,
        type: powerupType,
        name: template.name,
        description: template.description,
        color: template.color,
        glowColor: template.glowColor,
        spawnTime: Date.now(),
        lifetime: template.lifetime,
        effect: { ...template.effect },
    };
}

/**
 * Select a random powerup type based on rarity weights
 */
function selectRandomPowerup(): PowerupType {
    const weightedTypes: Array<{ type: PowerupType; weight: number }> = [];

    for (const [type, template] of Object.entries(powerupTemplates)) {
        // Invert rarity so higher rarity = lower spawn chance
        const weight = 1 - template.rarity;
        weightedTypes.push({ type: type as PowerupType, weight });
    }

    const totalWeight = weightedTypes.reduce(
        (sum, item) => sum + item.weight,
        0,
    );
    let random = Math.random() * totalWeight;

    for (const item of weightedTypes) {
        random -= item.weight;
        if (random <= 0) {
            return item.type;
        }
    }

    return PowerupType.HEALTH_PACK; // Fallback
}

/**
 * Check if a powerup should despawn
 */
function shouldPowerupDespawn(powerup: Powerup): boolean {
    return Date.now() - powerup.spawnTime > powerup.lifetime;
}

/**
 * Calculate powerup spawn probability based on game state
 */
function getPowerupSpawnChance(
    enemiesKilled: number,
    difficulty: number,
): number {
    // Base chance increases slightly with difficulty
    const baseChance = 0.02 + (difficulty - 1) * 0.005; // 2-5% base chance

    // Increase chance if player has killed many enemies recently
    const killBonus = Math.min(0.03, enemiesKilled * 0.001);

    return Math.min(0.08, baseChance + killBonus); // Cap at 8%
}

/**
 * Generate random spawn position for powerup (not too close to player)
 */
function getRandomPowerupSpawnPosition(
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

        // Prevent infinite loop
        if (attempts > 20) {
            // Place at edge of minimum distance circle
            const angle = Math.random() * Math.PI * 2;
            x = playerX + Math.cos(angle) * minDistanceFromPlayer;
            y = playerY + Math.sin(angle) * minDistanceFromPlayer;

            // Clamp to world bounds
            x = Math.max(20, Math.min(worldWidth - 20, x));
            y = Math.max(20, Math.min(worldHeight - 20, y));
            break;
        }
    } while (distance < minDistanceFromPlayer);

    return { x, y };
}

export {
    createPowerup,
    getPowerupSpawnChance,
    getRandomPowerupSpawnPosition,
    powerupTemplates,
    selectRandomPowerup,
    shouldPowerupDespawn,
};
