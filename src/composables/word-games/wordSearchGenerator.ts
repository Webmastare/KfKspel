// WordSearchGenerator.ts

export interface Cell {
    row: number;
    col: number;
    char: string;
    isFound: boolean; // Permanently found
    isSelected: boolean; // Currently being dragged over
    foundColor?: string;
}

export interface PlacedWord {
    word: string;
    start: { r: number; c: number };
    end: { r: number; c: number };
    color?: string; // Optional: distinct colors for different words
}

export class WordSearchGenerator {
    private size: number;
    private grid: string[][] = [];
    private placedWords: PlacedWord[] = [];

    // 8 Directions: [row_offset, col_offset]
    private readonly DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
        [0, 1], // Right
        [1, 0], // Down
        [1, 1], // Diagonal Down-Right
        [-1, 1], // Diagonal Up-Right
        [0, -1], // Left
        [-1, 0], // Up
        [-1, -1], // Diagonal Up-Left
        [1, -1], // Diagonal Down-Left
    ];

    private readonly WORD_COLORS = [
        "#ef4444",
        "#3b82f6",
        "#22c55e",
        "#f59e0b",
        "#a855f7",
        "#06b6d4",
        "#f472b6",
        "#84cc16",
        "#f97316",
        "#14b8a6",
    ];

    constructor(size: number = 15) {
        this.size = size;
    }

    generate(words: string[]): { grid: Cell[][]; placed: PlacedWord[] } {
        // 1. Initialize Empty Grid
        this.grid = Array.from(
            { length: this.size },
            () => Array.from({ length: this.size }, () => ""),
        );
        this.placedWords = [];

        // 2. Sort words by length (longest first are hardest to fit)
        const sortedWords = [...words].sort((a, b) => b.length - a.length);

        // 3. Place Words
        for (const word of sortedWords) {
            this.placeWord(word);
        }

        // 4. Fill Empty Spots with Random Letters
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const row = this.grid[r];
                if (!row) continue;
                if (!row[c]) {
                    // Weighted random could be better, but uniform is fine
                    const randomIndex = Math.floor(
                        Math.random() * alphabet.length,
                    );
                    row[c] = alphabet[randomIndex] || "A";
                }
            }
        }

        // 5. Convert to Cell Objects for Vue
        const finalGrid: Cell[][] = this.grid.map((row, rIndex) =>
            row.map((char, cIndex) => ({
                row: rIndex,
                col: cIndex,
                char,
                isFound: false,
                isSelected: false,
            }))
        );

        return { grid: finalGrid, placed: this.placedWords };
    }

    private placeWord(word: string): boolean {
        const letters = word.toUpperCase().split("");
        const directions = this.DIRECTIONS.slice().sort(() =>
            0.5 - Math.random()
        );
        const attempts = 200; // Cap to avoid infinite loop

        for (let i = 0; i < attempts; i++) {
            // Pick a random starting point
            const r = Math.floor(Math.random() * this.size);
            const c = Math.floor(Math.random() * this.size);

            // Try each direction
            for (const dir of directions) {
                const [dr, dc] = dir;
                if (this.canFit(letters, r, c, dr, dc)) {
                    // Commit
                    for (let j = 0; j < letters.length; j++) {
                        const row = this.grid[r + j * dr];
                        if (row) {
                            const letter = letters[j];
                            row[c + j * dc] = letter || "";
                        }
                    }
                    const color =
                        this.WORD_COLORS[
                            this.placedWords.length % this.WORD_COLORS.length
                        ] || "#10b981";
                    this.placedWords.push({
                        word: word,
                        start: { r, c },
                        end: {
                            r: r + (letters.length - 1) * dr,
                            c: c + (letters.length - 1) * dc,
                        },
                        color,
                    });
                    return true;
                }
            }
        }
        return false; // Could not place word
    }

    private canFit(
        letters: string[],
        startR: number,
        startC: number,
        dr: number,
        dc: number,
    ): boolean {
        const endR = startR + (letters.length - 1) * dr;
        const endC = startC + (letters.length - 1) * dc;

        // Boundary Check
        if (endR < 0 || endR >= this.size || endC < 0 || endC >= this.size) {
            return false;
        }

        // Collision Check
        for (let i = 0; i < letters.length; i++) {
            const row = this.grid[startR + i * dr];
            if (!row) return false;
            const charAt = row[startC + i * dc] ?? "";
            const letter = letters[i];
            // Must be empty OR the same letter (overlap allowed)
            if (charAt !== "" && letter && charAt !== letter) {
                return false;
            }
        }
        return true;
    }
}
