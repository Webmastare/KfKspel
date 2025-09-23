/**
 * Animation types and utilities for KfKbandvagn game
 */

// Animation types
export type AnimationType = "explosion" | "click" | "move";

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
    onComplete?: () => void; // Callback when explosion finishes
}

export interface ClickAnimation {
    row: number;
    col: number;
    type: AnimationType;
    particles: Particle[];
    active: boolean;
    duration: number;
    elapsed: number;
    rippleRadius: number;
    rippleMaxRadius: number;
    rippleAlpha: number;
    playerColor: string;
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
    onComplete?: () => void; // Callback when bullet reaches target
}

// Tank movement animation interface
export interface TankMoveAnimation {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    currentRow: number;
    currentCol: number;
    tankUuid: string; // Which tank is moving
    phase: "row" | "col"; // Current movement phase (row first, then column)
    progress: number; // 0-1 progress for current phase
    active: boolean;
    speed: number; // cells per second
    onComplete?: () => void; // Callback when movement finishes
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
    clicks: ClickAnimation[];
    tankMoves: TankMoveAnimation[];
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
 * Create explosion animation with yellow, red, orange, and black colors
 */
export function createExplosion(
    row: number,
    col: number,
    cellSize: number,
    type: AnimationType = "explosion",
    onComplete?: () => void,
): ExplosionAnimation {
    const particles: Particle[] = [];
    const particleCount = type === "explosion" ? 25 : 10;
    const explosionColors = [
        "#FFD700",
        "#FF4500",
        "#FF6347",
        "#DC143C",
        "#8B0000",
        "#000000",
    ]; // Gold, OrangeRed, Tomato, Crimson, DarkRed, Black

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = cellSize * (0.07 + Math.random() * 0.16);

        particles.push({
            x: 0, // Will be set to cell center when drawing
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.max(
                2,
                cellSize * 0.08 + Math.random() * (cellSize * 0.06),
            ),
            color: explosionColors[
                Math.floor(Math.random() * explosionColors.length)
            ] || "#FF4500",
            life: 1,
            maxLife: 400 + Math.random() * 300,
        });
    }

    const explosion: ExplosionAnimation = {
        row,
        col,
        type,
        particles,
        active: true,
        duration: 800, // 0.8 seconds
        elapsed: 0,
    };

    if (onComplete) {
        explosion.onComplete = onComplete;
    }

    return explosion;
}

/**
 * Create click animation with player color (ripple + particles)
 */
export function createClickAnimation(
    row: number,
    col: number,
    cellSize: number,
    playerColor: string,
    type: AnimationType = "click",
): ClickAnimation {
    const particles: Particle[] = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 +
            (Math.random() - 0.5) * 0.5;
        const speed = cellSize * (0.06 + Math.random() * 0.16);

        particles.push({
            x: 0, // Will be set to cell center when drawing
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.max(
                1.5,
                cellSize * 0.06 + Math.random() * (cellSize * 0.04),
            ),
            color: playerColor,
            life: 1,
            maxLife: 300 + Math.random() * 250,
        });
    }

    return {
        row,
        col,
        type,
        particles,
        active: true,
        duration: 350,
        elapsed: 0,
        rippleRadius: 0,
        rippleMaxRadius: Math.max(cellSize * 0.9, 14),
        rippleAlpha: 1,
        playerColor,
    };
}
export function createBullet(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    onComplete?: () => void,
): BulletAnimation {
    // Calculate distance to ensure constant speed regardless of distance
    const distance = Math.sqrt(
        Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2),
    );
    // Normalize speed: higher distances get lower speed values to maintain constant visual speed
    const baseSpeed = 12.0; // Base speed constant for consistent bullet travel time
    const normalizedSpeed = baseSpeed / Math.max(1, distance);

    const bullet: BulletAnimation = {
        startX,
        startY,
        endX,
        endY,
        currentX: startX,
        currentY: startY,
        progress: 0,
        active: true,
        speed: normalizedSpeed,
    };

    if (onComplete) {
        bullet.onComplete = onComplete;
    }

    return bullet;
}

/**
 * Create tank move animation with Manhattan-style movement (row first, then column)
 */
export function createTankMove(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    tankUuid: string,
    speed: number = 2.0, // cells per second
    onComplete?: () => void,
): TankMoveAnimation {
    const move: TankMoveAnimation = {
        startRow,
        startCol,
        endRow,
        endCol,
        currentRow: startRow,
        currentCol: startCol,
        tankUuid,
        phase: startRow !== endRow ? "row" : "col", // Start with row if row needs changing
        progress: 0,
        active: true,
        speed,
    };

    if (onComplete) {
        move.onComplete = onComplete;
    }

    return move;
}

/**
 * Update explosion animation
 */
export function updateExplosion(
    explosion: ExplosionAnimation,
    deltaTime: number,
): ExplosionAnimation {
    if (!explosion.active) return explosion;

    const wasActive = explosion.active;
    explosion.elapsed += deltaTime;

    // Update particles
    explosion.particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= deltaTime / particle.maxLife;

        // Add gravity effect for explosion
        particle.vy += 0.001 * deltaTime;
        // Add air resistance
        particle.vx *= 0.98;
        particle.vy *= 0.98;
    });

    // Filter out dead particles
    explosion.particles = explosion.particles.filter((p) => p.life > 0);

    // Check if animation is complete
    if (
        explosion.elapsed >= explosion.duration ||
        explosion.particles.length === 0
    ) {
        explosion.active = false;

        // Call completion callback if this explosion just finished
        if (wasActive && explosion.onComplete) {
            explosion.onComplete();
        }
    }

    return explosion;
}

/**
 * Update click animation
 */
export function updateClickAnimation(
    click: ClickAnimation,
    deltaTime: number,
): ClickAnimation {
    if (!click.active) return click;

    click.elapsed += deltaTime;
    const progress = click.elapsed / click.duration;

    if (progress >= 1) {
        click.active = false;
        return click;
    }

    // Update ripple
    const ease = 1 - Math.pow(1 - progress, 3);
    click.rippleRadius = ease * click.rippleMaxRadius;
    click.rippleAlpha = 1 - ease;

    // Update particles
    click.particles.forEach((particle) => {
        particle.life -= deltaTime / particle.maxLife;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
    });

    // Filter out dead particles
    click.particles = click.particles.filter((p) => p.life > 0);

    return click;
}
export function updateBullet(
    bullet: BulletAnimation,
    deltaTime: number,
): BulletAnimation {
    if (!bullet.active) return bullet;

    const wasComplete = bullet.progress >= 1;
    bullet.progress += bullet.speed * deltaTime * 0.01;

    if (bullet.progress >= 1) {
        bullet.progress = 1;
        bullet.active = false;

        // Call completion callback if this bullet just finished
        if (!wasComplete && bullet.onComplete) {
            bullet.onComplete();
        }
    }

    // Linear interpolation
    bullet.currentX = bullet.startX +
        (bullet.endX - bullet.startX) * bullet.progress;
    bullet.currentY = bullet.startY +
        (bullet.endY - bullet.startY) * bullet.progress;

    return bullet;
}

/**
 * Update tank move animation with Manhattan-style movement
 */
export function updateTankMove(
    move: TankMoveAnimation,
    deltaTime: number,
): TankMoveAnimation {
    if (!move.active) return move;

    const wasComplete = move.progress >= 1 && move.phase === "col" &&
        move.currentRow === move.endRow;

    // Calculate progress increment based on speed (cells per second)
    const speedMultiplier = move.speed * deltaTime * 0.001; // Convert to cells per millisecond

    if (move.phase === "row") {
        // Moving along row first
        const rowDistance = Math.abs(move.endRow - move.startRow);
        if (rowDistance === 0) {
            // No row movement needed, switch to column phase
            move.phase = "col";
            move.progress = 0;
        } else {
            move.progress += speedMultiplier / rowDistance;

            if (move.progress >= 1) {
                move.progress = 1;
                move.currentRow = move.endRow;

                // Check if we need column movement
                if (move.endCol !== move.startCol) {
                    move.phase = "col";
                    move.progress = 0;
                } else {
                    // Movement complete
                    move.active = false;
                    if (move.onComplete) {
                        move.onComplete();
                    }
                }
            } else {
                // Interpolate row position
                move.currentRow = move.startRow +
                    (move.endRow - move.startRow) * move.progress;
            }
        }
    } else if (move.phase === "col") {
        // Moving along column
        const colDistance = Math.abs(move.endCol - move.startCol);
        if (colDistance === 0) {
            // No column movement needed, complete
            move.active = false;
            if (move.onComplete) {
                move.onComplete();
            }
        } else {
            move.progress += speedMultiplier / colDistance;

            if (move.progress >= 1) {
                move.progress = 1;
                move.currentCol = move.endCol;
                move.active = false;

                // Movement complete
                if (move.onComplete) {
                    move.onComplete();
                }
            } else {
                // Interpolate column position
                move.currentCol = move.startCol +
                    (move.endCol - move.startCol) * move.progress;
            }
        }
    }

    return move;
}

/**
 * Create initial animation state
 */
export function createAnimationState(): AnimationState {
    return {
        explosions: [],
        bullets: [],
        clicks: [],
        tankMoves: [],
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

    // Update clicks
    state.clicks = state.clicks
        .map((click) => updateClickAnimation(click, deltaTime))
        .filter((click) => click.active);

    // Update bullets
    state.bullets = state.bullets
        .map((bullet) => updateBullet(bullet, deltaTime))
        .filter((bullet) => bullet.active);

    // Update tank movements
    state.tankMoves = state.tankMoves
        .map((move) => updateTankMove(move, deltaTime))
        .filter((move) => move.active);

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
    cellSize: number,
    type: AnimationType = "explosion",
    onComplete?: () => void,
): AnimationState {
    // Reset lastUpdate if this is the first animation being added to an empty state
    if (!hasActiveAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.explosions.push(
        createExplosion(row, col, cellSize, type, onComplete),
    );
    return state;
}

/**
 * Add click animation to animation state
 */
export function addClickAnimation(
    state: AnimationState,
    row: number,
    col: number,
    cellSize: number,
    playerColor: string,
): AnimationState {
    // Reset lastUpdate if this is the first animation being added to an empty state
    if (!hasActiveAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.clicks.push(createClickAnimation(row, col, cellSize, playerColor));
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
    onComplete?: () => void,
): AnimationState {
    // Reset lastUpdate if this is the first animation being added to an empty state
    if (!hasActiveAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.bullets.push(
        createBullet(startX, startY, endX, endY, onComplete),
    );
    return state;
}

/**
 * Add tank move to animation state
 */
export function addTankMove(
    state: AnimationState,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    tankUuid: string,
    speed: number = 2.0,
    onComplete?: () => void,
): AnimationState {
    // Reset lastUpdate if this is the first animation being added to an empty state
    if (!hasActiveAnimations(state)) {
        state.lastUpdate = performance.now();
    }

    state.tankMoves.push(
        createTankMove(
            startRow,
            startCol,
            endRow,
            endCol,
            tankUuid,
            speed,
            onComplete,
        ),
    );
    return state;
}

/**
 * Check if any animations are active
 */
export function hasActiveAnimations(state: AnimationState): boolean {
    return state.explosions.length > 0 || state.bullets.length > 0 ||
        state.clicks.length > 0 || state.tankMoves.length > 0;
}

/**
 * Render animations on canvas context
 */
export function renderAnimations(
    ctx: CanvasRenderingContext2D,
    state: AnimationState,
    cellSize: number,
    zoom: number,
    panX: number,
    panY: number,
): void {
    // Render explosions
    state.explosions.forEach((explosion) => {
        const centerX = (explosion.col + 0.5) * cellSize;
        const centerY = (explosion.row + 0.5) * cellSize;

        explosion.particles.forEach((particle) => {
            const px = centerX + particle.x;
            const py = centerY + particle.y;

            // Transform to screen coordinates
            const sx = (px + panX) * zoom;
            const sy = (py + panY) * zoom;
            const size = particle.size * zoom * (0.85 + 0.35 * particle.life);

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, particle.life));
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    });

    // Render clicks
    state.clicks.forEach((click) => {
        const centerX = (click.col + 0.5) * cellSize;
        const centerY = (click.row + 0.5) * cellSize;

        // Render ripple
        if (click.rippleAlpha > 0) {
            const sx = (centerX + panX) * zoom;
            const sy = (centerY + panY) * zoom;
            const r = click.rippleRadius * zoom;

            ctx.save();
            ctx.strokeStyle = `rgba(224, 59, 75, ${
                Math.max(0, Math.min(0.9, click.rippleAlpha))
            })`;
            ctx.lineWidth = Math.max(1, (click.rippleAlpha) * 4);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Render particles
        click.particles.forEach((particle) => {
            const px = centerX + particle.x;
            const py = centerY + particle.y;

            // Transform to screen coordinates
            const sx = (px + panX) * zoom;
            const sy = (py + panY) * zoom;
            const size = particle.size * zoom * (0.85 + 0.35 * particle.life);

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, particle.life));
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    });

    // Render bullets
    state.bullets.forEach((bullet) => {
        const sx = (bullet.currentX + panX) * zoom;
        const sy = (bullet.currentY + panY) * zoom;
        const size = Math.max(2, cellSize * 0.1) * zoom;

        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Note: Tank movements are not rendered here directly.
    // Instead, tanks with active movement animations should use
    // their animated position (currentRow/currentCol) when being
    // drawn in the main rendering loop.
}

/**
 * Get animated position for a tank if it has an active move animation
 */
export function getTankAnimatedPosition(
    state: AnimationState,
    tankUuid: string,
): { row: number; col: number } | null {
    const move = state.tankMoves.find((m) =>
        m.tankUuid === tankUuid && m.active
    );
    if (!move) return null;

    return {
        row: move.currentRow,
        col: move.currentCol,
    };
}
