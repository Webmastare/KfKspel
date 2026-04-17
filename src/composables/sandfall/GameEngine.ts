// GameEngine.ts
import {
    GRAVITY,
    GRID_SIZE,
    MAX_ACTIVE_SWEEPS,
    PIXEL_SIZE,
    SWEEP_SPEED,
} from "./types";
import type { Pixel } from "./types";

interface ActiveSweep {
    colorId: string;
    sweepX: number;
}

export class GameEngine {
    private ctx: CanvasRenderingContext2D;
    private grid: (Pixel | null)[][];
    private activeSweeps: ActiveSweep[] = [];
    private animationFrameId: number | null = null;
    private isDestroyed = false;
    private hasAppliedInitialGlobalGravity = false;
    public onPixelCollected?: (colorId: string, column: number) => void;
    public onSweepStateChanged?: (isSweeping: boolean) => void;
    public onActiveSweepCountChanged?: (count: number) => void;

    constructor(canvas: HTMLCanvasElement, initialGrid: (Pixel | null)[][]) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Could not initialize canvas 2D context.");
        }

        this.ctx = ctx;
        this.grid = initialGrid;
        this.loop();
    }

    public triggerSweep(colorId: string): boolean {
        if (this.isDestroyed || this.activeSweeps.length >= MAX_ACTIVE_SWEEPS) {
            return false;
        }

        if (!this.hasAppliedInitialGlobalGravity) {
            this.applyInitialGlobalGravity();
            this.hasAppliedInitialGlobalGravity = true;
        }

        this.activeSweeps.push({
            colorId,
            sweepX: 0,
        });
        this.emitSweepState();

        return true;
    }

    public destroy() {
        this.isDestroyed = true;
        this.activeSweeps = [];
        this.emitSweepState();

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private update() {
        // 1. Process Sweep Mechanic
        const previousSweepCount = this.activeSweeps.length;

        if (this.activeSweeps.length) {
            const remainingSweeps: ActiveSweep[] = [];

            for (const sweep of this.activeSweeps) {
                sweep.sweepX += SWEEP_SPEED;
                const currentCol = Math.floor(sweep.sweepX);

                if (currentCol >= GRID_SIZE) {
                    continue;
                }

                const bottomRow = GRID_SIZE - 1;
                const targetPixel = this.grid[bottomRow]?.[currentCol] ?? null;

                if (targetPixel && targetPixel.colorId === sweep.colorId) {
                    // Remove pixel and trigger collection
                    const row = this.grid[bottomRow];
                    if (!row) {
                        return;
                    }

                    row[currentCol] = null;

                    if (this.onPixelCollected) {
                        this.onPixelCollected(sweep.colorId, currentCol);
                    }

                    // Trigger Gravity for this column
                    this.applyGravityToColumn(currentCol);
                }

                remainingSweeps.push(sweep);
            }

            this.activeSweeps = remainingSweeps;

            if (this.activeSweeps.length !== previousSweepCount) {
                this.emitSweepState();
            }
        }

        // 2. Process Falling Physics
        for (let y = 0; y < GRID_SIZE; y++) {
            const row = this.grid[y];
            if (!row) continue;

            for (let x = 0; x < GRID_SIZE; x++) {
                const p = row[x];
                if (p) {
                    if (p.y < p.targetY) {
                        p.velocity += GRAVITY;
                        p.y += p.velocity;
                        // Clamp to target to prevent vibrating/bouncing unless desired
                        if (p.y >= p.targetY) {
                            p.y = p.targetY;
                            p.velocity = 0;
                        }
                    }
                }
            }
        }
    }

    private applyGravityToColumn(x: number) {
        const bottomRow = GRID_SIZE - 1;

        // Shift logical grid down
        for (let y = bottomRow; y > 0; y--) {
            const currentRow = this.grid[y];
            const rowAbove = this.grid[y - 1];
            if (!currentRow || !rowAbove) continue;

            currentRow[x] = rowAbove[x] ?? null;

            // If a pixel moved down, update its target Y for the animation loop
            if (currentRow[x]) {
                currentRow[x].targetY = y * PIXEL_SIZE;
            }
        }

        // Clear top pixel
        const topRow = this.grid[0];
        if (topRow) {
            topRow[x] = null;
        }
    }

    private applyInitialGlobalGravity() {
        for (let x = 0; x < GRID_SIZE; x++) {
            const pixelsInColumn: Pixel[] = [];

            for (let y = 0; y < GRID_SIZE; y++) {
                const pixel = this.grid[y]?.[x] ?? null;
                if (pixel) {
                    pixelsInColumn.push(pixel);
                }
            }

            for (let y = 0; y < GRID_SIZE; y++) {
                const row = this.grid[y];
                if (!row) continue;
                row[x] = null;
            }

            let writeY = GRID_SIZE - 1;
            for (let i = pixelsInColumn.length - 1; i >= 0; i--) {
                const row = this.grid[writeY];
                if (!row) {
                    writeY--;
                    continue;
                }

                const pixel = pixelsInColumn[i];
                if (!pixel) {
                    writeY--;
                    continue;
                }

                row[x] = pixel;
                pixel.targetY = writeY * PIXEL_SIZE;
                writeY--;
            }
        }
    }

    private draw() {
        this.ctx.clearRect(
            0,
            0,
            GRID_SIZE * PIXEL_SIZE,
            GRID_SIZE * PIXEL_SIZE,
        );

        // Draw Pixels
        for (let y = 0; y < GRID_SIZE; y++) {
            const row = this.grid[y];
            if (!row) continue;

            for (let x = 0; x < GRID_SIZE; x++) {
                const p = row[x];
                if (p) {
                    this.ctx.fillStyle = p.colorId;
                    this.ctx.fillRect(p.x, p.y, PIXEL_SIZE, PIXEL_SIZE);
                }
            }
        }

        // Draw Sweep Lines
        for (const sweep of this.activeSweeps) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.65;
            this.ctx.fillStyle = sweep.colorId;
            this.ctx.fillRect(
                sweep.sweepX * PIXEL_SIZE,
                (GRID_SIZE - 1) * PIXEL_SIZE,
                PIXEL_SIZE,
                PIXEL_SIZE,
            );

            this.ctx.globalAlpha = 0.9;
            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(
                sweep.sweepX * PIXEL_SIZE,
                (GRID_SIZE - 1) * PIXEL_SIZE,
                PIXEL_SIZE,
                PIXEL_SIZE,
            );
            this.ctx.restore();
        }
    }

    private loop = () => {
        if (this.isDestroyed) return;

        this.update();
        this.draw();
        this.animationFrameId = requestAnimationFrame(this.loop);
    };

    private emitSweepState() {
        const hasSweeps = this.activeSweeps.length > 0;
        if (this.onSweepStateChanged) {
            this.onSweepStateChanged(hasSweeps);
        }

        if (this.onActiveSweepCountChanged) {
            this.onActiveSweepCountChanged(this.activeSweeps.length);
        }
    }
}
