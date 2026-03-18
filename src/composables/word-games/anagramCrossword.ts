export type DifficultyId = "very-easy" | "easy" | "medium" | "hard" | "expert";

export interface DifficultyConfig {
    id: DifficultyId;
    label: string;
    letterCount: number;
    targetWords: number;
    minWordLength: number;
    maxWordLength: number;
    seedAttempts: number;
    layoutAttempts: number;
    preferredFamilyMin: number;
    preferredFamilyMax: number;
    absoluteFamilyCap: number;
}

export interface CrosswordCell {
    row: number;
    col: number;
    solution: string;
    value: string;
    blocked: boolean;
    number?: number;
    belongsTo: string[];
}

export interface CrosswordPlacedWord {
    word: string;
    row: number;
    col: number;
    direction: "across" | "down";
    number: number;
}

export interface CrosswordPuzzle {
    rows: number;
    cols: number;
    grid: CrosswordCell[][];
    placedWords: CrosswordPlacedWord[];
    across: CrosswordPlacedWord[];
    down: CrosswordPlacedWord[];
    placedWordCount: number;
    intersections: number;
}

export interface PuzzleBundle {
    difficulty: DifficultyConfig;
    letters: string[];
    targetWords: string[];
    puzzle: CrosswordPuzzle;
}

interface SparsePlacement {
    word: string;
    row: number;
    col: number;
    direction: "across" | "down";
}

interface CandidatePlacement {
    row: number;
    col: number;
    direction: "across" | "down";
    intersections: number;
    score: number;
}

interface LetterSetResult {
    letters: string[];
    words: string[];
}

const SWEDISH_ALPHA = /^[A-ZÅÄÖ]+$/;

export const DIFFICULTIES: DifficultyConfig[] = [
    {
        id: "very-easy",
        label: "Mycket lätt",
        letterCount: 5,
        targetWords: 4,
        minWordLength: 3,
        maxWordLength: 5,
        seedAttempts: 60,
        layoutAttempts: 50,
        preferredFamilyMin: 5,
        preferredFamilyMax: 10,
        absoluteFamilyCap: 15,
    },
    {
        id: "easy",
        label: "Lätt",
        letterCount: 6,
        targetWords: 6,
        minWordLength: 3,
        maxWordLength: 6,
        seedAttempts: 80,
        layoutAttempts: 60,
        preferredFamilyMin: 7,
        preferredFamilyMax: 12,
        absoluteFamilyCap: 18,
    },
    {
        id: "medium",
        label: "Medium",
        letterCount: 7,
        targetWords: 8,
        minWordLength: 3,
        maxWordLength: 7,
        seedAttempts: 100,
        layoutAttempts: 70,
        preferredFamilyMin: 9,
        preferredFamilyMax: 15,
        absoluteFamilyCap: 22,
    },
    {
        id: "hard",
        label: "Svår",
        letterCount: 8,
        targetWords: 10,
        minWordLength: 3,
        maxWordLength: 8,
        seedAttempts: 120,
        layoutAttempts: 80,
        preferredFamilyMin: 12,
        preferredFamilyMax: 18,
        absoluteFamilyCap: 25,
    },
    {
        id: "expert",
        label: "Expert",
        letterCount: 9,
        targetWords: 12,
        minWordLength: 3,
        maxWordLength: 9,
        seedAttempts: 150,
        layoutAttempts: 100,
        preferredFamilyMin: 15,
        preferredFamilyMax: 22,
        absoluteFamilyCap: 30,
    },
];

const randomInt = (maxExclusive: number) =>
    Math.floor(Math.random() * maxExclusive);

const shuffle = <T>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        const temp = out[i];
        out[i] = out[j] as T;
        out[j] = temp as T;
    }
    return out;
};

export const normalizeWord = (raw: string): string =>
    raw
        .trim()
        .toUpperCase()
        .replace(/[^A-ZÅÄÖ]/g, "");

const toHistogram = (word: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (const ch of word) map.set(ch, (map.get(ch) || 0) + 1);
    return map;
};

const canBuildFromBag = (word: string, bag: Map<string, number>): boolean => {
    const need = new Map<string, number>();
    for (const ch of word) need.set(ch, (need.get(ch) || 0) + 1);
    for (const [ch, count] of need.entries()) {
        if ((bag.get(ch) || 0) < count) return false;
    }
    return true;
};

const canIntersect = (a: string, b: string): boolean => {
    for (const ch of a) {
        if (b.includes(ch)) return true;
    }
    return false;
};

const findIntersections = (
    a: string,
    b: string,
): Array<{ aIndex: number; bIndex: number; char: string }> => {
    const intersections: Array<
        { aIndex: number; bIndex: number; char: string }
    > = [];
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            const charA = a[i];
            const charB = b[j];
            if (charA && charB && charA === charB) {
                intersections.push({ aIndex: i, bIndex: j, char: charA });
            }
        }
    }
    return intersections;
};

const selectBestWordCombination = (
    words: string[],
    targetCount: number,
): string[] => {
    if (words.length <= targetCount) {
        return words;
    }

    const selected: string[] = [];
    const remaining = [...words];

    // Pick first word randomly
    const firstIndex = randomInt(remaining.length);
    const firstWord = remaining.splice(firstIndex, 1)[0];
    if (firstWord) {
        selected.push(firstWord);
    }

    // For each subsequent word, prefer ones that intersect with already selected words
    while (selected.length < targetCount && remaining.length > 0) {
        let bestWord = "";
        let bestScore = -1;

        for (const word of remaining) {
            let score = 0;
            for (const selectedWord of selected) {
                if (canIntersect(word, selectedWord)) {
                    score += findIntersections(word, selectedWord).length;
                }
            }

            // Add some randomness to avoid always picking the same combinations
            score += Math.random() * 2;

            if (score > bestScore) {
                bestScore = score;
                bestWord = word;
            }
        }

        if (bestWord) {
            const index = remaining.indexOf(bestWord);
            if (index >= 0) {
                const word = remaining.splice(index, 1)[0];
                if (word) {
                    selected.push(word);
                }
            }
        } else {
            // If no intersecting word found, pick randomly
            const randomIndex = randomInt(remaining.length);
            const word = remaining.splice(randomIndex, 1)[0];
            if (word) {
                selected.push(word);
            }
        }
    }

    return selected;
};

const pickLetterSetAndWords = (
    dictionary: string[],
    difficulty: DifficultyConfig,
): LetterSetResult | null => {
    const { letterCount, targetWords, minWordLength, maxWordLength } =
        difficulty;

    // Try multiple letter combinations
    for (let attempt = 0; attempt < difficulty.seedAttempts; attempt++) {
        // Pick random letters for this attempt
        const letters: string[] = [];
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";

        for (let i = 0; i < letterCount; i++) {
            const char = alphabet[randomInt(alphabet.length)];
            if (char) {
                letters.push(char);
            }
        }

        const letterBag = toHistogram(letters.join(""));

        // Find all words that can be made with these letters
        const possibleWords = dictionary
            .filter((word) =>
                word.length >= minWordLength &&
                word.length <= maxWordLength &&
                canBuildFromBag(word, letterBag)
            );

        if (possibleWords.length >= targetWords) {
            // Try to select a good subset of words that can intersect well
            const selectedWords = selectBestWordCombination(
                possibleWords,
                targetWords,
            );
            if (selectedWords.length >= Math.max(4, targetWords - 1)) {
                return { letters, words: selectedWords };
            }
        }
    }

    return null;
};

const createEmptyGrid = (rows: number, cols: number): CrosswordCell[][] => {
    const grid: CrosswordCell[][] = [];
    for (let r = 0; r < rows; r++) {
        const row: CrosswordCell[] = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                row: r,
                col: c,
                solution: "",
                value: "",
                blocked: true,
                belongsTo: [],
            });
        }
        grid.push(row);
    }
    return grid;
};

const canPlaceWord = (
    grid: CrosswordCell[][],
    word: string,
    startRow: number,
    startCol: number,
    direction: "across" | "down",
): boolean => {
    const rows = grid.length;
    const firstRow = grid[0];
    if (!firstRow) return false;
    const cols = firstRow.length;

    for (let i = 0; i < word.length; i++) {
        const row = direction === "across" ? startRow : startRow + i;
        const col = direction === "across" ? startCol + i : startCol;

        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            return false;
        }

        const gridRow = grid[row];
        if (!gridRow) return false;
        const cell = gridRow[col];
        if (!cell) return false;

        const wordChar = word[i];
        if (!wordChar) return false;

        // If cell already has a letter, it must match
        if (!cell.blocked && cell.solution && cell.solution !== wordChar) {
            return false;
        }
    }

    return true;
};

const placeWord = (
    grid: CrosswordCell[][],
    word: string,
    startRow: number,
    startCol: number,
    direction: "across" | "down",
    wordNumber: number,
): void => {
    for (let i = 0; i < word.length; i++) {
        const row = direction === "across" ? startRow : startRow + i;
        const col = direction === "across" ? startCol + i : startCol;

        const gridRow = grid[row];
        if (!gridRow) continue;
        const cell = gridRow[col];
        if (!cell) continue;

        const wordChar = word[i];
        if (!wordChar) continue;

        cell.solution = wordChar;
        cell.blocked = false;
        cell.belongsTo.push(word);

        if (i === 0) {
            cell.number = wordNumber;
        }
    }
};

const findWordPlacements = (
    grid: CrosswordCell[][],
    words: string[],
    placedWords: SparsePlacement[],
): CandidatePlacement[] => {
    const placements: CandidatePlacement[] = [];
    const rows = grid.length;
    const firstRow = grid[0];
    if (!firstRow) return placements;
    const cols = firstRow.length;

    for (const word of words) {
        // Skip if word is already placed
        if (placedWords.some((pw) => pw.word === word)) continue;

        // Try all positions and directions
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                for (const direction of ["across", "down"] as const) {
                    if (!canPlaceWord(grid, word, row, col, direction)) {
                        continue;
                    }

                    // Count intersections with existing words
                    let intersections = 0;
                    for (let i = 0; i < word.length; i++) {
                        const r = direction === "across" ? row : row + i;
                        const c = direction === "across" ? col + i : col;
                        const gridRow = grid[r];
                        if (!gridRow) continue;
                        const cell = gridRow[c];
                        if (!cell) continue;

                        const wordChar = word[i];
                        if (
                            wordChar && !cell.blocked &&
                            cell.solution === wordChar
                        ) {
                            intersections++;
                        }
                    }

                    // For the first word, intersections should be 0
                    // For subsequent words, we want at least 1 intersection
                    if (placedWords.length === 0 && intersections > 0) continue;
                    if (placedWords.length > 0 && intersections === 0) continue;

                    const score = intersections * 10 + word.length +
                        Math.random() * 2;

                    placements.push({
                        row,
                        col,
                        direction,
                        intersections,
                        score,
                    });
                }
            }
        }
    }

    return placements.sort((a, b) => b.score - a.score);
};

const layoutCrossword = (words: string[]): CrosswordPuzzle | null => {
    const maxSize = Math.max(20, Math.max(...words.map((w) => w.length)) + 8);

    for (let attempt = 0; attempt < 100; attempt++) {
        let grid = createEmptyGrid(maxSize, maxSize);
        const placedWords: SparsePlacement[] = [];

        const shuffledWords = shuffle(words);
        let wordsPlaced = 0;

        for (const word of shuffledWords) {
            const placements = findWordPlacements(grid, [word], placedWords);

            if (placements.length === 0) {
                // Could not place this word, continue to next word
                continue;
            }

            const placement = placements[0];
            if (!placement) continue;

            placeWord(
                grid,
                word,
                placement.row,
                placement.col,
                placement.direction,
                placedWords.length + 1,
            );
            placedWords.push({
                word,
                row: placement.row,
                col: placement.col,
                direction: placement.direction,
            });
            wordsPlaced++;
        }

        // If we managed to place at least 75% of the words, consider it successful
        if (wordsPlaced >= Math.max(4, Math.floor(words.length * 0.75))) {
            // Trim the grid to remove empty rows/cols
            const { grid: trimmedGrid, offset } = trimGrid(grid);

            // Adjust placed word positions after trimming
            const adjustedPlacedWords: CrosswordPlacedWord[] = placedWords.map((
                pw,
                index,
            ) => ({
                word: pw.word,
                row: pw.row - offset.row,
                col: pw.col - offset.col,
                direction: pw.direction,
                number: index + 1,
            }));

            // Separate across and down words
            const across = adjustedPlacedWords.filter((pw) =>
                pw.direction === "across"
            );
            const down = adjustedPlacedWords.filter((pw) =>
                pw.direction === "down"
            );

            // Count intersections
            let totalIntersections = 0;
            const firstRow = trimmedGrid[0];
            if (firstRow) {
                for (let r = 0; r < trimmedGrid.length; r++) {
                    for (let c = 0; c < firstRow.length; c++) {
                        const gridRow = trimmedGrid[r];
                        if (!gridRow) continue;
                        const cell = gridRow[c];
                        if (cell && cell.belongsTo.length > 1) {
                            totalIntersections++;
                        }
                    }
                }
            }

            return {
                rows: trimmedGrid.length,
                cols: firstRow?.length || 0,
                grid: trimmedGrid,
                placedWords: adjustedPlacedWords,
                across,
                down,
                placedWordCount: placedWords.length,
                intersections: totalIntersections,
            };
        }
    }

    return null;
};

const trimGrid = (
    grid: CrosswordCell[][],
): { grid: CrosswordCell[][]; offset: { row: number; col: number } } => {
    const rows = grid.length;
    const firstRow = grid[0];
    if (!firstRow) {
        return { grid: [], offset: { row: 0, col: 0 } };
    }
    const cols = firstRow.length;

    let minRow = rows, maxRow = -1;
    let minCol = cols, maxCol = -1;

    // Find bounds of used cells
    for (let r = 0; r < rows; r++) {
        const gridRow = grid[r];
        if (!gridRow) continue;
        for (let c = 0; c < cols; c++) {
            const cell = gridRow[c];
            if (cell && !cell.blocked) {
                minRow = Math.min(minRow, r);
                maxRow = Math.max(maxRow, r);
                minCol = Math.min(minCol, c);
                maxCol = Math.max(maxCol, c);
            }
        }
    }

    // Add padding
    const padding = 1;
    minRow = Math.max(0, minRow - padding);
    maxRow = Math.min(rows - 1, maxRow + padding);
    minCol = Math.max(0, minCol - padding);
    maxCol = Math.min(cols - 1, maxCol + padding);

    const trimmedGrid: CrosswordCell[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
        const row: CrosswordCell[] = [];
        const gridRow = grid[r];
        if (gridRow) {
            for (let c = minCol; c <= maxCol; c++) {
                const originalCell = gridRow[c];
                if (originalCell) {
                    const cell: CrosswordCell = {
                        row: r - minRow,
                        col: c - minCol,
                        solution: originalCell.solution,
                        value: originalCell.value,
                        blocked: originalCell.blocked,
                        belongsTo: [...originalCell.belongsTo],
                    };
                    if (originalCell.number !== undefined) {
                        cell.number = originalCell.number;
                    }
                    row.push(cell);
                }
            }
        }
        trimmedGrid.push(row);
    }

    return {
        grid: trimmedGrid,
        offset: { row: minRow, col: minCol },
    };
};

export const createAnagramCrosswordPuzzle = (
    dictionary: string[],
    difficulty: DifficultyConfig,
): PuzzleBundle | null => {
    const normalizedDict = dictionary
        .map(normalizeWord)
        .filter((word) =>
            word.length >= 3 &&
            word.length <= 15 &&
            SWEDISH_ALPHA.test(word)
        );

    // Try with multiple fallback strategies for higher difficulties
    const fallbackStrategies = [
        // Original difficulty
        { ...difficulty },
        // Slightly relaxed
        {
            ...difficulty,
            targetWords: Math.max(4, difficulty.targetWords - 1),
            seedAttempts: difficulty.seedAttempts + 20,
        },
        // More relaxed
        {
            ...difficulty,
            targetWords: Math.max(4, difficulty.targetWords - 2),
            seedAttempts: difficulty.seedAttempts + 40,
            letterCount: Math.max(5, difficulty.letterCount - 1),
        },
    ];

    for (const strategy of fallbackStrategies) {
        // Try multiple times with this strategy
        for (let attempt = 0; attempt < 3; attempt++) {
            const letterSetResult = pickLetterSetAndWords(
                normalizedDict,
                strategy,
            );
            if (!letterSetResult) continue;

            const { letters, words } = letterSetResult;

            // Try to create crossword layout
            const puzzle = layoutCrossword(words);
            if (
                puzzle &&
                puzzle.placedWordCount >= Math.max(4, strategy.targetWords - 2)
            ) {
                return {
                    difficulty,
                    letters,
                    targetWords: puzzle.placedWords.map((pw) => pw.word),
                    puzzle,
                };
            }
        }
    }

    return null;
};

export const findDifficultyById = (id: DifficultyId): DifficultyConfig => {
    const found = DIFFICULTIES.find((d) => d.id === id);
    if (!found) {
        throw new Error(`Unknown difficulty: ${id}`);
    }
    return found;
};

export const revealAllWordsInGrid = (
    grid: CrosswordCell[][],
): CrosswordCell[][] => {
    return grid.map((row) =>
        row.map((cell) => {
            if (cell.blocked) return cell;
            return {
                ...cell,
                value: cell.solution,
            };
        })
    );
};

export const revealWordInGrid = (
    grid: CrosswordCell[][],
    placedWord: CrosswordPlacedWord,
): CrosswordCell[][] => {
    const out = grid.map((row) => row.map((cell) => ({ ...cell })));
    const dr = placedWord.direction === "across" ? 0 : 1;
    const dc = placedWord.direction === "across" ? 1 : 0;

    for (let i = 0; i < placedWord.word.length; i++) {
        const row = placedWord.row + dr * i;
        const col = placedWord.col + dc * i;
        const rowCells = out[row];
        if (!rowCells) continue;
        const cell = rowCells[col];
        if (cell && !cell.blocked) {
            cell.value = cell.solution;
        }
    }

    return out;
};

export const countFilledCells = (grid: CrosswordCell[][]): number => {
    let count = 0;
    for (const row of grid) {
        for (const cell of row) {
            if (!cell.blocked && cell.value) count++;
        }
    }
    return count;
};

export const countPlayableCells = (grid: CrosswordCell[][]): number => {
    let count = 0;
    for (const row of grid) {
        for (const cell of row) {
            if (!cell.blocked) count++;
        }
    }
    return count;
};
