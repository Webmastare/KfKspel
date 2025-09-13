/**
 * Canvas utilities and types for KfKbandvagn game
 */

import type { Player, Position } from "./player";
import type { GameBoard } from "./board";

// Canvas configuration interface
export interface CanvasConfig {
    width: number;
    height: number;
    cellSize: number;
    maxWidth: number; // Maximum canvas width ratio
    maxHeight: number; // Maximum canvas height ratio
    pixelRatio: number; // Device pixel ratio
}

// Canvas state interface
export interface CanvasState {
    zoomLevel: number;
    offsetX: number;
    offsetY: number;
    selectedCell: Position | null;
    isDragging: boolean;
    lastMousePosition: Position | null;
}

// Drawing context interface
export interface DrawingContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    config: CanvasConfig;
    state: CanvasState;
}

// Popup state interface
export interface PopupState {
    visible: boolean;
    position: Position;
    screenPosition: { x: number; y: number };
    player: Player | null;
    timeoutId: number | null;
}

// Cell colors
export const CELL_COLORS = {
    grid: "#cccccc",
    selected: "#e03b4b",
    node: "#007bff",
    heart: "#ff69b4",
    outOfBounds: "#888888",
} as const;

// Default canvas configuration
export const DEFAULT_CANVAS_CONFIG: Partial<CanvasConfig> = {
    cellSize: 20,
    maxWidth: 0.95,
    maxHeight: 0.75,
    pixelRatio: Math.ceil(window.devicePixelRatio),
} as const;

/**
 * Calculate canvas dimensions based on board size and window size
 */
export function calculateCanvasDimensions(
    boardRows: number,
    boardCols: number,
    windowWidth: number,
    windowHeight: number,
    config: Partial<CanvasConfig> = DEFAULT_CANVAS_CONFIG,
): CanvasConfig {
    const maxWidth = config.maxWidth || DEFAULT_CANVAS_CONFIG.maxWidth!;
    const maxHeight = config.maxHeight || DEFAULT_CANVAS_CONFIG.maxHeight!;
    const pixelRatio = config.pixelRatio || DEFAULT_CANVAS_CONFIG.pixelRatio!;

    const whRatio = boardRows / boardCols;
    const stdHeight = Math.min(
        windowWidth * maxWidth * whRatio,
        windowHeight * maxHeight,
    );
    const canvasWidth = stdHeight / whRatio;
    const canvasHeight = stdHeight;

    const cellSize = Math.min(
        canvasWidth / boardCols,
        canvasHeight / boardRows,
    );

    return {
        width: canvasWidth,
        height: canvasHeight,
        cellSize,
        maxWidth,
        maxHeight,
        pixelRatio,
    };
}

/**
 * Convert screen coordinates to board coordinates
 */
export function screenToBoard(
    screenX: number,
    screenY: number,
    state: CanvasState,
    config: CanvasConfig,
): Position {
    const adjustedX = (screenX - state.offsetX) / state.zoomLevel;
    const adjustedY = (screenY - state.offsetY) / state.zoomLevel;

    return {
        row: Math.floor(adjustedY / config.cellSize),
        column: Math.floor(adjustedX / config.cellSize),
    };
}

/**
 * Convert board coordinates to screen coordinates
 */
export function boardToScreen(
    boardPosition: Position,
    state: CanvasState,
    config: CanvasConfig,
): { x: number; y: number } {
    const x = (boardPosition.column * config.cellSize + state.offsetX) *
        state.zoomLevel;
    const y = (boardPosition.row * config.cellSize + state.offsetY) *
        state.zoomLevel;

    return { x, y };
}

/**
 * Check if a position is within the canvas bounds
 */
export function isPositionInCanvas(
    position: Position,
    board: GameBoard,
): boolean {
    return (
        position.row >= 0 &&
        position.row < board.rows &&
        position.column >= 0 &&
        position.column < board.cols
    );
}

/**
 * Center the canvas on a specific position (usually the user's player position)
 */
export function centerCanvasOnPosition(
    position: Position,
    config: CanvasConfig,
    board: GameBoard,
): { offsetX: number; offsetY: number } {
    const centerX = config.width / 2;
    const centerY = config.height / 2;

    const targetX = position.column * config.cellSize;
    const targetY = position.row * config.cellSize;

    return {
        offsetX: centerX - targetX,
        offsetY: centerY - targetY,
    };
}

/**
 * Constrain canvas offset to prevent showing too much empty space
 */
export function constrainCanvasOffset(
    offsetX: number,
    offsetY: number,
    config: CanvasConfig,
    board: GameBoard,
    zoomLevel: number,
): { offsetX: number; offsetY: number } {
    const boardWidth = board.cols * config.cellSize * zoomLevel;
    const boardHeight = board.rows * config.cellSize * zoomLevel;

    // Don't let the board move too far in any direction
    const maxOffsetX = config.width * 0.5;
    const minOffsetX = config.width - boardWidth - config.width * 0.5;

    const maxOffsetY = config.height * 0.5;
    const minOffsetY = config.height - boardHeight - config.height * 0.5;

    return {
        offsetX: Math.max(minOffsetX, Math.min(maxOffsetX, offsetX)),
        offsetY: Math.max(minOffsetY, Math.min(maxOffsetY, offsetY)),
    };
}

/**
 * Calculate zoom level constraints
 */
export function constrainZoomLevel(
    zoomLevel: number,
    minZoom: number = 0.1,
    maxZoom: number = 5,
): number {
    return Math.max(minZoom, Math.min(maxZoom, zoomLevel));
}

/**
 * Create initial canvas state
 */
export function createCanvasState(): CanvasState {
    return {
        zoomLevel: 1,
        offsetX: 0,
        offsetY: 0,
        selectedCell: null,
        isDragging: false,
        lastMousePosition: null,
    };
}

/**
 * Create initial popup state
 */
export function createPopupState(): PopupState {
    return {
        visible: false,
        position: { row: 0, column: 0 },
        screenPosition: { x: 0, y: 0 },
        player: null,
        timeoutId: null,
    };
}

/**
 * Calculate popup position to ensure it stays within screen bounds
 */
export function calculatePopupPosition(
    screenPosition: { x: number; y: number },
    popupWidth: number,
    popupHeight: number,
    canvasWidth: number,
    canvasHeight: number,
): { x: number; y: number } {
    let { x, y } = screenPosition;

    // Adjust if popup would go off the right edge
    if (x + popupWidth > canvasWidth) {
        x = canvasWidth - popupWidth - 10;
    }

    // Adjust if popup would go off the bottom edge
    if (y + popupHeight > canvasHeight) {
        y = y - popupHeight - 10;
    }

    // Ensure popup doesn't go off the left or top edges
    x = Math.max(10, x);
    y = Math.max(10, y);

    return { x, y };
}

/**
 * Check if two positions are the same
 */
export function positionsEqual(
    pos1: Position | null,
    pos2: Position | null,
): boolean {
    if (!pos1 || !pos2) return pos1 === pos2;
    return pos1.row === pos2.row && pos1.column === pos2.column;
}

/**
 * Get adjacent positions for movement validation
 */
export function getAdjacentCells(position: Position): Position[] {
    return [
        { row: position.row - 1, column: position.column }, // up
        { row: position.row + 1, column: position.column }, // down
        { row: position.row, column: position.column - 1 }, // left
        { row: position.row, column: position.column + 1 }, // right
    ];
}

/**
 * Calculate the distance between two screen positions
 */
export function calculateScreenDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}
