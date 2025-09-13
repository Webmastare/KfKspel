/**
 * Animation types and utilities for KfKbandvagn game
 */

// Animation types
export type AnimationType = "explosion" | "click";

// Particle interface for explosion animations
export interface Particle {
    x: number;
    y: number;
    vx: number; // velocity x
    vy: number; // velocity y
    size: number;
    color: string;
    life: number; // remaining life (0-1)
    maxLife: number; // maximum life
}

// Explosion animation class
export interface ExplosionAnimation {
    row: number;
    col: number;
    type: AnimationType;
    particles: Particle[];
    active: boolean;
    duration: number;
    elapsed: number;
}

// Bullet animation interface
export interface BulletAnimation {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    currentX: number;
    currentY: number;
    progress: number; // 0-1
    active: boolean;
    speed: number;
}

// Color conversion interfaces
export interface HSL {
    h: number; // hue (0-360)
    s: number; // saturation (0-100)
    l: number; // lightness (0-100)
}

export interface RGB {
    r: number; // red (0-255)
    g: number; // green (0-255)
    b: number; // blue (0-255)
}

// Animation state manager interface
export interface AnimationState {
    explosions: ExplosionAnimation[];
    bullets: BulletAnimation[];
    lastUpdate: number;
}
/**
 * Convert RGB to HSL color space
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        // Achromatic (no color)
        return { h: 0, s: 0, l: l * 100 };
    }

    const delta = max - min;
    const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    let h: number;
    switch (max) {
        case r:
            h = (g - b) / delta + (g < b ? 6 : 0);
            break;
        case g:
            h = (b - r) / delta + 2;
            break;
        case b:
            h = (r - g) / delta + 4;
            break;
        default:
            h = 0;
    }

    h /= 6;
    return {
        h: h * 360,
        s: s * 100,
        l: l * 100,
    };
}

/**
 * Convert HSL to RGB color space
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
    h /= 360;
    s /= 100;
    l /= 100;

    const hueToRgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r = hueToRgb(p, q, h + 1 / 3);
    const g = hueToRgb(p, q, h);
    const b = hueToRgb(p, q, h - 1 / 3);

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result && result[1] && result[2] && result[3]
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

/**
 * Create explosion animation
 */
export function createExplosion(
    row: number,
    col: number,
    type: AnimationType = "explosion",
): ExplosionAnimation {
    const particles: Particle[] = [];
    const particleCount = type === "explosion" ? 20 : 10;

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: 0,
            y: 0,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 4 + 2,
            color: type === "explosion" ? "#ff4444" : "#44ff44",
            life: 1,
            maxLife: Math.random() * 0.5 + 0.5,
        });
    }

    return {
        row,
        col,
        type,
        particles,
        active: true,
        duration: 1000, // 1 second
        elapsed: 0,
    };
}

/**
 * Create bullet animation
 */
export function createBullet(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    speed: number = 0.05,
): BulletAnimation {
    return {
        startX,
        startY,
        endX,
        endY,
        currentX: startX,
        currentY: startY,
        progress: 0,
        active: true,
        speed,
    };
}

/**
 * Update explosion animation
 */
export function updateExplosion(
    explosion: ExplosionAnimation,
    deltaTime: number,
): ExplosionAnimation {
    if (!explosion.active) return explosion;

    explosion.elapsed += deltaTime;

    // Update particles
    explosion.particles.forEach((particle) => {
        particle.x += particle.vx * deltaTime * 0.001;
        particle.y += particle.vy * deltaTime * 0.001;
        particle.life -= deltaTime / (particle.maxLife * 1000);

        // Add gravity effect
        particle.vy += 0.001 * deltaTime;
    });

    // Filter out dead particles
    explosion.particles = explosion.particles.filter((p) => p.life > 0);

    // Check if animation is complete
    if (
        explosion.elapsed >= explosion.duration ||
        explosion.particles.length === 0
    ) {
        explosion.active = false;
    }

    return explosion;
}

/**
 * Update bullet animation
 */
export function updateBullet(
    bullet: BulletAnimation,
    deltaTime: number,
): BulletAnimation {
    if (!bullet.active) return bullet;

    bullet.progress += bullet.speed * deltaTime * 0.01;

    if (bullet.progress >= 1) {
        bullet.progress = 1;
        bullet.active = false;
    }

    // Linear interpolation
    bullet.currentX = bullet.startX +
        (bullet.endX - bullet.startX) * bullet.progress;
    bullet.currentY = bullet.startY +
        (bullet.endY - bullet.startY) * bullet.progress;

    return bullet;
}

/**
 * Create initial animation state
 */
export function createAnimationState(): AnimationState {
    return {
        explosions: [],
        bullets: [],
        lastUpdate: performance.now(),
    };
}

/**
 * Update all animations
 */
export function updateAnimations(
    state: AnimationState,
    currentTime: number = performance.now(),
): AnimationState {
    const deltaTime = currentTime - state.lastUpdate;

    // Update explosions
    state.explosions = state.explosions
        .map((explosion) => updateExplosion(explosion, deltaTime))
        .filter((explosion) => explosion.active);

    // Update bullets
    state.bullets = state.bullets
        .map((bullet) => updateBullet(bullet, deltaTime))
        .filter((bullet) => bullet.active);

    state.lastUpdate = currentTime;

    return state;
}

/**
 * Add explosion to animation state
 */
export function addExplosion(
    state: AnimationState,
    row: number,
    col: number,
    type: AnimationType = "explosion",
): AnimationState {
    state.explosions.push(createExplosion(row, col, type));
    return state;
}

/**
 * Add bullet to animation state
 */
export function addBullet(
    state: AnimationState,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    speed: number = 0.05,
): AnimationState {
    state.bullets.push(createBullet(startX, startY, endX, endY, speed));
    return state;
}

/**
 * Clear all animations
 */
export function clearAnimations(state: AnimationState): AnimationState {
    state.explosions = [];
    state.bullets = [];
    return state;
}
