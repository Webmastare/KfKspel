import type { Weapon } from "./defenseTypes";

// Interface for bullet configuration
export interface BulletConfig {
    speed: number; // Bullet travel speed
    size: number; // Visual bullet size
    damage: number; // Damage per bullet
    // Animation properties (normalized 0.5-5, multiplied in animation functions)
    particleCount: number; // Normalized particle count for impact explosion
    explosionRadius: number; // Normalized explosion radius
    // Visual properties
    color?: string; // Bullet color (optional, defaults based on weapon)
    trailLength?: number; // Bullet trail effect length (normalized)
}

// Base weapon templates with costs
export const weaponTemplates: Record<string, Weapon> = {
    "Basic Gun": {
        name: "Basic Gun",
        fireRate: 1,
        penetration: 1,
        lastShotTime: 0,
        range: 350,
        cost: 0,
        levelRequired: 1,
        weaponType: "single",
        bullet: {
            speed: 700,
            size: 4,
            damage: 25,
            particleCount: 1.0,
            explosionRadius: 0.8,
            color: "#FFD700",
            trailLength: 1.0,
        },
    },
    Shotgun: {
        name: "Shotgun",
        fireRate: 1.2,
        lastShotTime: 0,
        range: 250,
        cost: 200,
        levelRequired: 2,
        weaponType: "shotgun",
        bulletCount: 5,
        spread: 25, // 25 degree spread
        bullet: {
            speed: 600,
            size: 3,
            damage: 18,
            particleCount: 0.7,
            explosionRadius: 0.6,
            color: "#FF8C00",
            trailLength: 0.5,
        },
    },
    "Rapid Fire": {
        name: "Rapid Fire",
        fireRate: 15,
        penetration: 2,
        lastShotTime: 0,
        range: 300,
        cost: 150,
        levelRequired: 3,
        weaponType: "single",
        bullet: {
            speed: 900,
            size: 3,
            damage: 15,
            particleCount: 0.8,
            explosionRadius: 0.5,
            color: "#00FF00",
            trailLength: 1.2,
        },
    },
    "Heavy Cannon": {
        name: "Heavy Cannon",
        fireRate: 3,
        penetration: 3,
        lastShotTime: 0,
        range: 400,
        cost: 300,
        levelRequired: 5,
        weaponType: "single",
        bullet: {
            speed: 700,
            size: 8,
            damage: 75,
            particleCount: 2.0,
            explosionRadius: 1.5,
            color: "#FF6600",
            trailLength: 1.5,
        },
    },
    "Sniper Rifle": {
        name: "Sniper Rifle",
        fireRate: 1.5,
        penetration: 5,
        lastShotTime: 0,
        range: 600,
        cost: 500,
        levelRequired: 8,
        weaponType: "single",
        bullet: {
            speed: 1200,
            size: 6,
            damage: 150,
            particleCount: 1.5,
            explosionRadius: 1.0,
            color: "#00FFFF",
            trailLength: 2.0,
        },
    },
    "Plasma Cannon": {
        name: "Plasma Cannon",
        fireRate: 5,
        penetration: 4,
        lastShotTime: 0,
        range: 450,
        cost: 750,
        levelRequired: 12,
        weaponType: "single",
        bullet: {
            speed: 800,
            size: 10,
            damage: 100,
            particleCount: 2.5,
            explosionRadius: 2.0,
            color: "#FF00FF",
            trailLength: 1.8,
        },
    },
};

/**
 * Create a copy of a weapon template to avoid shared references
 */
export function createWeaponCopy(weaponTemplate: Weapon): Weapon {
    return Object.assign({}, { ...weaponTemplate, lastShotTime: 0 });
}

/**
 * Calculate the cost of upgrading a weapon stat
 */
export function calculateUpgradeCost(
    weapon: Weapon,
    stat: string,
    baseWeapon: Weapon,
): number {
    let currentLevel = 0;
    switch (stat) {
        case "damage":
            currentLevel = Math.floor(
                (weapon.bullet.damage - baseWeapon.bullet.damage) /
                    (baseWeapon.bullet.damage * 0.2),
            );
            break;
        case "fireRate":
            currentLevel = Math.floor(
                (weapon.fireRate - baseWeapon.fireRate) /
                    (baseWeapon.fireRate * 0.15),
            );
            break;
        case "range":
            currentLevel = Math.floor(
                (weapon.range - baseWeapon.range) / (baseWeapon.range * 0.1),
            );
            break;
        case "penetration":
            // Only for single-shot weapons with penetration
            if (
                weapon.penetration !== undefined &&
                baseWeapon.penetration !== undefined
            ) {
                currentLevel = weapon.penetration - baseWeapon.penetration;
            }
            break;
    }

    const baseCost = Math.floor(baseWeapon.cost / 5) + 25;
    return Math.floor(baseCost * Math.pow(1.5, currentLevel));
}
