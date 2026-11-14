# Assisted survey review

## Host workflow

1. Close the survey, then choose **Auto review answers**. Already-reviewed questions and existing manually named groups are preserved. Uncheck a question's review box if it needs another pass.
2. Inspect clear suggestions and answer **Merge answers** or **Keep separate** for uncertain pairs. Each contextual suggestion shows the question and explains the proposed match.
3. Choose **Apply suggestions to draft**. Combined answers and the game-board preview update immediately. Original answer rows remain editable underneath. Keep-separate choices are staged too.
4. Check the preview, mark the questions reviewed, then choose **Save grouping and review**. Unsaved labels disappear only after a successful save. A rejected save retains the draft. Refreshing or leaving without saving still discards it.
5. Save a new bank to the question library or download it. Existing exported banks and games do not update automatically.

## What it can recognize

Local rules use the question's wording for common item, food/drink, habit/personality and activity phrases. Examples: phone/mobile phone in a carry-items question; always late/lateness in a habits question; chips/fries in a food question. Contextual synonyms are always host-confirmed because regional meanings and specificity differ. Negated phrases and different owners are not treated as equivalent. Third and fourth variants can be added to one stable group; existing manual labels are never silently renamed.

This is not a general-purpose AI. It may miss jokes, cultural references, unfamiliar synonyms, mixed-language answers or paraphrases. No answers are sent to an external model. All Group fields remain editable. For very large surveys, fuzzy comparisons are bounded to 100 existing targets per question.

## Points and data

Raw response counts are retained. The board includes up to eight groups ranked by count and redistributes 100 integer points across those shown, with at least one point per retained answer. Preview and export share grouping/scoring helpers; omitted groups and response coverage are shown. A 200-to-1 split exports 99-to-1 instead of discarding the rare answer. Two distinct groups and completed review are still required. Previously exported banks need to be regenerated.

## Validation

162 Vitest tests and seven Node checks pass; production build/typecheck pass. Three focused browser flows cover collection/export, 100-point preview, contextual decisions, persistence after reload, draft preservation after a simulated save conflict, and 390px/320px layouts. An initial 320px navigation overflow was reproduced and fixed. Physical Safari remains an owner-device check. No production records were used.

Release status: prepared locally, not deployed. Next: publish the scoped changes when authorized and verify the live bundle/workflows, then have the owner review their actual survey.
