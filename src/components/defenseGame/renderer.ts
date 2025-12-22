import {
    type Bullet,
    type Enemy,
    type EnemyBullet,
    EnemyType,
    type GameState,
    type Placeable,
    PlaceableType,
    type PlacementPreview,
    type Player,
    type Powerup,
    type Turret,
    type Wall,
} from "./defenseTypes";

import { renderDefenseAnimations } from "./animations";
import { enemyTemplates } from "./enemies";

function clearCanvas(ctx: CanvasRenderingContext2D | null, game: GameState) {
    if (!ctx) return;
    ctx.clearRect(0, 0, game.game_width, game.game_height);
}

function drawBackground(ctx: CanvasRenderingContext2D | null, game: GameState) {
    if (!ctx) return;

    // Draw game background
    ctx.fillStyle = "#1f2937"; // Dark background
    ctx.fillRect(0, 0, game.game_width, game.game_height);

    // Draw grid pattern
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    const gridSize = 40;

    // Calculate grid offset based on camera
    const offsetX = -game.camera.x % gridSize;
    const offsetY = -game.camera.y % gridSize;

    // Vertical lines
    for (let x = offsetX; x < game.game_width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, game.game_height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < game.game_height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(game.game_width, y);
        ctx.stroke();
    }
}

function drawPlayer(
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
    player: Player,
) {
    if (
        !ctx ||
        !isVisible(player.x, player.y, player.width, player.height, game)
    ) {
        return;
    }

    const screenX = player.x - game.camera.x;
    const screenY = player.y - game.camera.y;
    const halfWidth = player.width / 2;
    const halfHeight = player.height / 2;

    // Draw player and border in one operation
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 2;
    ctx.fillRect(
        screenX - halfWidth,
        screenY - halfHeight,
        player.width,
        player.height,
    );
    ctx.strokeRect(
        screenX - halfWidth,
        screenY - halfHeight,
        player.width,
        player.height,
    );

    // Draw gun range indicator (optional)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.arc(screenX, screenY, player.currentWeapon.range, 0, Math.PI * 2);
    ctx.stroke();
}

// Optimized visibility check helper
function isVisible(
    x: number,
    y: number,
    width: number,
    height: number,
    game: GameState,
): boolean {
    const screenX = x - game.camera.x;
    const screenY = y - game.camera.y;
    return !(
        screenX < -width ||
        screenX > game.game_width + width ||
        screenY < -height ||
        screenY > game.game_height + height
    );
}

function drawEnemy(
    enemy: Enemy,
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
    player: Player,
) {
    if (!ctx || !isVisible(enemy.x, enemy.y, enemy.width, enemy.height, game)) {
        return;
    }

    const screenX = enemy.x - game.camera.x;
    const screenY = enemy.y - game.camera.y;
    const halfWidth = enemy.width / 2;
    const halfHeight = enemy.height / 2;
    const template = enemyTemplates[enemy.type];

    // Draw enemy with type-specific colors
    ctx.fillStyle = template.color;
    ctx.strokeStyle = template.borderColor;
    ctx.lineWidth = enemy.type === EnemyType.ELITE
        ? 3
        : enemy.type === EnemyType.TANK
        ? 2
        : 1;
    ctx.fillRect(
        screenX - halfWidth,
        screenY - halfHeight,
        enemy.width,
        enemy.height,
    );
    ctx.strokeRect(
        screenX - halfWidth,
        screenY - halfHeight,
        enemy.width,
        enemy.height,
    );

    // Add type indicators
    if (enemy.type === EnemyType.FAST) {
        // Add speed lines for fast enemies
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX - halfWidth - 5, screenY);
        ctx.lineTo(screenX - halfWidth + 5, screenY);
        ctx.stroke();
    } else if (
        enemy.type === EnemyType.SHOOTER || enemy.type === EnemyType.ELITE
    ) {
        // Add weapon indicator for shooting enemies
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(screenX - 2, screenY - halfHeight - 4, 4, 4);

        // Add shooting state indicator for shooter enemies
        if (enemy.fireRate && enemy.lastShotTime !== undefined) {
            const now = Date.now();
            const shotInterval = 1000 / enemy.fireRate;
            const timeSinceLastShot = now - enemy.lastShotTime;
            const chargePercent = Math.min(timeSinceLastShot / shotInterval, 1);

            // Show charging indicator
            if (chargePercent < 1) {
                ctx.strokeStyle = "#ff6b6b";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(
                    screenX,
                    screenY - halfHeight - 8,
                    3,
                    0,
                    2 * Math.PI * chargePercent,
                );
                ctx.stroke();
            } else {
                // Ready to shoot - show danger indicator
                const distToPlayer = Math.sqrt(
                    Math.pow(player.x - enemy.x, 2) +
                        Math.pow(player.y - enemy.y, 2),
                );
                if (enemy.range && distToPlayer <= enemy.range) {
                    ctx.fillStyle = "#ff3333";
                    ctx.beginPath();
                    ctx.arc(
                        screenX,
                        screenY - halfHeight - 8,
                        2,
                        0,
                        2 * Math.PI,
                    );
                    ctx.fill();
                }
            }
        }
    }

    // Draw health bar efficiently
    const healthBarY = screenY - halfHeight - 10;
    const healthPercent = enemy.health / enemy.maxHealth;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(screenX - halfWidth, healthBarY, enemy.width, 6);

    // Foreground with enemy type color tint
    let healthColor = "#22c55e";
    if (healthPercent <= 0.25) healthColor = "#ef4444";
    else if (healthPercent <= 0.5) healthColor = "#eab308";

    ctx.fillStyle = healthColor;
    ctx.fillRect(
        screenX - halfWidth,
        healthBarY,
        enemy.width * healthPercent,
        6,
    );
}
function drawBullet(
    bullet: Bullet,
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
) {
    if (
        !ctx ||
        !isVisible(bullet.x, bullet.y, bullet.width, bullet.height, game)
    ) return;

    const screenX = bullet.x - game.camera.x;
    const screenY = bullet.y - game.camera.y;
    const radius = bullet.width / 2;

    // Draw player bullet with glow
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawEnemyBullet(
    bullet: EnemyBullet,
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
) {
    if (
        !ctx ||
        !isVisible(bullet.x, bullet.y, bullet.width, bullet.height, game)
    ) return;

    const screenX = bullet.x - game.camera.x;
    const screenY = bullet.y - game.camera.y;
    const radius = bullet.width / 2;

    // Draw enemy bullet with red color and glow
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawPowerup(
    powerup: Powerup,
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
) {
    if (
        !ctx ||
        !isVisible(powerup.x, powerup.y, powerup.width, powerup.height, game)
    ) return;

    const screenX = powerup.x - game.camera.x;
    const screenY = powerup.y - game.camera.y;
    const radius = powerup.width / 2;

    // Pulsing glow effect based on time
    const time = Date.now() / 1000;
    const pulseIntensity = 0.8 + 0.4 * Math.sin(time * 3);

    // Outer glow
    const glowSize = radius * (1.5 + 0.3 * Math.sin(time * 2));
    ctx.save();
    ctx.globalAlpha = 0.3 * pulseIntensity;
    ctx.fillStyle = powerup.glowColor;
    ctx.shadowColor = powerup.glowColor;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(screenX, screenY, glowSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Main powerup sphere
    ctx.fillStyle = powerup.color;
    ctx.shadowColor = powerup.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bright center highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(screenX - 2, screenY - 2, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Draw an arc around the powerup to indicate time before despawn
    const despawnTime = powerup.spawnTime + powerup.lifetime;
    const timeLeft = despawnTime - Date.now();
    if (timeLeft > 0) {
        const despawnPercent = timeLeft / powerup.lifetime;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            screenX,
            screenY,
            radius + 4,
            -Math.PI / 2,
            -Math.PI / 2 + despawnPercent * Math.PI * 2,
        );
        ctx.stroke();
    }

    // Draw powerup icon
    if (powerup.icon) {
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "16px Arial";
        ctx.fillText(powerup.icon, screenX, screenY);
    }
}

function drawMinimap(
    minimapCtx: CanvasRenderingContext2D | null,
    game: GameState,
    player: Player,
    enemies: Enemy[],
    powerups: Powerup[],
    bullets: Bullet[],
    enemyBullets: EnemyBullet[],
) {
    if (!minimapCtx) return;

    const minimapWidth = 120;
    const minimapHeight = 90;

    // Scale factors to convert world coordinates to minimap coordinates
    const scaleX = minimapWidth / game.world_width;
    const scaleY = minimapHeight / game.world_height;

    // Clear minimap
    minimapCtx.clearRect(0, 0, minimapWidth, minimapHeight);

    // Draw world boundary
    minimapCtx.strokeStyle = "#666";
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, minimapWidth, minimapHeight);

    // Draw current camera view as a rectangle
    const cameraX = game.camera.x * scaleX;
    const cameraY = game.camera.y * scaleY;
    const cameraWidth = game.game_width * scaleX;
    const cameraHeight = game.game_height * scaleY;

    minimapCtx.strokeStyle = "#4a90e2";
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(cameraX, cameraY, cameraWidth, cameraHeight);

    // Draw player as a blue dot
    const playerX = player.x * scaleX;
    const playerY = player.y * scaleY;

    minimapCtx.fillStyle = "#00ff00"; // Green for player
    minimapCtx.beginPath();
    minimapCtx.arc(playerX, playerY, 2, 0, Math.PI * 2);
    minimapCtx.fill();

    // Draw enemies as red dots
    minimapCtx.fillStyle = "#ff4444"; // Red for enemies
    enemies.forEach((enemy) => {
        if (!minimapCtx) return;
        const enemyX = enemy.x * scaleX;
        const enemyY = enemy.y * scaleY;

        minimapCtx.beginPath();
        minimapCtx.arc(enemyX, enemyY, 1, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // Draw powerups as glowing colored dots
    powerups.forEach((powerup) => {
        if (!minimapCtx) return;
        const powerupX = powerup.x * scaleX;
        const powerupY = powerup.y * scaleY;

        // Set color based on powerup type
        minimapCtx.fillStyle = powerup.color;
        minimapCtx.beginPath();
        minimapCtx.arc(powerupX, powerupY, 1.5, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // Draw bullets as tiny dots (optional, might be too cluttered)
    if (bullets.length + enemyBullets.length < 50) {
        // Player bullets - yellow
        minimapCtx.fillStyle = "#fbbf24";
        bullets.forEach((bullet) => {
            if (!minimapCtx) return;
            const bulletX = bullet.x * scaleX;
            const bulletY = bullet.y * scaleY;
            minimapCtx.beginPath();
            minimapCtx.arc(bulletX, bulletY, 0.5, 0, Math.PI * 2);
            minimapCtx.fill();
        });

        // Enemy bullets - red
        minimapCtx.fillStyle = "#ef4444";
        enemyBullets.forEach((bullet) => {
            if (!minimapCtx) return;
            const bulletX = bullet.x * scaleX;
            const bulletY = bullet.y * scaleY;
            minimapCtx.beginPath();
            minimapCtx.arc(bulletX, bulletY, 0.5, 0, Math.PI * 2);
            minimapCtx.fill();
        });
    }
}

function drawPlaceable(
    placeable: Placeable,
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
) {
    if (
        !ctx ||
        !isVisible(
            placeable.x,
            placeable.y,
            placeable.width,
            placeable.height,
            game,
        )
    ) return;

    const screenX = placeable.x - game.camera.x;
    const screenY = placeable.y - game.camera.y;
    const halfWidth = placeable.width / 2;
    const halfHeight = placeable.height / 2;

    if (placeable.type === PlaceableType.TURRET) {
        const turret = placeable as Turret;

        // Draw turret body
        ctx.fillStyle = "#4a6aa6";
        ctx.strokeStyle = "#2a4a6a";
        ctx.lineWidth = 2;
        ctx.fillRect(
            screenX - halfWidth,
            screenY - halfHeight,
            placeable.width,
            placeable.height,
        );
        ctx.strokeRect(
            screenX - halfWidth,
            screenY - halfHeight,
            placeable.width,
            placeable.height,
        );

        // Draw turret gun barrel pointing at target
        const barrelLength = 20;
        const barrelEndX = screenX + Math.cos(turret.angle) * barrelLength;
        const barrelEndY = screenY + Math.sin(turret.angle) * barrelLength;

        ctx.strokeStyle = "#666";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(barrelEndX, barrelEndY);
        ctx.stroke();

        // Draw range indicator (faded circle)
        ctx.strokeStyle = "rgba(74, 106, 166, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screenX, screenY, turret.range, 0, Math.PI * 2);
        ctx.stroke();
    } else if (placeable.type === PlaceableType.WALL) {
        const wall = placeable as Wall;

        // Draw wall
        ctx.fillStyle = wall.blocksBullets ? "#8B4513" : "#A0522D"; // Brown for bullet-blocking, lighter for movement-only
        ctx.strokeStyle = "#654321";
        ctx.lineWidth = 2;
        ctx.fillRect(
            screenX - halfWidth,
            screenY - halfHeight,
            placeable.width,
            placeable.height,
        );
        ctx.strokeRect(
            screenX - halfWidth,
            screenY - halfHeight,
            placeable.width,
            placeable.height,
        );

        // Add texture lines for walls
        ctx.strokeStyle = "#543A21";
        ctx.lineWidth = 1;
        for (let i = 0; i < placeable.width; i += 10) {
            ctx.beginPath();
            ctx.moveTo(screenX - halfWidth + i, screenY - halfHeight);
            ctx.lineTo(screenX - halfWidth + i, screenY + halfHeight);
            ctx.stroke();
        }
    }

    // Draw health bar
    const healthBarY = screenY - halfHeight - 10;
    const healthPercent = placeable.health / placeable.maxHealth;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(screenX - halfWidth, healthBarY, placeable.width, 6);

    // Foreground
    let healthColor = "#22c55e";
    if (healthPercent <= 0.25) healthColor = "#ef4444";
    else if (healthPercent <= 0.5) healthColor = "#eab308";

    ctx.fillStyle = healthColor;
    ctx.fillRect(
        screenX - halfWidth,
        healthBarY,
        placeable.width * healthPercent,
        6,
    );
}

function drawPlacementPreview(
    preview: PlacementPreview,
    ctx: CanvasRenderingContext2D | null,
    game: GameState,
) {
    if (!ctx) return;

    const screenX = preview.x - game.camera.x;
    const screenY = preview.y - game.camera.y;
    const halfWidth = preview.width / 2;
    const halfHeight = preview.height / 2;

    // Draw preview with transparency and color coding
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = preview.isValid
        ? "rgba(0, 255, 0, 0.3)"
        : "rgba(255, 0, 0, 0.3)";
    ctx.strokeStyle = preview.isValid ? "#00ff00" : "#ff0000";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed outline

    ctx.fillRect(
        screenX - halfWidth,
        screenY - halfHeight,
        preview.width,
        preview.height,
    );
    ctx.strokeRect(
        screenX - halfWidth,
        screenY - halfHeight,
        preview.width,
        preview.height,
    );

    // Draw type-specific preview
    if (preview.type === PlaceableType.TURRET) {
        // Draw turret range preview
        ctx.strokeStyle = preview.isValid
            ? "rgba(0, 255, 0, 0.2)"
            : "rgba(255, 0, 0, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const range = preview.template.range || 200;
        ctx.arc(screenX, screenY, range, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Reset canvas state
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
}

export function renderFrame(
    ctx: CanvasRenderingContext2D | null,
    minimapCtx: CanvasRenderingContext2D | null,
    game: GameState,
    player: Player,
    enemies: Enemy[],
    bullets: Bullet[],
    enemyBullets: EnemyBullet[],
    powerups: Powerup[],
    placeables: Placeable[],
    placementPreview: PlacementPreview | null,
    animationState: any,
) {
    clearCanvas(ctx, game);
    drawBackground(ctx, game);

    // Draw all game objects
    drawPlayer(ctx, game, player);

    // Draw enemies
    for (const enemy of enemies) {
        drawEnemy(enemy, ctx, game, player);
    }

    // Draw bullets
    for (const bullet of bullets) {
        drawBullet(bullet, ctx, game);
    }

    // Draw enemy bullets
    for (const enemyBullet of enemyBullets) {
        drawEnemyBullet(enemyBullet, ctx, game);
    }

    // Draw powerups
    for (const powerup of powerups) {
        drawPowerup(powerup, ctx, game);
    }

    // Draw placeables
    for (const placeable of placeables) {
        drawPlaceable(placeable, ctx, game);
    }

    // Draw placement preview if in placement mode
    if (placementPreview) {
        drawPlacementPreview(placementPreview, ctx, game);
    }

    // Draw animations on top of everything
    if (ctx) {
        renderDefenseAnimations(
            ctx,
            animationState,
            1,
            game.camera.x,
            game.camera.y,
        );
    }

    // Draw minimap
    drawMinimap(
        minimapCtx,
        game,
        player,
        enemies,
        powerups,
        bullets,
        enemyBullets,
    );
}
