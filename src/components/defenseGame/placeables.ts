import type {
    Enemy,
    GameState,
    Placeable,
    PlaceableTemplate,
    PlacementPreview,
    Turret,
    Wall,
} from "./defenseTypes";
import { PlaceableType } from "./defenseTypes";
import { createWeaponCopy, weaponTemplates } from "./weapons";

// Placeable templates available for purchase
export const placeableTemplates: Record<string, PlaceableTemplate> = {
    "Basic Turret": {
        name: "Basic Turret",
        type: PlaceableType.TURRET,
        cost: 300,
        width: 40,
        height: 40,
        health: 100,
        levelRequired: 3,
        description: "Automated turret that shoots nearby enemies",
        weaponName: "Basic Gun",
        range: 250,
    },
    "Heavy Turret": {
        name: "Heavy Turret",
        type: PlaceableType.TURRET,
        cost: 800,
        width: 50,
        height: 50,
        health: 200,
        levelRequired: 8,
        description: "Powerful turret with heavy cannon",
        weaponName: "Heavy Cannon",
        range: 300,
    },
    "Rapid Turret": {
        name: "Rapid Turret",
        type: PlaceableType.TURRET,
        cost: 600,
        width: 35,
        height: 35,
        health: 80,
        levelRequired: 5,
        description: "Fast-firing turret for crowd control",
        weaponName: "Rapid Fire",
        range: 200,
    },
    "Stone Wall": {
        name: "Stone Wall",
        type: PlaceableType.WALL,
        cost: 50,
        width: 60,
        height: 20,
        health: 150,
        levelRequired: 1,
        description: "Basic wall that blocks enemy movement and bullets",
        blocksBullets: true,
        blocksPlayer: true,
    },
    "Barrier": {
        name: "Barrier",
        type: PlaceableType.WALL,
        cost: 30,
        width: 80,
        height: 15,
        health: 80,
        levelRequired: 1,
        description: "Lightweight barrier that blocks movement only",
        blocksBullets: false,
        blocksPlayer: false,
    },
    "Reinforced Wall": {
        name: "Reinforced Wall",
        type: PlaceableType.WALL,
        cost: 150,
        width: 60,
        height: 25,
        health: 400,
        levelRequired: 6,
        description: "Heavy-duty wall with high durability",
        blocksBullets: true,
        blocksPlayer: true,
    },
};

// Global placeable ID counter
let placeableIdCounter = 1;

/**
 * Create a turret from a template
 */
export function createTurret(
    template: PlaceableTemplate,
    x: number,
    y: number,
): Turret {
    if (template.type !== PlaceableType.TURRET) {
        throw new Error("Template is not a turret type");
    }

    if (!template.weaponName || !template.range) {
        throw new Error("Turret template missing weapon or range");
    }

    const weaponTemplate = weaponTemplates[template.weaponName];
    if (!weaponTemplate) {
        throw new Error(`Weapon template '${template.weaponName}' not found`);
    }

    return {
        id: placeableIdCounter++,
        type: PlaceableType.TURRET,
        x,
        y,
        width: template.width,
        height: template.height,
        speed: 0, // Turrets don't move
        angle: 0,
        health: template.health,
        maxHealth: template.health,
        cost: template.cost,
        name: template.name,
        description: template.description,
        levelRequired: template.levelRequired,
        weapon: createWeaponCopy(weaponTemplate),
        lastShotTime: 0,
        range: template.range,
        targetEnemyId: null,
    };
}

/**
 * Create a wall from a template
 */
export function createWall(
    template: PlaceableTemplate,
    x: number,
    y: number,
): Wall {
    if (template.type !== PlaceableType.WALL) {
        throw new Error("Template is not a wall type");
    }

    return {
        id: placeableIdCounter++,
        type: PlaceableType.WALL,
        x,
        y,
        width: template.width,
        height: template.height,
        speed: 0, // Walls don't move
        angle: 0,
        health: template.health,
        maxHealth: template.health,
        cost: template.cost,
        name: template.name,
        description: template.description,
        levelRequired: template.levelRequired,
        blocksBullets: template.blocksBullets ?? true,
        blocksPlayer: template.blocksPlayer ?? true,
    };
}

/**
 * Create a placeable from a template
 */
export function createPlaceable(
    template: PlaceableTemplate,
    x: number,
    y: number,
): Placeable {
    switch (template.type) {
        case PlaceableType.TURRET:
            return createTurret(template, x, y);
        case PlaceableType.WALL:
            return createWall(template, x, y);
        default:
            throw new Error(`Unknown placeable type: ${template.type}`);
    }
}

/**
 * Check if a placement position is valid
 */
export function isValidPlacement(
    template: PlaceableTemplate,
    x: number,
    y: number,
    gameState: GameState,
    existingPlaceables: Placeable[],
    player: { x: number; y: number; width: number; height: number },
): boolean {
    const halfWidth = template.width / 2;
    const halfHeight = template.height / 2;

    // Check world bounds
    if (
        x - halfWidth < 0 || x + halfWidth > gameState.world_width ||
        y - halfHeight < 0 || y + halfHeight > gameState.world_height
    ) {
        return false;
    }

    // Check overlap with existing placeables
    for (const placeable of existingPlaceables) {
        if (
            isOverlapping(
                x - halfWidth,
                y - halfHeight,
                template.width,
                template.height,
                placeable.x - placeable.width / 2,
                placeable.y - placeable.height / 2,
                placeable.width,
                placeable.height,
            )
        ) {
            return false;
        }
    }

    // Check overlap with player
    if (
        isOverlapping(
            x - halfWidth,
            y - halfHeight,
            template.width,
            template.height,
            player.x - player.width / 2,
            player.y - player.height / 2,
            player.width,
            player.height,
        )
    ) {
        return false;
    }

    return true;
}

/**
 * Check if two rectangles overlap
 */
export function isOverlapping(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number,
): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/**
 * Create a placement preview
 */
export function createPlacementPreview(
    template: PlaceableTemplate,
    mouseX: number,
    mouseY: number,
    gameState: GameState,
    existingPlaceables: Placeable[],
    player: { x: number; y: number; width: number; height: number },
): PlacementPreview {
    // Snap to grid for better placement
    const gridSize = 20;
    const snappedX = Math.round(mouseX / gridSize) * gridSize;
    const snappedY = Math.round(mouseY / gridSize) * gridSize;

    const isValid = isValidPlacement(
        template,
        snappedX,
        snappedY,
        gameState,
        existingPlaceables,
        player,
    );

    return {
        type: template.type,
        x: snappedX,
        y: snappedY,
        width: template.width,
        height: template.height,
        isValid,
        cost: template.cost,
        template,
    };
}

/**
 * Find the closest enemy within range for a turret
 */
export function findClosestEnemyInRange(
    turret: Turret,
    enemies: Enemy[],
): Enemy | null {
    let closestEnemy: Enemy | null = null;
    let closestDistance = turret.range;

    for (const enemy of enemies) {
        const dx = enemy.x - turret.x;
        const dy = enemy.y - turret.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
        }
    }

    return closestEnemy;
}

/**
 * Update turret targeting and shooting
 */
export function updateTurret(
    turret: Turret,
    enemies: Enemy[],
    timestamp: number,
): void {
    // Find target
    const target = findClosestEnemyInRange(turret, enemies);
    turret.targetEnemyId = target ? target.id : null;

    if (target) {
        // Calculate angle to target
        const dx = target.x - turret.x;
        const dy = target.y - turret.y;
        turret.angle = Math.atan2(dy, dx);
    }
}

/**
 * Damage a placeable and check if it should be destroyed
 */
export function damagePlaceable(placeable: Placeable, damage: number): boolean {
    placeable.health -= damage;
    return placeable.health <= 0;
}

/**
 * Get all placeable templates available at a given player level
 */
export function getAvailableTemplates(
    playerLevel: number,
): PlaceableTemplate[] {
    return Object.values(placeableTemplates).filter(
        (template) => template.levelRequired <= playerLevel,
    );
}

/**
 * Get templates by type
 */
export function getTemplatesByType(type: PlaceableType): PlaceableTemplate[] {
    return Object.values(placeableTemplates).filter((template) =>
        template.type === type
    );
}

/**
 * Check if a point is inside a wall (for collision detection)
 */
export function isPointInWall(x: number, y: number, wall: Wall): boolean {
    const halfWidth = wall.width / 2;
    const halfHeight = wall.height / 2;

    return x >= wall.x - halfWidth && x <= wall.x + halfWidth &&
        y >= wall.y - halfHeight && y <= wall.y + halfHeight;
}

/**
 * Check line-wall intersection for bullet collision
 */
export function checkLineWallIntersection(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    wall: Wall,
): { intersects: boolean; intersectionX?: number; intersectionY?: number } {
    if (!wall.blocksBullets) {
        return { intersects: false };
    }

    const wallLeft = wall.x - wall.width / 2;
    const wallRight = wall.x + wall.width / 2;
    const wallTop = wall.y - wall.height / 2;
    const wallBottom = wall.y + wall.height / 2;

    // Simple AABB line intersection check
    // This is a simplified version - you might want a more accurate algorithm
    const dx = endX - startX;
    const dy = endY - startY;

    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
        // Point check
        return {
            intersects: startX >= wallLeft && startX <= wallRight &&
                startY >= wallTop && startY <= wallBottom,
        };
    }

    // Check intersection with wall edges
    const tValues: number[] = [];

    if (Math.abs(dx) > 0.0001) {
        const t1 = (wallLeft - startX) / dx;
        const t2 = (wallRight - startX) / dx;
        if (t1 >= 0 && t1 <= 1) tValues.push(t1);
        if (t2 >= 0 && t2 <= 1) tValues.push(t2);
    }

    if (Math.abs(dy) > 0.0001) {
        const t1 = (wallTop - startY) / dy;
        const t2 = (wallBottom - startY) / dy;
        if (t1 >= 0 && t1 <= 1) tValues.push(t1);
        if (t2 >= 0 && t2 <= 1) tValues.push(t2);
    }

    for (const t of tValues) {
        const intersectX = startX + t * dx;
        const intersectY = startY + t * dy;

        if (
            intersectX >= wallLeft && intersectX <= wallRight &&
            intersectY >= wallTop && intersectY <= wallBottom
        ) {
            return {
                intersects: true,
                intersectionX: intersectX,
                intersectionY: intersectY,
            };
        }
    }

    return { intersects: false };
}
