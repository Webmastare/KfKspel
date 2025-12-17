interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    angle: number;
}

interface BulletConfig {
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

interface Weapon {
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

interface Player extends GameObject {
    health: number;
    maxHealth: number;
    currentWeapon: Weapon; // Remove null since we'll always have a weapon
    upgrades: Record<string, Upgrade>;
    money: number;
    ownedWeapons: Record<string, Weapon>;
    // XP System
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
}

interface Upgrade {
    name: string;
    cost: number;
    endsAt?: number;
}

interface Bullet extends GameObject {
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

interface Enemy extends GameObject {
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

interface EnemyBullet extends GameObject {
    id: number;
    damage: number;
    createdAt: number;
}

enum EnemyType {
    BASIC = "basic",
    FAST = "fast",
    TANK = "tank",
    SHOOTER = "shooter",
    ELITE = "elite",
}

interface Camera {
    x: number;
    y: number;
}

enum PowerupType {
    HEALTH_PACK = "health_pack",
    DAMAGE_BOOST = "damage_boost",
    SPEED_BOOST = "speed_boost",
    FIRE_RATE_BOOST = "fire_rate_boost",
    SHIELD = "shield",
    MULTISHOT = "multishot",
    PENETRATION_BOOST = "penetration_boost",
    CASH_BONUS = "cash_bonus",
}

interface Powerup extends GameObject {
    id: number;
    type: PowerupType;
    name: string;
    description: string;
    color: string;
    glowColor: string;
    spawnTime: number;
    lifetime: number; // How long it stays on the map (ms)
    effect: PowerupEffect;
}

interface PowerupEffect {
    type: "instant" | "duration";
    duration?: number; // For duration effects (ms)
    value: number; // Effect strength
}

interface ActivePowerup {
    type: PowerupType;
    name: string;
    description: string;
    color: string;
    remainingTime: number; // Time left in ms
    startTime: number;
}

interface GameState {
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

export type {
    ActivePowerup,
    Bullet,
    Camera,
    Enemy,
    EnemyBullet,
    GameObject,
    GameState,
    Player,
    Powerup,
    PowerupEffect,
    Upgrade,
    Weapon,
};

export { EnemyType, PowerupType };
