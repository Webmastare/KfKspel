import json
from pathlib import Path


def main(saol_list: str = "all-words.saol.json"):
    """Get valid words from the validated SAOL word list."""
    saol_words = json.loads(Path(saol_list).read_text())

    valid_words = saol_words.get("valid", [])

    with open('all-valid-words.json', 'w') as f:
        json.dump({"words": sorted(set(valid_words))}, f, ensure_ascii=False, indent=2)

    print(f"Hittade {len(valid_words)} tillåtna ord")

if __name__ == "__main__":
    main()