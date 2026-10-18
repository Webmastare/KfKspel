// Pure search helpers for Ordhjälpen (crossword / Alfapet / Bananagrams helper).
// Kept free of Vue so they are easy to unit test.

export type SearchMode = "contains" | "pattern" | "tiles";

// How a letter in a result word should be highlighted
//  fixed  - matched a letter the user typed (green, like a correct Ordel tile)
//  class  - matched a [abc] letter group (yellow)
//  blank  - covered by a blank tile in tiles mode (grey)
//  none   - matched a wildcard / not part of the query
export type LetterMark = "fixed" | "class" | "blank" | "none";

export interface SearchHit {
    word: string;
    marks: LetterMark[];
}

export type PatternToken =
    | { kind: "start" }
    | { kind: "end" }
    | { kind: "any" }
    | { kind: "single" }
    | { kind: "letter"; letter: string }
    | { kind: "class"; letters: string; negated: boolean };

export interface ParsedPattern {
    tokens: PatternToken[];
    error: string | null;
}

const LETTER_RE = /^[a-zåäöéü]$/;

export function normalizeQuery(input: string): string {
    return input.normalize("NFC").toLocaleLowerCase("sv-SE");
}

export function isLetter(ch: string): boolean {
    return LETTER_RE.test(ch);
}

export function lettersOnly(input: string): string[] {
    return [...normalizeQuery(input)].filter(isLetter);
}

function countLetters(letters: Iterable<string>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const l of letters) counts.set(l, (counts.get(l) ?? 0) + 1);
    return counts;
}

// ---------- Contains mode ----------

// Word must contain every typed letter, anywhere, in any order.
// Repeated letters count: "ss" needs at least two s.
export function matchContains(word: string, required: string[]): SearchHit | null {
    const marks: LetterMark[] = new Array(word.length).fill("none");
    const remaining = countLetters(required);

    for (let i = 0; i < word.length; i++) {
        const ch = word[i]!;
        const left = remaining.get(ch);
        if (left) {
            marks[i] = "fixed";
            remaining.set(ch, left - 1);
        }
    }
    for (const left of remaining.values()) if (left > 0) return null;
    return { word, marks };
}

// ---------- Pattern mode ----------

// Syntax:
//   ^       word starts here          $       word ends here
//   *       any number of letters     ? _ .   exactly one letter
//   [abc]   one of a, b, c            [!abc] / [^abc]  any letter except a, b, c
// Without ^ / $ the pattern may appear anywhere in the word.
export function parsePattern(input: string): ParsedPattern {
    const chars = [...normalizeQuery(input).replace(/\s+/g, "")];
    const tokens: PatternToken[] = [];

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        if (ch === "^") {
            if (i !== 0) return { tokens, error: "^ kan bara stå först i mönstret" };
            tokens.push({ kind: "start" });
        } else if (ch === "$") {
            if (i !== chars.length - 1) {
                return { tokens, error: "$ kan bara stå sist i mönstret" };
            }
            tokens.push({ kind: "end" });
        } else if (ch === "*") {
            // Collapse ** into a single *
            if (tokens.at(-1)?.kind !== "any") tokens.push({ kind: "any" });
        } else if (ch === "?" || ch === "_" || ch === ".") {
            tokens.push({ kind: "single" });
        } else if (ch === "[") {
            const close = chars.indexOf("]", i + 1);
            if (close === -1) return { tokens, error: "Saknar ] för bokstavsgruppen" };
            let body = chars.slice(i + 1, close);
            const negated = body[0] === "!" || body[0] === "^";
            if (negated) body = body.slice(1);
            const bad = body.find((c) => !isLetter(c));
            if (bad !== undefined) {
                return { tokens, error: `Ogiltigt tecken i [ ]: "${bad}"` };
            }
            if (body.length === 0) return { tokens, error: "Tom bokstavsgrupp [ ]" };
            tokens.push({ kind: "class", letters: [...new Set(body)].join(""), negated });
            i = close;
        } else if (isLetter(ch)) {
            tokens.push({ kind: "letter", letter: ch });
        } else {
            return { tokens, error: `Okänt tecken: "${ch}"` };
        }
    }
    return { tokens, error: null };
}

export interface CompiledPattern {
    regex: RegExp;
    // One entry per capture group, telling how the letters it captures are marked
    groupMarks: LetterMark[];
}

export function compilePattern(tokens: PatternToken[]): CompiledPattern | null {
    const body = tokens.filter((t) => t.kind !== "start" && t.kind !== "end");
    if (body.length === 0) return null;

    const anchoredStart = tokens[0]?.kind === "start";
    const anchoredEnd = tokens.at(-1)?.kind === "end";

    // Every letter of the word ends up in exactly one capture group, so the
    // group lengths can be walked in order to know how to mark each letter.
    const parts: string[] = [];
    const groupMarks: LetterMark[] = [];
    const push = (src: string, mark: LetterMark) => {
        parts.push(`(${src})`);
        groupMarks.push(mark);
    };

    if (!anchoredStart) push(".*?", "none");
    for (const t of body) {
        switch (t.kind) {
            case "letter":
                push(t.letter, "fixed");
                break;
            case "single":
                push(".", "none");
                break;
            case "any":
                push(".*?", "none");
                break;
            case "class":
                push(`[${t.negated ? "^" : ""}${t.letters}]`, t.negated ? "none" : "class");
                break;
        }
    }
    if (!anchoredEnd) push(".*", "none");

    return { regex: new RegExp(`^${parts.join("")}$`, "u"), groupMarks };
}

export function matchPattern(word: string, compiled: CompiledPattern): SearchHit | null {
    const m = compiled.regex.exec(word);
    if (!m) return null;

    const marks: LetterMark[] = [];
    for (let g = 0; g < compiled.groupMarks.length; g++) {
        const captured = m[g + 1] ?? "";
        const mark = compiled.groupMarks[g]!;
        for (let k = 0; k < [...captured].length; k++) marks.push(mark);
    }
    return { word, marks };
}

// ---------- Tiles mode (Alfapet / Bananagrams) ----------

export interface Rack {
    letters: Map<string, number>;
    blanks: number;
}

// Letters are tiles; ? or * are blank tiles that can be any letter
export function parseRack(input: string): Rack {
    const chars = [...normalizeQuery(input)];
    return {
        letters: countLetters(chars.filter(isLetter)),
        blanks: chars.filter((c) => c === "?" || c === "*").length,
    };
}

export function rackSize(rack: Rack): number {
    let n = rack.blanks;
    for (const c of rack.letters.values()) n += c;
    return n;
}

export function matchTiles(word: string, rack: Rack): SearchHit | null {
    if (word.length > rackSize(rack)) return null;

    const left = new Map(rack.letters);
    let blanks = rack.blanks;
    const marks: LetterMark[] = [];

    for (const ch of word) {
        const n = left.get(ch) ?? 0;
        if (n > 0) {
            left.set(ch, n - 1);
            marks.push("fixed");
        } else if (blanks > 0) {
            blanks--;
            marks.push("blank");
        } else {
            return null;
        }
    }
    return { word, marks };
}

// ---------- Shared ----------

export interface SearchOptions {
    mode: SearchMode;
    query: string;
    exclude: string[];
}

export interface SearchResult {
    hits: SearchHit[];
    error: string | null;
    // True when the query has nothing to search for yet
    idle: boolean;
}

export function searchWords(words: readonly string[], opts: SearchOptions): SearchResult {
    const exclude = new Set(opts.exclude);
    const excludeOk = (w: string) => exclude.size === 0 || ![...w].some((c) => exclude.has(c));

    let matcher: (w: string) => SearchHit | null;

    if (opts.mode === "contains") {
        const required = lettersOnly(opts.query);
        if (required.length === 0) return { hits: [], error: null, idle: true };
        matcher = (w) => matchContains(w, required);
    } else if (opts.mode === "pattern") {
        const parsed = parsePattern(opts.query);
        if (parsed.error) return { hits: [], error: parsed.error, idle: false };
        const compiled = compilePattern(parsed.tokens);
        if (!compiled) return { hits: [], error: null, idle: true };
        matcher = (w) => matchPattern(w, compiled);
    } else {
        const rack = parseRack(opts.query);
        if (rackSize(rack) === 0) return { hits: [], error: null, idle: true };
        matcher = (w) => matchTiles(w, rack);
    }

    const hits: SearchHit[] = [];
    for (const w of words) {
        if (!excludeOk(w)) continue;
        const hit = matcher(w);
        if (hit) hits.push(hit);
    }
    return { hits, error: null, idle: false };
}
