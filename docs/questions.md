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

## Ihechi's birthday

Select **Ihechi's birthday** in Setup's Question pack control. The 30 regular questions retain the six categories from the owner's document, with hypothetical survey provenance. Existing games are unchanged. You can also import packages/content/data/ihechi-birthday.json through Question library without waiting for a built-in release.

Scores are retained exactly. Questions 26 and 27 total 170 despite the source's 200-point label; questions 28–30 total 200. Review host notes and configured multipliers before playing: the engine still applies its round multipliers, so this pack does not implement the document's separate six-round/double-point rules. Setup uses the existing game sequence; the source's six rounds are categories, not a new game mode.

Birthday Fast Money is excluded: each source question supplies only one answer, while this game's format requires at least two distinct answers. The bonus lightning prompts have no scored answers and are also excluded. Use an existing Fast Money pack until more birthday answers and scores are supplied.

## Shared regular/Fast Money selection (local implementation; release pending)

In Setup, choose a regular bank and enable **Use the regular question bank for Fast Money too**. Select exactly five questions or tap **Mix Fast Money questions** to rotate a suitable set. Those prompts are reserved for the final and removed from the regular queue, including sudden death. At least five regular questions must remain; the Fast Money set must still reach 200 using distinct answers. Nothing rewrites already-created games.

**Exclude questions after this many recorded uses** accepts 1–1000, or blank for no limit. A limit of 2 excludes questions recorded in two or more distinct saved games. Counts combine both round types by case/whitespace-normalized prompt, so copied questions with different IDs share a count. They are not semantic matches. Rehearsals do not count; deleting games or undoing recorded use removes that contribution. The server checks current history again when creating a game, so stale setup cannot bypass exclusions.

This selects from one bank across both modes, rather than combining multiple separate banks. Use your reviewed 29-question birthday survey bank when available; the original illustrative bank still contains all 30 supplied questions.

Fast Money selection uses checkboxes for phone-friendly tapping. Use **Refresh question history** after another game progresses or when the usage preview needs updating.

## Preview and rehearse the selected mix

Expand **Preview the question mix** on setup to see the regular candidate pool, reserved final five and usage exclusions. When shuffle is enabled, this is a pool rather than the eventual round order. Required groups fill opening slots. The final five are shown in pack order, matching game creation and the selected rehearsal. Refresh history before an event; the server checks current history again at game creation.

Choose **Rehearse these five Fast Money questions** to create a separate practice game using that selection. Five different prompts with an attainable combined 200 points are required. Follow the rehearsal checklist to practise timers, passing/returning, the second player's distinct answers and point reveals. Sample rehearsal shortcuts remain available. Practice games never count toward usage limits.

In the host's Phone buzzers card, expand **Event readiness**. Confirm the picture and audible sound yourself; connected-screen counts cannot establish those. Check approved active staged phones for both teams, or explicitly choose spoken answers. Silent play is also supported. The checklist is advisory and local to the current host page, not a persistent certification. Test actual phone latency and TV audio before the event.

These additions are currently local and await full build/UI verification and publication.
