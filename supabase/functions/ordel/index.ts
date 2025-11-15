/* Ordlista hämtad från olika källor
Separata JSON-filer för olika ordlängder
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { createApp } from "../_shared/app.ts";
import { Context } from "jsr:@hono/hono";

// Import word lists for different lengths
import fourLetterWords from "./4-letters.json" with { type: "json" };
import fiveLetterWords from "./5-letters.json" with { type: "json" };
import sixLetterWords from "./6-letters.json" with { type: "json" };
import sevenLetterWords from "./7-letters.json" with { type: "json" };

const WORD_LISTS = {
  4: fourLetterWords.words,
  5: fiveLetterWords.words,
  6: sixLetterWords.words,
  7: sevenLetterWords.words,
};

const functionName = "ordel";
const app = createApp(`/${functionName}`);
const supabase = createServiceClient();

app.post("/generate-word", async (c: Context) => {
  // Fetch used words from the database
  const { data: usedWordsData, error: usedWordsError } = await supabase
    .from("ordel")
    .select("*");
  if (usedWordsError) {
    console.error("Error fetching used words:", usedWordsError);
    return c.json(
      { error: "Failed to fetch used words" },
      500,
    );
  }

  // Generate words for 7 days ahead, check which dates are missing
  const today = new Date();
  const datesToGenerate = [];
  for (let i = 0; i < 70; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i - 60);
    const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const isDateUsed = usedWordsData?.some(
      (row) => row.date === dateString,
    );
    if (!isDateUsed) {
      datesToGenerate.push(dateString);
    }
  }

  if (datesToGenerate.length === 0) {
    return c.json(
      {
        error: "No dates need words generated",
        datesToGenerate,
      },
      400,
    );
  }

  // Generate words for each length and date
  const generatedWords = [];
  for (const date of datesToGenerate) {
    const wordEntry: Record<string, string> = { date };

    // Generate word for each length (4, 5, 6, 7)
    for (const [lengthStr, wordList] of Object.entries(WORD_LISTS)) {
      const length = parseInt(lengthStr);
      const columnName = `word_${length}`;

      // Get already used words for this length
      const usedWordsForLength = usedWordsData
        ?.map((row) => row[columnName])
        .filter(Boolean) || [];

      // Filter available words for this length
      const availableWords = wordList.filter(
        (word: string) => !usedWordsForLength.includes(word),
      );

      if (availableWords.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        wordEntry[columnName] = availableWords[randomIndex];
      }
    }

    generatedWords.push(wordEntry);
  }

  // Save the selected words to the database
  const { error: insertError } = await supabase
    .from("ordel")
    .insert(generatedWords);
  if (insertError) {
    console.error("Error inserting new words:", insertError);
    return c.json(
      { error: "Failed to insert new words" },
      500,
    );
  }

  return c.json({ generatedWords });
});

// Get available dates (only past dates, not future) with word length availability
app.get("/available-dates", async (c) => {
  const today = new Date().toISOString().split("T")[0];

  const { data: dates, error } = await supabase
    .from("ordel")
    .select("date, word_4, word_5, word_6, word_7")
    .lte("date", today)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching available dates:", error);
    return c.json({ error: "Failed to fetch available dates" }, 500);
  }

  // Transform data to include availability for each word length
  const datesWithAvailability = dates.map((d) => ({
    date: d.date,
    available: {
      4: !!d.word_4,
      5: !!d.word_5,
      6: !!d.word_6,
      7: !!d.word_7,
    },
  }));

  return c.json({ dates: datesWithAvailability });
});

// Get word for a specific date and word length
app.post("/check-word/:date/:length", async (c) => {
  const requestedDate = c.req.param("date");
  const lengthParam = c.req.param("length");
  const { word } = await c.req.json();
  const today = new Date().toISOString().split("T")[0];

  // Prevent accessing future dates
  if (requestedDate > today) {
    return c.json({ error: "Cannot access future dates" }, 403);
  }

  const wordLength = parseInt(lengthParam);
  if (![4, 5, 6, 7].includes(wordLength)) {
    return c.json({ valid: false, error: "Invalid word length" }, 400);
  }

  if (typeof word !== "string" || word.length !== wordLength) {
    return c.json({ valid: false, error: "Invalid word format" }, 400);
  }

  const columnName = `word_${wordLength}`;

  // Get the word for the requested date and length
  const { data: wordData, error: wordError } = await supabase
    .from("ordel")
    .select("word_4, word_5, word_6, word_7")
    .eq("date", requestedDate)
    .single();

  if (wordError) {
    console.error("Error fetching word for date:", wordError);
    return c.json({ error: "Failed to fetch word for date" }, 500);
  }

  let targetWord: string;

  if (columnName === "word_4") {
    targetWord = wordData.word_4;
  } else if (columnName === "word_5") {
    targetWord = wordData.word_5;
  } else if (columnName === "word_6") {
    targetWord = wordData.word_6;
  } else if (columnName === "word_7") {
    targetWord = wordData.word_7;
  } else {
    return c.json({ error: "Invalid word length" }, 400);
  }

  if (!targetWord) {
    return c.json({ error: "No word available for this date and length" }, 404);
  }

  // Count occurrences of each letter in the target word
  const targetLetterCounts = new Map<string, number>();
  for (const letter of targetWord) {
    targetLetterCounts.set(letter, (targetLetterCounts.get(letter) || 0) + 1);
  }

  // First pass: Mark correct letters (green) and decrement counts
  const tempResult: Array<
    { letter: string; correct: boolean; exist: boolean }
  > = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] === targetWord[i]) {
      tempResult.push({ letter: word[i], correct: true, exist: true });
      targetLetterCounts.set(word[i], targetLetterCounts.get(word[i])! - 1);
    } else {
      tempResult.push({ letter: word[i], correct: false, exist: false });
    }
  }

  // Second pass: Mark present letters (yellow) if count allows
  for (let i = 0; i < word.length; i++) {
    if (!tempResult[i].correct) {
      const letter = word[i];
      const remainingCount = targetLetterCounts.get(letter) || 0;
      if (remainingCount > 0) {
        tempResult[i] = { letter, correct: false, exist: true };
        targetLetterCounts.set(letter, remainingCount - 1);
      } else {
        tempResult[i] = { letter, correct: false, exist: false };
      }
    }
  }

  return c.json({ result: tempResult });
});

app.all(
  "*",
  (c) => c.json({ error: "Route not found", path: c.req.path }, 404),
);

Deno.serve(app.fetch);
