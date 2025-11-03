// Lightweight client-side loader and checker for allowed words
// Expects a UTF-8 text file with one lowercase word per line at `/ordel/allowed-words.txt` in public/

let wordsSet: Set<string> | null = null;
let loadPromise: Promise<void> | null = null;

function normalize(word: string): string {
    // Normalize and lowercase
    return word.trim().normalize("NFC").toLocaleLowerCase("sv-SE");
}

async function loadWords(): Promise<void> {
    if (wordsSet) return;
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const res = await fetch("/ordel/allowed-words.json");
                if (!res.ok) {
                    throw new Error(
                        `Failed to load allowed words: ${res.status}`,
                    );
                }
                const text = await res.json();
                console.log("Fetched allowed-words.txt:", text);

                // Support both newline-delimited and loosely formatted CSV with quotes/commas
                const candidates = text.words;
                console.log("Candidates:", candidates);

                const set = new Set<string>();
                for (const raw of candidates) {
                    const w = normalize(raw);
                    if (w.length === 5) set.add(w);
                }
                wordsSet = set;
                console.log("Loaded", wordsSet, "allowed words");
            } catch (e) {
                // If this fails, keep wordsSet null so server-side validation still applies
                console.warn("Could not load allowed-words.txt", e);
                wordsSet = null;
            } finally {
                loadPromise = null;
            }
        })();
    }
    await loadPromise;
}

export async function isAllowed(word: string): Promise<boolean> {
    if (!wordsSet && !loadPromise) await loadWords();
    if (!wordsSet) return true;
    const normalized = normalize(word);
    console.log("Checking word:", normalized);
    console.log("Words set:", wordsSet);
    return wordsSet.has(normalized);
}

export function useAllowedWords() {
    loadWords();
}
