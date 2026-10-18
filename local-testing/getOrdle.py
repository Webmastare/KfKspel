import json

import pandas as pd


def get_words(df, length=5):
    return [word for word in df['word'] if len(word) == length]

def get_lemma(df, length=5):
    allowed_letters = set("qwertyuiopåasdfghjklöäzxcvbnm")
    all_lemma = [
        lemma for lemma in df['lemma']
        if len(lemma) == length
        and lemma[0].islower()
        and all(c in allowed_letters for c in lemma)
    ]
    return list(set(all_lemma))

def main():
    # Load the CSV file containing the words
    df = pd.read_csv('raw_ordle_words.csv')
    
    all_words = []
    for i in range(4, 8, 1):
        # words = get_words(df)
        word_length = i
        lemmas = get_lemma(df, length=word_length)
        all_words.extend(lemmas)
        # Write the lemmas to a new file
        with open(f'ordle_words_{word_length}.txt', 'w') as f:
            for lemma in lemmas:
                f.writelines(f'"{lemma}", \n')
        # Write to a JSON file
        with open(f'{word_length}-letters.json', 'w') as f:
            json.dump({"words": sorted(lemmas)}, f, ensure_ascii=False, indent=2)
    # Write all words to a combined JSON file
    with open('allowed-words.json', 'w') as f:
        json.dump({"words": sorted(set(all_words))}, f, ensure_ascii=False, indent=2)

    # Get all words no matter the lenght
    all_words = []
    allowed_letters = set("qwertyuiopåasdfghjklöäzxcvbnm")
    all_lemma = [
        lemma for lemma in df['lemma']
        if lemma[0].islower()
        and all(c in allowed_letters for c in lemma)
    ]
    all_words = list(set(all_lemma))
    # Write all words to a combined JSON file
    with open('all-words.json', 'w') as f:
        json.dump({"words": sorted(set(all_words))}, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()