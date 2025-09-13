/**
 * Image processing utilities and Web Worker types for KfKbandvagn game
 */
import type { Player } from "./player";
import { hslToRgb, rgbToHsl } from "./animations";

// Image processing interfaces
export interface ImagePixelData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

export interface ProcessedImageData {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
}
// Preloaded image state
export interface PreloadedImageState {
    pixels: Uint8ClampedArray | null;
    lightnessValues: number[];
    canvas: HTMLCanvasElement | null;
    context: CanvasRenderingContext2D | null;
    loaded: boolean;
}

// Load and preprocess the bandvagn image
export async function loadObjectToPixels(
    imagePath: string = "/assets/bandvagn no shadow.png",
): Promise<PreloadedImageState> {
    const state: PreloadedImageState = {
        pixels: null,
        lightnessValues: [],
        canvas: null,
        context: null,
        loaded: false,
    };

    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            try {
                // Create canvas for image processing
                state.canvas = document.createElement("canvas");
                state.context = state.canvas.getContext("2d");

                if (!state.context) {
                    throw new Error("Could not get 2D context");
                }

                state.canvas.width = img.width;
                state.canvas.height = img.height;

                // Draw image to canvas
                state.context.drawImage(img, 0, 0);

                // Get pixel data
                const imageData = state.context.getImageData(
                    0,
                    0,
                    img.width,
                    img.height,
                );
                state.pixels = new Uint8ClampedArray(imageData.data);

                // Calculate lightness values for each pixel
                state.lightnessValues = [];
                for (let i = 0; i < state.pixels.length; i += 4) {
                    const r = state.pixels[i] || 0;
                    const g = state.pixels[i + 1] || 0;
                    const b = state.pixels[i + 2] || 0;
                    const { l } = rgbToHsl(r, g, b);
                    state.lightnessValues.push(l);
                }

                state.loaded = true;
                resolve(state);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error(`Failed to load image: ${imagePath}`));
        };

        img.src = imagePath;
    });
}

// Process image with player color and opacity based on lives
export function processImageForPlayer(
    preloadedState: PreloadedImageState,
    player: Player,
): ProcessedImageData | null {
    if (!preloadedState.loaded || !preloadedState.pixels) {
        return null;
    }

    const pixels = new Uint8ClampedArray(preloadedState.pixels);

    // Parse player color
    const bigint = parseInt(player.color.substring(1), 16);
    const red = (bigint >> 16) & 255;
    const green = (bigint >> 8) & 255;
    const blue = bigint & 255;

    const { h, s } = rgbToHsl(red, green, blue);
    const alpha = Math.floor(255 * Math.min(player.lives / 3, 1));

    if (player.lives > 0) {
        // Recolor pixels while maintaining lightness
        for (let i = 0; i < pixels.length; i += 4) {
            const lightnessValue = preloadedState.lightnessValues[i / 4] || 50;
            const { r: newR, g: newG, b: newB } = hslToRgb(
                h,
                s,
                lightnessValue,
            );

            pixels[i] = newR; // Red
            pixels[i + 1] = newG; // Green
            pixels[i + 2] = newB; // Blue
            const currentAlpha = pixels[i + 3];
            pixels[i + 3] = currentAlpha !== undefined && currentAlpha > 0
                ? alpha
                : 0; // Alpha
        }
    } else {
        // Make dead players very transparent
        for (let i = 0; i < pixels.length; i += 4) {
            const currentAlpha = pixels[i + 3];
            pixels[i + 3] = currentAlpha !== undefined && currentAlpha > 0
                ? 20
                : 0; // Very low alpha
        }
    }

    return {
        pixels,
        width: preloadedState.canvas?.width || 0,
        height: preloadedState.canvas?.height || 0,
    };
}
