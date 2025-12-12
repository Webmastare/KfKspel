interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    angle: number;
}

interface Player extends GameObject {
    health: number;
    maxHealth: number;
    currentWeapon: Weapon; // Remove null since we'll always have a weapon
    upgrades: Record<string, Upgrade>;
    money: number;
    ownedWeapons: Record<string, Weapon>;
}

interface Upgrade {
    name: string;
    cost: number;
    endsAt?: number;
}

interface Weapon {
    name: string;
    cost: number;
    damage: number;
    fireRate: number; // shots per second
    penetration: number;
    lastShotTime: number;
    range: number;
    bulletSpeed: number;
    bulletSize: number;
}

interface Bullet extends GameObject {
    id: number;
    damage: number;
    penetrationLeft: number;
    targetX: number;
    targetY: number;
    createdAt: number;
}

interface Enemy extends GameObject {
    id: number;
    health: number;
    maxHealth: number;
    damage: number;
}

interface Camera {
    x: number;
    y: number;
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
}

export type {
    Bullet,
    Camera,
    Enemy,
    GameObject,
    GameState,
    Player,
    Upgrade,
    Weapon,
};
