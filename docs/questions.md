# Questions and answers

Main-round seed: `packages/content/data/starter-questions.json`.

Fast Money seed: `packages/content/data/fast-money.json`.

Each is a JSON object with `schemaVersion: 1`, title, scoring source, notice, and questions. Scores are base values; the engine applies multipliers.

```json
{
  "id": "ng-custom-001",
  "category": "music",
  "prompt": "Name a Nigerian female musician.",
  "hostNotes": "Other valid artists may be off-board.",
  "answers": [
    {
      "id": "a1",
      "text": "Tiwa Savage",
      "points": 35,
      "acceptedAlternatives": ["Tiwa"]
    },
    {
      "id": "a2",
      "text": "Yemi Alade",
      "points": 25,
      "acceptedAlternatives": ["Yemi"]
    }
  ]
}
```

Question IDs are unique within a pack; answer IDs are unique within a question. Main packs require at least five questions, with two to eight answers per question. Points must be positive integers up to 100, ordered from highest to lowest. Boards do not have to total 100.

## Host editing

Open **Question library** to search/filter boards. Clicking a question opens its text, notes, answers, points, and aliases. Saving creates a new pack, preserving previous games. To use it, choose that pack during setup.

Import JSON or CSV, review the preview, and confirm the import. Export a pack to obtain the correct CSV header and quoting format. CSV contains one answer per row, and aliases use a pipe separator.

CSV imports default to illustrative provenance because CSV does not carry the full pack metadata. Use JSON to preserve collected-survey or episode-derived provenance and its notice.

## Judgment

Players speak; the host selects one corresponding board answer. Search includes aliases but never reveals answers automatically. Ask for clarification if a guess is broader than the answer. Agree on category boundaries before the round. A factually correct answer can still be off-board.

## Fast Money

A set has exactly five questions. The sum of the top two distinct answers across all five must reach at least 200. Player two cannot reuse player one's answer ID; normalized exact text duplicates are also rejected. The host must recognize semantic duplicates among off-board answers.

## Future sources

The game currently includes no extracted YouTube/X data. Any future sourced pack should identify its source, timestamps or collection details, grouping decisions, and review status. Do not turn unreadable scores into invented survey counts.
