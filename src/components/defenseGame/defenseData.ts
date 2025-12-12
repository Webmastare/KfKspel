import type { Weapon } from "./defenseTypes";

// Base weapon templates with costs
const weaponTemplates: Record<string, Weapon> = {
    "Basic Gun": {
        name: "Basic Gun",
        damage: 25,
        fireRate: 8,
        penetration: 1,
        lastShotTime: 0,
        range: 350,
        bulletSpeed: 700,
        bulletSize: 4,
        cost: 0,
    },
    "Rapid Fire": {
        name: "Rapid Fire",
        damage: 15,
        fireRate: 15,
        penetration: 2,
        lastShotTime: 0,
        range: 300,
        bulletSpeed: 900,
        bulletSize: 3,
        cost: 150,
    },
    "Heavy Cannon": {
        name: "Heavy Cannon",
        damage: 75,
        fireRate: 3,
        penetration: 3,
        lastShotTime: 0,
        range: 400,
        bulletSpeed: 700,
        bulletSize: 8,
        cost: 300,
    },
    "Sniper Rifle": {
        name: "Sniper Rifle",
        damage: 150,
        fireRate: 1.5,
        penetration: 5,
        lastShotTime: 0,
        range: 600,
        bulletSpeed: 1200,
        bulletSize: 6,
        cost: 500,
    },
    "Plasma Cannon": {
        name: "Plasma Cannon",
        damage: 100,
        fireRate: 5,
        penetration: 4,
        lastShotTime: 0,
        range: 450,
        bulletSpeed: 800,
        bulletSize: 10,
        cost: 750,
    },
};

// Utility function to create weapon copies (avoids duplication)
function createWeaponCopy(weaponTemplate: Weapon): Weapon {
    return Object.assign({}, { ...weaponTemplate, lastShotTime: 0 });
}

// Utility function to calculate upgrade costs
function calculateUpgradeCost(
    weapon: Weapon,
    stat: string,
    baseWeapon: Weapon,
): number {
    let currentLevel = 0;
    switch (stat) {
        case "damage":
            currentLevel = Math.floor(
                (weapon.damage - baseWeapon.damage) / (baseWeapon.damage * 0.2),
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
            currentLevel = weapon.penetration - baseWeapon.penetration;
            break;
    }

    const baseCost = Math.floor(baseWeapon.cost / 5) + 25;
    return Math.floor(baseCost * Math.pow(1.5, currentLevel));
}

export { calculateUpgradeCost, createWeaponCopy, weaponTemplates };
