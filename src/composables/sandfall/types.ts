// types.ts
export interface Pixel {
    colorId: string; // Hex or RGB string used as unique ID
    x: number; // Current pixel X position (animated)
    y: number; // Current pixel Y position (animated)
    targetY: number; // The Y position the pixel is falling towards
    velocity: number; // Current downward speed
}

export interface Bucket {
    colorId: string;
    collected: number;
    total: number;
}

export const GRID_SIZE = 64;
export const PIXEL_SIZE = 8; // Renders as 512x512 canvas
export const GRAVITY = 0.5;
export const SWEEP_SPEED = 0.2; // Columns per frame
export const MAX_ACTIVE_SWEEPS = 10;
