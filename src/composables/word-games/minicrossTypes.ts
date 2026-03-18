// types.ts

export interface WordData {
    word: string;
    clue: string; // If your JSON is just ["word",...], we might need to simulate clues or change the game type
}

export type Direction = "across" | "down";

export interface GridCell {
    char: string; // The correct answer
    input: string; // What the user typed
    row: number;
    col: number;
    isBlack: boolean;
    // Metadata for the UI (e.g., "1" for 1 Across)
    acrossNum?: number;
    downNum?: number;
    isGiven?: boolean; // Starting hint letters shown to the player
    isActive: boolean; // For highlighting
}

export interface PlacedWord {
    word: string;
    clue: string;
    row: number;
    col: number;
    direction: Direction;
    number: number;
}

export interface CrosswordLayout {
    grid: GridCell[][];
    acrossClues: PlacedWord[];
    downClues: PlacedWord[];
    rows: number;
    cols: number;
    placedWordCount: number;
    totalIntersections: number;
}
