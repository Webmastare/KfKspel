// Core GameObject interface - shared across all game objects
export interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    angle: number;
}

// Camera interface - used in game state
export interface Camera {
    x: number;
    y: number;
}

// Game state interface - main game controller state
export interface GameState {
    game_width: number;
    game_height: number;
    world_width: number; // Larger world size
    world_height: number;
    running: boolean;
    paused: boolean;
    score: number;
    lastTime: number;
    frameId: number | null;
    enemiesKilled: number;
    baseEnemySpawnInterval: number;
    camera: Camera;
    difficulty: number;
    waveNumber: number;
    // XP Multiplier System
    xpMultiplier: number; // Float value for precise multiplier
    lastKillTime: number; // Timestamp of last enemy kill for multiplier decay
}

// Bullet configuration interface
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

// Player upgrades interface
export interface Upgrade {
    name: string;
    cost: number;
    endsAt?: number;
}

// Player interface
export interface Player extends GameObject {
    health: number;
    maxHealth: number;
    currentWeapon: Weapon;
    upgrades: Record<string, Upgrade>;
    money: number;
    ownedWeapons: Record<string, Weapon>;
    // XP System
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
}

// Weapon interface
export interface Weapon {
    name: string;
    cost: number;
    fireRate: number; // shots per second
    penetration?: number; // Optional - for weapons that pierce through enemies
    lastShotTime: number;
    range: number;
    levelRequired?: number; // Level requirement to unlock this weapon
    bullet: BulletConfig; // Bullet configuration
    // Shotgun-specific properties
    bulletCount?: number; // Number of bullets fired per shot (for shotguns)
    spread?: number; // Spread angle in degrees (for shotguns)
    weaponType?: "single" | "shotgun"; // Type of weapon for different firing logic
}

// Bullet interface
export interface Bullet extends GameObject {
    id: number;
    damage: number;
    penetrationLeft: number;
    targetX: number;
    targetY: number;
    createdAt: number;
    // Animation properties from bullet config
    particleCount: number;
    explosionRadius: number;
    color?: string;
    trailLength?: number;
}

//######## ENEMIES ######################
export enum EnemyType {
    BASIC = "basic",
    FAST = "fast",
    TANK = "tank",
    SHOOTER = "shooter",
    ELITE = "elite",
}

// Enemy interface
export interface Enemy extends GameObject {
    id: number;
    health: number;
    maxHealth: number;
    damage: number;
    type: EnemyType;
    lastShotTime?: number;
    range?: number;
    fireRate?: number;
    bulletSpeed?: number;
    value: number; // Money reward when killed
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

// Powerup effect interface
export interface PowerupEffect {
    type: "instant" | "duration";
    duration?: number; // For duration effects (ms)
    value: number; // Effect strength
}

// Powerup interface
export interface Powerup extends GameObject {
    id: number;
    type: PowerupType;
    name: string;
    description: string[];
    color: string;
    glowColor: string;
    spawnTime: number;
    lifetime: number; // How long it stays on the map (ms)
    effect: PowerupEffect;
    icon?: string | undefined; // Optional icon
}

// Active powerup interface
export interface ActivePowerup {
    type: PowerupType;
    effectType: "instant" | "duration";
    name: string;
    value: number;
    description: string[];
    color: string;
    remainingTime: number; // Time left in ms
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
}

// Wall-specific interface
export interface Wall extends Placeable {
    type: PlaceableType.WALL;
    blocksBullets: boolean; // If false, only blocks movement
    blocksPlayer: boolean; // If true, also blocks player movement
}

// Placement preview interface for shop
export interface PlacementPreview {
    type: PlaceableType;
    x: number;
    y: number;
    width: number;
    height: number;
    isValid: boolean; // Whether the placement is valid
    cost: number;
    template: PlaceableTemplate;
}

// Template interface for creating placeables
export interface PlaceableTemplate {
    name: string;
    type: PlaceableType;
    cost: number;
    width: number;
    height: number;
    health: number;
    levelRequired: number;
    description: string;
    // Turret-specific template properties
    weaponName?: string;
    range?: number;
    // Wall-specific template properties
    blocksBullets?: boolean;
    blocksPlayer?: boolean;
}
