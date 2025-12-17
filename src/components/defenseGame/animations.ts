/**
 * Animation system for Defense Game
 * Adapted from KfKbandvagn animations for bullet impacts and explosions
 */

// Animation types specific to defense game
export type DefenseAnimationType =
    | "bulletImpact"
    | "enemyDestroy"
    | "muzzleFlash";

// Particle interface for animations
export interface Particle {
    x: number;
    y: number;
    vx: number; // velocity x
    vy: number; // velocity y
    size: number;
    color: string;
    life: number; // remaining life (0-1)
    maxLife: number; // maximum life in milliseconds
    alpha?: number; // opacity override
}

// Bullet impact explosion animation
export interface BulletImpactAnimation {
    x: number;
    y: number;
    type: DefenseAnimationType;
    particles: Particle[];
    active: boolean;
    duration: number;
    elapsed: number;
    particleCount: number; // Actual count (normalized * multiplier)
    explosionRadius: number; // Actual radius (normalized * multiplier)
    bulletColor: string;
    onComplete?: (() => void) | undefined;
}

// Enemy destruction animation
export interface EnemyDestroyAnimation {
    x: number;
    y: number;
    type: DefenseAnimationType;
    particles: Particle[];
    active: boolean;
    duration: number;
    elapsed: number;
    enemySize: number;
    enemyColor: string;
    onComplete?: (() => void) | undefined;
}

// Muzzle flash animation
export interface MuzzleFlashAnimation {
    x: number;
    y: number;
    angle: number; // Direction of the shot
    type: DefenseAnimationType;
    particles: Particle[];
    active: boolean;
    duration: number;
    elapsed: number;
    weaponType: string;
    onComplete?: (() => void) | undefined;
}

// Animation state manager for defense game
export interface DefenseAnimationState {
    bulletImpacts: BulletImpactAnimation[];
    enemyDestroy: EnemyDestroyAnimation[];
    muzzleFlashes: MuzzleFlashAnimation[];
    lastUpdate: number;
}

/**
 * Create bullet impact animation with customizable properties
 */
export function createBulletImpact(
    x: number,
    y: number,
    normalizedParticleCount: number, // 0.5-5 range
    normalizedRadius: number, // 0.5-5 range
    bulletColor: string = "#FFD700",
    onComplete?: () => void,
): BulletImpactAnimation {
    const particles: Particle[] = [];

    // Convert normalized values to actual counts/sizes
    const actualParticleCount = Math.floor(normalizedParticleCount * 15); // 7-75 particles
    const actualRadius = normalizedRadius * 20; // 10-100 pixel radius

    // Create impact particles with weapon-specific colors
    const impactColors = [
        bulletColor,
        "#FFD700", // Gold
        "#FF4500", // OrangeRed
        "#FF6347", // Tomato
        "#DC143C", // Crimson
        "#8B0000", // DarkRed
        "#000000", // Black smoke
    ];

    for (let i = 0; i < actualParticleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = actualRadius * (0.05 + Math.random() * 0.15);
        const size = Math.max(
            1,
            actualRadius * 0.04 + Math.random() * (actualRadius * 0.03),
        );

        particles.push({
            x: 0, // Relative to impact center
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size,
            color:
                impactColors[Math.floor(Math.random() * impactColors.length)] ||
                bulletColor,
            life: 1,
            maxLife: 300 + Math.random() * 400, // 300-700ms
        });
    }

    return {
        x,
        y,
        type: "bulletImpact",
        particles,
        active: true,
        duration: 600, // 0.6 seconds
        elapsed: 0,
        particleCount: actualParticleCount,
        explosionRadius: actualRadius,
        bulletColor,
        onComplete,
    };
}

/**
 * Create enemy destruction animation
 */
export function createEnemyDestroy(
    x: number,
    y: number,
    enemySize: number,
    enemyColor: string,
    onComplete?: () => void,
): EnemyDestroyAnimation {
    const particles: Particle[] = [];
    const particleCount = Math.floor(enemySize * 0.8); // Size-based particle count

    // Enemy destruction colors (darker, smokier)
    const destroyColors = [
        enemyColor,
        "#8B0000", // DarkRed
        "#A52A2A", // Brown
        "#696969", // DimGray
        "#000000", // Black
        "#FF4500", // OrangeRed
    ];

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = enemySize * (0.1 + Math.random() * 0.2);
        const size = Math.max(
            2,
            enemySize * 0.1 + Math.random() * (enemySize * 0.05),
        );

        particles.push({
            x: 0,
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size,
            color: destroyColors[
                Math.floor(Math.random() * destroyColors.length)
            ] || enemyColor,
            life: 1,
            maxLife: 500 + Math.random() * 500, // 500-1000ms
        });
    }

    return {
        x,
        y,
        type: "enemyDestroy",
        particles,
        active: true,
        duration: 900, // 0.9 seconds
        elapsed: 0,
        enemySize,
        enemyColor,
        onComplete,
    };
}

/**
 * Create muzzle flash animation
 */
export function createMuzzleFlash(
    x: number,
    y: number,
    angle: number,
    weaponType: string,
    onComplete?: () => void,
): MuzzleFlashAnimation {
    const particles: Particle[] = [];
    const particleCount = weaponType === "shotgun" ? 12 : 8;

    // Muzzle flash colors (bright, hot colors)
    const flashColors = [
        "#FFFF00", // Yellow
        "#FFD700", // Gold
        "#FFA500", // Orange
        "#FF4500", // OrangeRed
        "#FFFFFF", // White
    ];

    for (let i = 0; i < particleCount; i++) {
        // Particles shoot forward in cone shape
        const spreadAngle = angle + (Math.random() - 0.5) * 0.5; // 30 degree spread
        const speed = 5 + Math.random() * 10;
        const size = 2 + Math.random() * 3;

        particles.push({
            x: 0,
            y: 0,
            vx: Math.cos(spreadAngle) * speed,
            vy: Math.sin(spreadAngle) * speed,
            size,
            color:
                flashColors[Math.floor(Math.random() * flashColors.length)] ||
                "#FFD700",
            life: 1,
            maxLife: 100 + Math.random() * 100, // Very short-lived 100-200ms
        });
    }

    return {
        x,
        y,
        angle,
        type: "muzzleFlash",
        particles,
        active: true,
        duration: 150, // Very quick flash
        elapsed: 0,
        weaponType,
        onComplete,
    };
}

/**
 * Update bullet impact animation
 */
export function updateBulletImpact(
    impact: BulletImpactAnimation,
    deltaTime: number,
): BulletImpactAnimation {
    if (!impact.active) return impact;

    const wasActive = impact.active;
    impact.elapsed += deltaTime;

    // Update particles with physics
    impact.particles.forEach((particle) => {
        particle.x += particle.vx * (deltaTime / 16.67); // Normalize to 60fps
        particle.y += particle.vy * (deltaTime / 16.67);
        particle.life -= deltaTime / particle.maxLife;

        // Add gravity and air resistance
        particle.vy += 0.3 * (deltaTime / 16.67); // Gravity
        particle.vx *= 0.98; // Air resistance
        particle.vy *= 0.98;
    });

    // Filter out dead particles
    impact.particles = impact.particles.filter((p) => p.life > 0);

    // Check if animation is complete
    if (impact.elapsed >= impact.duration || impact.particles.length === 0) {
        impact.active = false;

        if (wasActive && impact.onComplete) {
            impact.onComplete();
        }
    }

    return impact;
}

/**
 * Update enemy destroy animation
 */
export function updateEnemyDestroy(
    destroy: EnemyDestroyAnimation,
    deltaTime: number,
): EnemyDestroyAnimation {
    if (!destroy.active) return destroy;

    const wasActive = destroy.active;
    destroy.elapsed += deltaTime;

    // Update particles
    destroy.particles.forEach((particle) => {
        particle.x += particle.vx * (deltaTime / 16.67);
        particle.y += particle.vy * (deltaTime / 16.67);
        particle.life -= deltaTime / particle.maxLife;

        // Stronger gravity for destruction particles
        particle.vy += 0.5 * (deltaTime / 16.67);
        particle.vx *= 0.97;
        particle.vy *= 0.97;
    });

    destroy.particles = destroy.particles.filter((p) => p.life > 0);

    if (destroy.elapsed >= destroy.duration || destroy.particles.length === 0) {
        destroy.active = false;

        if (wasActive && destroy.onComplete) {
            destroy.onComplete();
        }
    }

    return destroy;
}

/**
 * Update muzzle flash animation
 */
export function updateMuzzleFlash(
    flash: MuzzleFlashAnimation,
    deltaTime: number,
): MuzzleFlashAnimation {
    if (!flash.active) return flash;

    const wasActive = flash.active;
    flash.elapsed += deltaTime;

    // Update particles (fast-moving, short-lived)
    flash.particles.forEach((particle) => {
        particle.x += particle.vx * (deltaTime / 16.67);
        particle.y += particle.vy * (deltaTime / 16.67);
        particle.life -= deltaTime / particle.maxLife;

        // Quick fade and slow down
        particle.vx *= 0.92;
        particle.vy *= 0.92;
    });

    flash.particles = flash.particles.filter((p) => p.life > 0);

    if (flash.elapsed >= flash.duration || flash.particles.length === 0) {
        flash.active = false;

        if (wasActive && flash.onComplete) {
            flash.onComplete();
        }
    }

    return flash;
}

/**
 * Create initial defense animation state
 */
export function createDefenseAnimationState(): DefenseAnimationState {
    return {
        bulletImpacts: [],
        enemyDestroy: [],
        muzzleFlashes: [],
        lastUpdate: performance.now(),
    };
}

/**
 * Update all defense animations
 */
export function updateDefenseAnimations(
    state: DefenseAnimationState,
    currentTime: number = performance.now(),
): DefenseAnimationState {
    const deltaTime = currentTime - state.lastUpdate;

    // Update bullet impacts
    state.bulletImpacts = state.bulletImpacts
        .map((impact) => updateBulletImpact(impact, deltaTime))
        .filter((impact) => impact.active);

    // Update enemy destructions
    state.enemyDestroy = state.enemyDestroy
        .map((destroy) => updateEnemyDestroy(destroy, deltaTime))
        .filter((destroy) => destroy.active);

    // Update muzzle flashes
    state.muzzleFlashes = state.muzzleFlashes
        .map((flash) => updateMuzzleFlash(flash, deltaTime))
        .filter((flash) => flash.active);

    state.lastUpdate = currentTime;
    return state;
}

/**
 * Add bullet impact to animation state
 */
export function addBulletImpact(
    state: DefenseAnimationState,
    x: number,
    y: number,
    normalizedParticleCount: number,
    normalizedRadius: number,
    bulletColor: string,
    onComplete?: () => void,
): DefenseAnimationState {
    if (!hasActiveDefenseAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.bulletImpacts.push(
        createBulletImpact(
            x,
            y,
            normalizedParticleCount,
            normalizedRadius,
            bulletColor,
            onComplete,
        ),
    );
    return state;
}

/**
 * Add enemy destroy to animation state
 */
export function addEnemyDestroy(
    state: DefenseAnimationState,
    x: number,
    y: number,
    enemySize: number,
    enemyColor: string,
    onComplete?: () => void,
): DefenseAnimationState {
    if (!hasActiveDefenseAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.enemyDestroy.push(
        createEnemyDestroy(x, y, enemySize, enemyColor, onComplete),
    );
    return state;
}

/**
 * Add muzzle flash to animation state
 */
export function addMuzzleFlash(
    state: DefenseAnimationState,
    x: number,
    y: number,
    angle: number,
    weaponType: string,
    onComplete?: () => void,
): DefenseAnimationState {
    if (!hasActiveDefenseAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.muzzleFlashes.push(
        createMuzzleFlash(x, y, angle, weaponType, onComplete),
    );
    return state;
}

/**
 * Check if any defense animations are active
 */
export function hasActiveDefenseAnimations(
    state: DefenseAnimationState,
): boolean {
    return state.bulletImpacts.length > 0 ||
        state.enemyDestroy.length > 0 ||
        state.muzzleFlashes.length > 0;
}

/**
 * Render defense animations on canvas context
 */
export function renderDefenseAnimations(
    ctx: CanvasRenderingContext2D,
    state: DefenseAnimationState,
    zoom: number = 1,
    panX: number = 0,
    panY: number = 0,
): void {
    // Render bullet impacts
    state.bulletImpacts.forEach((impact) => {
        impact.particles.forEach((particle) => {
            const px = impact.x + particle.x;
            const py = impact.y + particle.y;

            // Transform to screen coordinates
            const sx = (px - panX) * zoom;
            const sy = (py - panY) * zoom;
            const size = particle.size * zoom * (0.5 + 0.5 * particle.life);

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, particle.life));
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    });

    // Render enemy destructions
    state.enemyDestroy.forEach((destroy) => {
        destroy.particles.forEach((particle) => {
            const px = destroy.x + particle.x;
            const py = destroy.y + particle.y;

            const sx = (px - panX) * zoom;
            const sy = (py - panY) * zoom;
            const size = particle.size * zoom * (0.3 + 0.7 * particle.life);

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(0.8, particle.life));
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    });

    // Render muzzle flashes
    state.muzzleFlashes.forEach((flash) => {
        flash.particles.forEach((particle) => {
            const px = flash.x + particle.x;
            const py = flash.y + particle.y;

            const sx = (px - panX) * zoom;
            const sy = (py - panY) * zoom;
            const size = particle.size * zoom * (0.8 + 0.4 * particle.life);

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(0.9, particle.life));
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    });
}
