# Assisted survey review

## Guided point-preserving merges

Close the survey and choose **Review one question at a time**. Select two or more board answers, enter their combined name, check the summed response count/points and click **Confirm merge**. This saves the merge, replaces those board cards with one, and leaves other points unchanged. Original responses remain expandable and become accepted alternatives. **Undo last merge** restores the last merge for that question, including after a refresh. Only board answers can be selected; previously omitted groups are not automatically promoted. At least two answers must remain.

Use **Suggested selections** for contextual suggestions, **Previous question**, **Skip for now**, or **Go to question** to move around. **Save and next question** marks that question reviewed after saving. Export becomes available once all questions are reviewed. **Show all questions** returns to manual Group fields. Editing those fields or reopening collection resets fixed merge scores and Undo; the points are then recalculated. Confirm merge saves any current grouping draft first; failed/conflicting requests are reported and must be checked before retrying.

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

Release status: deployed in 55343a3 on 14 November 2026. Azure and browser workflows passed and live bundle index-BNbHKYzp.js was verified. Next: save any current edits before refreshing Surveys, review the actual survey, and regenerate the intended bank.
