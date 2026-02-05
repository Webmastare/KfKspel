// Core position and rendering data
export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

// Base object with position, size, movement
export interface GameObject extends Position, Size {
    speed: number;
    angle: number;
}

// Game state - main controller
export interface GameState {
    game_width: number;
    game_height: number;
    world_width: number;
    world_height: number;
    running: boolean;
    paused: boolean;
    score: number;
    lastTime: number;
    frameId: number | null;
    enemiesKilled: number;
    baseEnemySpawnInterval: number;
    camera: Position;
    difficulty: number;
    waveNumber: number;
    xpMultiplier: number;
    lastKillTime: number;
    autofireMode: boolean;
    manualFireMode: boolean;
    mouseWorldX: number;
    mouseWorldY: number;
    isFireKeyPressed: boolean;
}

// Simplified Player interface
export interface Player extends GameObject {
    health: number;
    maxHealth: number;
    currentWeapon: Weapon;
    money: number;
    ownedWeapons: Record<string, Weapon>;
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
}

// Simplified Weapon interface - merged BulletConfig properties directly
export interface Weapon {
    name: string;
    cost: number;
    fireRate: number;
    penetration: number;
    lastShotTime: number;
    range: number;
    levelRequired: number;
    weaponType: "single" | "shotgun";
    // Bullet properties (merged from BulletConfig)
    bulletSpeed: number;
    bulletSize: number;
    bulletDamage: number;
    bulletColor: string;
    // Optional shotgun properties
    bulletCount?: number;
    spread?: number;
    // Animation properties
    particleCount?: number;
    explosionRadius?: number;
    trailLength?: number;
}

// Simplified Bullet interface - extends GameObject with bullet-specific data
export interface Bullet extends GameObject {
    id: number;
    damage: number;
    penetrationLeft: number;
    targetX: number;
    targetY: number;
    createdAt: number;
    color: string;
    particleCount: number;
    explosionRadius: number;
    trailLength: number;
}

//######## ENEMIES ######################
export enum EnemyType {
    BASIC = "basic",
    FAST = "fast",
    TANK = "tank",
    SHOOTER = "shooter",
    ELITE = "elite",
}

// Simplified Enemy - merged template properties directly
export interface Enemy extends GameObject {
    id: number;
    type: EnemyType;
    health: number;
    maxHealth: number;
    damage: number;
    value: number;
    color: string;
    borderColor: string;
    // Optional shooting properties
    lastShotTime?: number;
    range?: number;
    fireRate?: number;
    bulletSpeed?: number;
}

// Enemy bullet interface
export interface EnemyBullet extends GameObject {
    id: number;
    damage: number;
    createdAt: number;
}

// ######## POWERUPS ######################
export enum PowerupType {
    HEALTH_PACK = "health_pack",
    DAMAGE_BOOST = "damage_boost",
    SPEED_BOOST = "speed_boost",
    FIRE_RATE_BOOST = "fire_rate_boost",
    SHIELD = "shield",
    MULTISHOT = "multishot",
    PENETRATION_BOOST = "penetration_boost",
    CASH_BONUS = "cash_bonus",
}

// Powerup interface - simplified by merging effect properties
export interface Powerup extends GameObject {
    id: number;
    type: PowerupType;
    name: string;
    description: string[];
    color: string;
    glowColor: string;
    spawnTime: number;
    lifetime: number;
    effectType: "instant" | "duration";
    effectValue: number;
    effectDuration?: number; // Only for duration effects
}

// Active powerup interface
export interface ActivePowerup {
    type: PowerupType;
    effectType: "instant" | "duration";
    name: string;
    value: number;
    description: string[];
    color: string;
    remainingTime: number;
    startTime: number;
}

// ######## PLACEABLES ######################
export enum PlaceableType {
    TURRET = "turret",
    WALL = "wall",
}

// Base placeable interface
export interface Placeable extends GameObject {
    id: number;
    type: PlaceableType;
    health: number;
    maxHealth: number;
    cost: number;
    name: string;
    description: string;
    levelRequired: number;
}

// Turret-specific interface
export interface Turret extends Placeable {
    type: PlaceableType.TURRET;
    weapon: Weapon;
    lastShotTime: number;
    range: number;
    targetEnemyId: number | null;
    barrelAngle: number; // Separate angle for barrel direction (targeting)
}

// Wall-specific interface
export interface Wall extends Placeable {
    type: PlaceableType.WALL;
    blocksBullets: boolean;
    blocksPlayer: boolean;
}

// Simplified placement interfaces
export interface PlacementPreview extends Size, Position {
    type: PlaceableType;
    isValid: boolean;
    cost: number;
    template: PlaceableTemplate;
    angle: number;
}

// Simplified template for creating placeables
export interface PlaceableTemplate extends Size {
    name: string;
    type: PlaceableType;
    cost: number;
    health: number;
    levelRequired: number;
    description: string;
    // Type-specific properties
    weaponName?: string; // For turrets
    range?: number; // For turrets
    blocksBullets?: boolean; // For walls
    blocksPlayer?: boolean; // For walls
}
