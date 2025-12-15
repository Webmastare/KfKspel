import type { Enemy, Weapon } from "./defenseTypes";
import { EnemyType } from "./defenseTypes";

// Base weapon templates with costs
const weaponTemplates: Record<string, Weapon> = {
    "Basic Gun": {
        name: "Basic Gun",
        damage: 25,
        fireRate: 1,
        penetration: 1,
        lastShotTime: 0,
        range: 350,
        bulletSpeed: 700,
        bulletSize: 4,
        cost: 0,
        levelRequired: 1,
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
        levelRequired: 3,
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
        levelRequired: 5,
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
        levelRequired: 8,
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
        levelRequired: 12,
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

// Enemy type definitions with base stats
interface EnemyTemplate {
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

const enemyTemplates: Record<EnemyType, EnemyTemplate> = {
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
        range: 280, // Reduced from 300
        fireRate: 1.2, // Reduced from 1.5
        bulletSpeed: 350, // Reduced from 400
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
        range: 320, // Reduced from 350
        fireRate: 1.6, // Reduced from 2.0
        bulletSpeed: 450, // Reduced from 500
        spawnWeight: 1,
    },
};

// Difficulty scaling functions - much more gradual progression
function getDifficultyLevel(enemiesKilled: number): number {
    return Math.floor(enemiesKilled / 25) + 1; // Increased from 10 to 25
}

function getWaveNumber(enemiesKilled: number): number {
    return Math.floor(enemiesKilled / 30) + 1; // Increased from 15 to 30
}

function scaleEnemyStats(template: EnemyTemplate, difficulty: number) {
    // Much more gradual scaling - reduced multipliers
    const healthMultiplier = 1 + (difficulty - 1) * 0.15; // Reduced from 0.3 to 0.15
    const speedMultiplier = 1 + (difficulty - 1) * 0.05; // Reduced from 0.1 to 0.05
    const damageMultiplier = 1 + (difficulty - 1) * 0.1; // Reduced from 0.2 to 0.1
    const valueMultiplier = 1 + (difficulty - 1) * 0.1; // Reduced from 0.15 to 0.1

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

    if (template.range !== undefined) stats.range = template.range;
    if (template.fireRate !== undefined) stats.fireRate = template.fireRate;
    if (template.bulletSpeed !== undefined) {
        stats.bulletSpeed = template.bulletSpeed;
    }
    if (template.canShoot) stats.lastShotTime = 0;

    return stats;
}

function selectEnemyType(difficulty: number): EnemyType {
    // Determine available enemy types based on difficulty
    let availableTypes: Array<{ type: EnemyType; weight: number }> = [
        {
            type: EnemyType.BASIC,
            weight: enemyTemplates[EnemyType.BASIC].spawnWeight,
        },
    ];

    if (difficulty >= 3) { // Increased from 2 to 3
        availableTypes.push({
            type: EnemyType.FAST,
            weight: enemyTemplates[EnemyType.FAST].spawnWeight,
        });
    }
    if (difficulty >= 5) { // Increased from 3 to 5
        availableTypes.push({
            type: EnemyType.SHOOTER,
            weight: enemyTemplates[EnemyType.SHOOTER].spawnWeight,
        });
    }
    if (difficulty >= 7) { // Increased from 4 to 7
        availableTypes.push({
            type: EnemyType.TANK,
            weight: enemyTemplates[EnemyType.TANK].spawnWeight,
        });
    }
    if (difficulty >= 10) { // Increased from 6 to 10
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

// ============================================================================
// COLLISION SYSTEM - Spatial Grid Implementation
// ============================================================================

interface GridCell {
    enemies: Enemy[];
}

interface SpatialGrid {
    cells: GridCell[][];
    cellSize: number;
    worldWidth: number;
    worldHeight: number;
    gridWidth: number;
    gridHeight: number;
}

class CollisionSystem {
    private grid: SpatialGrid;

    constructor(
        worldWidth: number,
        worldHeight: number,
        cellSize: number = 100,
    ) {
        this.grid = {
            cells: [],
            cellSize,
            worldWidth,
            worldHeight,
            gridWidth: Math.ceil(worldWidth / cellSize),
            gridHeight: Math.ceil(worldHeight / cellSize),
        };

        // Initialize grid cells
        this.initializeGrid();
    }

    // Initialize or reinitialize the grid
    private initializeGrid(): void {
        this.grid.cells = [];
        for (let x = 0; x < this.grid.gridWidth; x++) {
            this.grid.cells[x] = [];
            for (let y = 0; y < this.grid.gridHeight; y++) {
                this.grid.cells[x]![y] = { enemies: [] };
            }
        }
    }

    // Convert world coordinates to grid coordinates
    private worldToGrid(
        x: number,
        y: number,
    ): { gridX: number; gridY: number } {
        return {
            gridX: Math.max(
                0,
                Math.min(
                    this.grid.gridWidth - 1,
                    Math.floor(x / this.grid.cellSize),
                ),
            ),
            gridY: Math.max(
                0,
                Math.min(
                    this.grid.gridHeight - 1,
                    Math.floor(y / this.grid.cellSize),
                ),
            ),
        };
    }

    // Clear all enemies from the grid
    clearGrid(): void {
        for (let x = 0; x < this.grid.gridWidth; x++) {
            for (let y = 0; y < this.grid.gridHeight; y++) {
                const cell = this.grid.cells[x]?.[y];
                if (cell) {
                    cell.enemies.length = 0;
                }
            }
        }
    }

    // Add enemy to appropriate grid cell
    addEnemy(enemy: Enemy): void {
        const { gridX, gridY } = this.worldToGrid(enemy.x, enemy.y);
        const cell = this.grid.cells[gridX]?.[gridY];
        if (cell) {
            cell.enemies.push(enemy);
        }
    }

    // Rebuild the entire grid (call this each frame)
    rebuildGrid(enemies: Enemy[]): void {
        this.clearGrid();
        enemies.forEach((enemy) => this.addEnemy(enemy));
    }

    // Get enemies in the same cell and adjacent cells
    private getNearbyEnemies(enemy: Enemy): Enemy[] {
        const { gridX, gridY } = this.worldToGrid(enemy.x, enemy.y);
        const nearbyEnemies: Enemy[] = [];

        // Check current cell and all 8 adjacent cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const checkX = gridX + dx;
                const checkY = gridY + dy;

                // Check bounds
                if (
                    checkX >= 0 && checkX < this.grid.gridWidth &&
                    checkY >= 0 && checkY < this.grid.gridHeight
                ) {
                    const cell = this.grid.cells[checkX]?.[checkY];
                    if (cell) {
                        nearbyEnemies.push(...cell.enemies);
                    }
                }
            }
        }

        return nearbyEnemies;
    }

    // Check collision between two circular enemies
    private checkCircleCollision(enemy1: Enemy, enemy2: Enemy): boolean {
        if (enemy1.id === enemy2.id) return false;

        const dx = enemy1.x - enemy2.x;
        const dy = enemy1.y - enemy2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (enemy1.width + enemy2.width) / 2;

        return distance < minDistance;
    }

    // Separate two overlapping enemies
    private separateEnemies(enemy1: Enemy, enemy2: Enemy): void {
        const dx = enemy1.x - enemy2.x;
        const dy = enemy1.y - enemy2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            // If enemies are exactly on top of each other, separate them randomly
            const angle = Math.random() * Math.PI * 2;
            enemy1.x += Math.cos(angle) * 2;
            enemy1.y += Math.sin(angle) * 2;
            enemy2.x -= Math.cos(angle) * 2;
            enemy2.y -= Math.sin(angle) * 2;
            return;
        }

        const minDistance = (enemy1.width + enemy2.width) / 2;
        const overlap = minDistance - distance;

        if (overlap > 0) {
            // Normalize direction vector
            const separationX = (dx / distance) * overlap * 0.5;
            const separationY = (dy / distance) * overlap * 0.5;

            // Move enemies apart (each moves half the overlap distance)
            enemy1.x += separationX;
            enemy1.y += separationY;
            enemy2.x -= separationX;
            enemy2.y -= separationY;

            // Keep enemies within world bounds
            this.clampToWorldBounds(enemy1);
            this.clampToWorldBounds(enemy2);
        }
    }

    // Ensure enemy stays within world bounds
    private clampToWorldBounds(enemy: Enemy): void {
        const halfWidth = enemy.width / 2;
        const halfHeight = enemy.height / 2;

        enemy.x = Math.max(
            halfWidth,
            Math.min(this.grid.worldWidth - halfWidth, enemy.x),
        );
        enemy.y = Math.max(
            halfHeight,
            Math.min(this.grid.worldHeight - halfHeight, enemy.y),
        );
    }

    // Process all collisions for all enemies
    processCollisions(enemies: Enemy[]): void {
        this.rebuildGrid(enemies);

        for (const enemy of enemies) {
            const nearbyEnemies = this.getNearbyEnemies(enemy);

            for (const otherEnemy of nearbyEnemies) {
                if (this.checkCircleCollision(enemy, otherEnemy)) {
                    this.separateEnemies(enemy, otherEnemy);
                }
            }
        }
    }

    // Update world dimensions if needed (for dynamic world sizing)
    updateWorldDimensions(worldWidth: number, worldHeight: number): void {
        if (
            worldWidth !== this.grid.worldWidth ||
            worldHeight !== this.grid.worldHeight
        ) {
            this.grid.worldWidth = worldWidth;
            this.grid.worldHeight = worldHeight;
            this.grid.gridWidth = Math.ceil(worldWidth / this.grid.cellSize);
            this.grid.gridHeight = Math.ceil(worldHeight / this.grid.cellSize);

            // Reinitialize grid with new dimensions
            this.initializeGrid();
        }
    }

    // Get debug info about the grid (for development/debugging)
    getDebugInfo(): {
        totalCells: number;
        occupiedCells: number;
        maxEnemiesInCell: number;
    } {
        let occupiedCells = 0;
        let maxEnemiesInCell = 0;

        for (let x = 0; x < this.grid.gridWidth; x++) {
            for (let y = 0; y < this.grid.gridHeight; y++) {
                const cell = this.grid.cells[x]?.[y];
                if (cell) {
                    const enemyCount = cell.enemies.length;
                    if (enemyCount > 0) {
                        occupiedCells++;
                        maxEnemiesInCell = Math.max(
                            maxEnemiesInCell,
                            enemyCount,
                        );
                    }
                }
            }
        }

        return {
            totalCells: this.grid.gridWidth * this.grid.gridHeight,
            occupiedCells,
            maxEnemiesInCell,
        };
    }
}

// --- XP and Leveling Functions ---

/**
 * Calculate XP required for a specific level
 * Uses a scaling formula: 100 * level^1.2 for smooth progression
 */
function getXpRequiredForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(100 * Math.pow(level, 1.2));
}

/**
 * Get base XP value for different enemy types
 */
function getEnemyXpValue(enemyType: EnemyType): number {
    const xpValues = {
        [EnemyType.BASIC]: 10,
        [EnemyType.FAST]: 15,
        [EnemyType.SHOOTER]: 20,
        [EnemyType.TANK]: 25,
        [EnemyType.ELITE]: 40,
    };
    return xpValues[enemyType] || 10;
}

/**
 * Calculate actual XP gained from killing an enemy with multiplier
 * Multiplier is floored to int for XP calculation but tracked as float
 */
function calculateXpGained(enemyType: EnemyType, multiplier: number): number {
    const baseXp = getEnemyXpValue(enemyType);
    const intMultiplier = Math.floor(multiplier);
    return baseXp * intMultiplier;
}

/**
 * Update multiplier based on kill timing
 */
function updateMultiplier(
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
        decayAmount = base *
            multFactor *
            (0.5 + 0.5 * Math.pow(t, 2) * Math.exp((t - 1) * 0.5));
    }
    const scaledDecay = decayAmount * deltaSeconds;
    return Math.max(1.0, currentMultiplier - scaledDecay);
}
/** Increases multiplier slightly on each kill, with diminishing returns */
function increaseMultiplier(
    currentMultiplier: number,
): number {
    // Fresh kill - increase multiplier with diminishing returns
    const increment = 0.1 / (1 + (currentMultiplier - 1) * 0.5); // Slower growth at higher multipliers
    return currentMultiplier + increment;
}
/**
 * Check if player should level up and return new level
 */
function checkLevelUp(
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

export {
    calculateUpgradeCost,
    calculateXpGained,
    checkLevelUp,
    CollisionSystem,
    createWeaponCopy,
    enemyTemplates,
    getDifficultyLevel,
    getEnemyXpValue,
    getWaveNumber,
    getXpRequiredForLevel,
    increaseMultiplier,
    scaleEnemyStats,
    selectEnemyType,
    updateMultiplier,
    weaponTemplates,
};
