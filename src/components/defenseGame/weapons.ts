import type { Weapon } from "./defenseTypes";

// Base weapon templates with simplified structure
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
        bulletSpeed: 700,
        bulletSize: 4,
        bulletDamage: 25,
        bulletColor: "#FFD700",
        particleCount: 1.0,
        explosionRadius: 0.8,
        trailLength: 1.0,
    },
    Shotgun: {
        name: "Shotgun",
        fireRate: 1.2,
        penetration: 0,
        lastShotTime: 0,
        range: 250,
        cost: 200,
        levelRequired: 2,
        weaponType: "shotgun",
        bulletCount: 5,
        spread: 25,
        bulletSpeed: 600,
        bulletSize: 3,
        bulletDamage: 18,
        bulletColor: "#FF8C00",
        particleCount: 0.7,
        explosionRadius: 0.6,
        trailLength: 0.5,
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
        bulletSpeed: 900,
        bulletSize: 3,
        bulletDamage: 15,
        bulletColor: "#00FF00",
        particleCount: 0.8,
        explosionRadius: 0.5,
        trailLength: 1.2,
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
        bulletSpeed: 700,
        bulletSize: 8,
        bulletDamage: 75,
        bulletColor: "#FF6600",
        particleCount: 2.0,
        explosionRadius: 1.5,
        trailLength: 1.5,
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
        bulletSpeed: 1200,
        bulletSize: 6,
        bulletDamage: 150,
        bulletColor: "#00FFFF",
        particleCount: 1.5,
        explosionRadius: 1.0,
        trailLength: 2.0,
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
        bulletSpeed: 800,
        bulletSize: 10,
        bulletDamage: 100,
        bulletColor: "#FF00FF",
        particleCount: 2.5,
        explosionRadius: 2.0,
        trailLength: 1.8,
    },
};

/**
 * Create a copy of a weapon template to avoid shared references
 */
export function createWeaponCopy(weaponTemplate: Weapon): Weapon {
    return { ...weaponTemplate, lastShotTime: 0 };
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
            // For multiplicative upgrades, calculate level using logarithm
            // Each upgrade: newValue = oldValue * 1.2, so after n upgrades: value = base * (1.2)^n
            // Solve for n: n = log(current/base) / log(1.2)
            currentLevel = Math.floor(
                Math.log(weapon.bulletDamage / baseWeapon.bulletDamage) /
                    Math.log(1.2),
            );
            break;
        case "fireRate":
            currentLevel = Math.floor(
                Math.log(weapon.fireRate / baseWeapon.fireRate) /
                    Math.log(1.15),
            );
            break;
        case "range":
            currentLevel = Math.floor(
                Math.log(weapon.range / baseWeapon.range) / Math.log(1.1),
            );
            break;
        case "penetration":
            currentLevel = weapon.penetration - baseWeapon.penetration;
            break;
        case "bulletCount":
            currentLevel =
                weapon.bulletCount !== undefined &&
                    baseWeapon.bulletCount !== undefined
                    ? weapon.bulletCount - baseWeapon.bulletCount
                    : 0;
            break;
        case "spread":
            currentLevel =
                weapon.spread !== undefined && baseWeapon.spread !== undefined
                    ? Math.floor((baseWeapon.spread - weapon.spread) / 2)
                    : 0;
            break;
        default:
            currentLevel = 0;
            break;
    }

    const baseCost = Math.floor(baseWeapon.cost / 5) + 25;
    return Math.floor(baseCost * Math.pow(1.5, currentLevel));
}
