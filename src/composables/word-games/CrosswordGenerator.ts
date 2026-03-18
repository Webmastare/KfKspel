// CrosswordGenerator.ts
import type {
    CrosswordLayout,
    Direction,
    GridCell,
    PlacedWord,
    WordData,
} from "./minicrossTypes";

interface PlacementCandidate {
    row: number;
    col: number;
    direction: Direction;
    intersections: number;
    newCells: number;
    score: number;
}

interface GenerateOptions {
    targetWordCount?: number;
    attempts?: number;
}

export class CrosswordGenerator {
    private grid: Record<string, string> = {}; // sparse grid: "row,col" -> char
    private placedWords: PlacedWord[] = [];

    // Directions helpers
    private readonly DIR_OFFSETS = {
        across: { r: 0, c: 1 },
        down: { r: 1, c: 0 },
    };

    generate(
        wordsToUse: WordData[],
        options: GenerateOptions = {},
    ): CrosswordLayout {
        const cleaned = this.prepareWords(wordsToUse);
        if (cleaned.length === 0) {
            this.grid = {};
            this.placedWords = [];
            return this.buildOutput();
        }

        const targetWordCount = Math.max(
            3,
            Math.min(options.targetWordCount ?? 8, cleaned.length),
        );
        const attempts = Math.max(1, options.attempts ?? 35);

        let bestGrid: Record<string, string> = {};
        let bestPlaced: PlacedWord[] = [];
        let bestScore = -Infinity;

        for (let attempt = 0; attempt < attempts; attempt++) {
            this.grid = {};
            this.placedWords = [];

            const candidatePool = this.shuffle(
                [...cleaned].sort((a, b) => b.word.length - a.word.length),
            );

            // Seed with a long word to maximize chance of future crossings.
            const seed = this.pickSeedWord(candidatePool);
            if (!seed) continue;

            this.placeWord(seed, 0, 0, "across");

            const remaining = candidatePool.filter((w) => w.word !== seed.word);

            while (this.placedWords.length < targetWordCount) {
                const best = this.findBestWordPlacement(remaining);
                if (!best) break;

                this.placeWord(
                    best.wordData,
                    best.candidate.row,
                    best.candidate.col,
                    best.candidate.direction,
                );
                const idx = remaining.findIndex((w) =>
                    w.word === best.wordData.word
                );
                if (idx >= 0) remaining.splice(idx, 1);
                if (remaining.length === 0) break;
            }

            const score = this.computeLayoutScore();
            if (score > bestScore) {
                bestScore = score;
                bestGrid = { ...this.grid };
                bestPlaced = this.placedWords.map((w) => ({ ...w }));
            }
        }

        this.grid = bestGrid;
        this.placedWords = bestPlaced;
        return this.buildOutput();
    }

    private prepareWords(wordsToUse: WordData[]): WordData[] {
        const seen = new Set<string>();
        const prepared: WordData[] = [];

        for (const entry of wordsToUse) {
            const normalized = entry.word.trim().toUpperCase();
            if (normalized.length < 3 || normalized.length > 12) continue;
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            prepared.push({ ...entry, word: normalized });
        }

        return prepared;
    }

    private shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = arr[i];
            arr[i] = arr[j] as T;
            arr[j] = temp as T;
        }
        return arr;
    }

    private pickSeedWord(words: WordData[]): WordData | null {
        if (words.length === 0) return null;
        const topSlice = words.slice(0, Math.min(10, words.length));
        return topSlice[Math.floor(Math.random() * topSlice.length)] ??
            words[0] ?? null;
    }

    private placeWord(
        wordData: WordData,
        row: number,
        col: number,
        dir: Direction,
    ) {
        const { r, c } = this.DIR_OFFSETS[dir];
        for (let i = 0; i < wordData.word.length; i++) {
            const char = wordData.word[i];
            if (char) {
                const key = `${row + i * r},${col + i * c}`;
                this.grid[key] = char;
            }
        }
        this.placedWords.push({
            ...wordData,
            row,
            col,
            direction: dir,
            number: 0, // Assigned later
        });
    }

    private findBestWordPlacement(unplacedWords: WordData[]): {
        wordData: WordData;
        candidate: PlacementCandidate;
    } | null {
        let best: { wordData: WordData; candidate: PlacementCandidate } | null =
            null;

        for (const wordData of unplacedWords) {
            const candidate = this.findBestPlacementForWord(wordData.word);
            if (!candidate) continue;

            if (!best || candidate.score > best.candidate.score) {
                best = { wordData, candidate };
            }
        }

        return best;
    }

    private findBestPlacementForWord(word: string): PlacementCandidate | null {
        let best: PlacementCandidate | null = null;
        const letters = word.split("");

        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            if (!letter) continue;

            const potentialIntersections = this.findLetterOnBoard(letter);
            for (const pos of potentialIntersections) {
                const acrossCandidate = this.canPlaceDetailed(
                    word,
                    pos.row,
                    pos.col - i,
                    "across",
                );
                if (
                    acrossCandidate.valid && acrossCandidate.intersections > 0
                ) {
                    const score = acrossCandidate.intersections * 24 -
                        acrossCandidate.newCells * 0.75 + Math.random() * 0.2;
                    const candidate: PlacementCandidate = {
                        row: pos.row,
                        col: pos.col - i,
                        direction: "across",
                        intersections: acrossCandidate.intersections,
                        newCells: acrossCandidate.newCells,
                        score,
                    };
                    if (!best || candidate.score > best.score) best = candidate;
                }

                const downCandidate = this.canPlaceDetailed(
                    word,
                    pos.row - i,
                    pos.col,
                    "down",
                );
                if (downCandidate.valid && downCandidate.intersections > 0) {
                    const score = downCandidate.intersections * 24 -
                        downCandidate.newCells * 0.75 + Math.random() * 0.2;
                    const candidate: PlacementCandidate = {
                        row: pos.row - i,
                        col: pos.col,
                        direction: "down",
                        intersections: downCandidate.intersections,
                        newCells: downCandidate.newCells,
                        score,
                    };
                    if (!best || candidate.score > best.score) best = candidate;
                }
            }
        }

        return best;
    }

    private findLetterOnBoard(char: string) {
        const matches: { row: number; col: number }[] = [];
        for (const key in this.grid) {
            if (this.grid[key] === char) {
                const parts = key.split(",");
                const rStr = parts[0];
                const cStr = parts[1];
                if (rStr && cStr) {
                    const r = parseInt(rStr, 10);
                    const c = parseInt(cStr, 10);
                    if (!isNaN(r) && !isNaN(c)) {
                        matches.push({ row: r, col: c });
                    }
                }
            }
        }
        return matches;
    }

    private canPlaceDetailed(
        word: string,
        startRow: number,
        startCol: number,
        dir: Direction,
    ): { valid: boolean; intersections: number; newCells: number } {
        const { r: dr, c: dc } = this.DIR_OFFSETS[dir];
        let intersections = 0;
        let newCells = 0;

        for (let i = 0; i < word.length; i++) {
            const currentRow = startRow + i * dr;
            const currentCol = startCol + i * dc;
            const currentKey = `${currentRow},${currentCol}`;
            const existingChar = this.grid[currentKey];

            // Collision Check 1: Slot matches letter or is empty
            if (existingChar && existingChar !== word[i]) {
                return { valid: false, intersections: 0, newCells: 0 };
            }

            // Collision Check 2: Adjacent cells must be empty (unless it's an intersection)
            // This is simplified. A robust check ensures we don't accidentally form 2-letter words parallel to placement.
            // We check the "perpendicular neighbors" only if the cell was empty.
            if (!existingChar) {
                if (
                    this.hasPerpendicularNeighbors(currentRow, currentCol, dir)
                ) {
                    return { valid: false, intersections: 0, newCells: 0 };
                }
                newCells++;
            } else {
                intersections++;
            }

            // Boundary check: start and end shouldn't touch other words directly on the same axis
            if (i === 0) { // Check cell before start
                const prevKey = `${currentRow - dr},${currentCol - dc}`;
                if (this.grid[prevKey]) {
                    return { valid: false, intersections: 0, newCells: 0 };
                }
            }
            if (i === word.length - 1) { // Check cell after end
                const nextKey = `${currentRow + dr},${currentCol + dc}`;
                if (this.grid[nextKey]) {
                    return { valid: false, intersections: 0, newCells: 0 };
                }
            }
        }
        return { valid: true, intersections, newCells };
    }

    private hasPerpendicularNeighbors(
        row: number,
        col: number,
        dir: Direction,
    ): boolean {
        // If placing ACROSS, check UP and DOWN neighbors
        if (dir === "across") {
            return !!this.grid[`${row - 1},${col}`] ||
                !!this.grid[`${row + 1},${col}`];
        }
        // If placing DOWN, check LEFT and RIGHT neighbors
        return !!this.grid[`${row},${col - 1}`] ||
            !!this.grid[`${row},${col + 1}`];
    }

    private buildOutput(): CrosswordLayout {
        if (Object.keys(this.grid).length === 0) {
            return {
                grid: [[{
                    char: "",
                    input: "",
                    row: 0,
                    col: 0,
                    isBlack: true,
                    isActive: false,
                }]],
                rows: 1,
                cols: 1,
                acrossClues: [],
                downClues: [],
                placedWordCount: 0,
                totalIntersections: 0,
            };
        }

        // 1. Calculate Bounds
        let minR = Infinity,
            maxR = -Infinity,
            minC = Infinity,
            maxC = -Infinity;
        Object.keys(this.grid).forEach((k) => {
            const parts = k.split(",");
            const rStr = parts[0];
            const cStr = parts[1];
            if (rStr && cStr) {
                const r = parseInt(rStr, 10);
                const c = parseInt(cStr, 10);
                if (!isNaN(r) && !isNaN(c)) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                }
            }
        });

        // Normalize coordinates to 0,0
        const height = maxR - minR + 1;
        const width = maxC - minC + 1;

        // Initialize empty grid
        const finalGrid: GridCell[][] = Array.from(
            { length: height },
            (_, r) =>
                Array.from({ length: width }, (_, c) => ({
                    char: "",
                    input: "",
                    row: r,
                    col: c,
                    isBlack: true,
                    isActive: false,
                })),
        );

        // Fill Grid
        Object.entries(this.grid).forEach(([key, char]) => {
            const parts = key.split(",");
            const rStr = parts[0];
            const cStr = parts[1];
            if (rStr && cStr) {
                const r = parseInt(rStr, 10);
                const c = parseInt(cStr, 10);
                if (!isNaN(r) && !isNaN(c)) {
                    const row = finalGrid[r - minR];
                    if (row) {
                        const cell = row[c - minC];
                        if (cell) {
                            cell.char = char;
                            cell.isBlack = false;
                        }
                    }
                }
            }
        });

        // Assign Numbers and normalize word positions
        let currentNumber = 1;
        // Sort words by position (top-left to bottom-right) to assign numbers correctly
        this.placedWords.sort((a, b) => (a.row - b.row) || (a.col - b.col));

        // Map to track if a cell already has a number
        const numberMap = new Map<string, number>();

        const finalizedWords = this.placedWords.map((w) => {
            const normR = w.row - minR;
            const normC = w.col - minC;
            const key = `${normR},${normC}`;

            let num = numberMap.get(key);
            if (!num) {
                num = currentNumber++;
                numberMap.set(key, num);
            }

            // Tag the cell in grid for UI
            const row = finalGrid[normR];
            if (row) {
                const cell = row[normC];
                if (cell) {
                    if (w.direction === "across") {
                        cell.acrossNum = num;
                    } else {
                        cell.downNum = num;
                    }
                }
            }

            return { ...w, row: normR, col: normC, number: num };
        });

        return {
            grid: finalGrid,
            rows: height,
            cols: width,
            acrossClues: finalizedWords.filter((w) => w.direction === "across"),
            downClues: finalizedWords.filter((w) => w.direction === "down"),
            placedWordCount: finalizedWords.length,
            totalIntersections: this.countIntersections(finalizedWords),
        };
    }

    private computeLayoutScore(): number {
        if (this.placedWords.length === 0) return -Infinity;
        const intersections = this.countIntersections(this.placedWords);
        const density = Object.keys(this.grid).length > 0
            ? intersections / Object.keys(this.grid).length
            : 0;

        return this.placedWords.length * 120 + intersections * 80 +
            density * 40;
    }

    private countIntersections(words: PlacedWord[]): number {
        const coverage = new Map<string, number>();

        for (const word of words) {
            const { r, c } = this.DIR_OFFSETS[word.direction];
            for (let i = 0; i < word.word.length; i++) {
                const key = `${word.row + i * r},${word.col + i * c}`;
                coverage.set(key, (coverage.get(key) ?? 0) + 1);
            }
        }

        let intersections = 0;
        for (const count of coverage.values()) {
            if (count > 1) intersections++;
        }
        return intersections;
    }
}
