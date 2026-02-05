import type { Enemy } from "./defenseTypes";

// Spatial Grid Implementation for Collision Detection

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

/**
 * Collision system using spatial grid for efficient collision detection
 */
export class CollisionSystem {
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
                    checkX >= 0 &&
                    checkX < this.grid.gridWidth &&
                    checkY >= 0 &&
                    checkY < this.grid.gridHeight
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
