# Completion report — gustar fix via per-unit forms_override

**Finished:** 2026-10-12 01:51 (local)
**Commit:** `c3efb60` (migration, code, docs). This report is committed separately, straight after it.
**Deploy:** production deployment `dechats-hfmf33rc8` is Ready and aliased to https://dechats-learn.vercel.app. `/verb-path/P9` returns 200, and the live bundle contains the override code.

## What changed

1. **Migration `supabase/migrations/20261012014439_unit_forms_override.sql`, written and applied** with the shared-project flow (Rule 2): `supabase db query --linked -f …`, then `supabase migration repair --status applied 20261012014439 --linked`.
   - **Column:** adds a nullable `forms_override JSONB` to `dechats.verb_unit_members`, with a CHECK that it's an object containing yo, tu, el, nosotros and ellos. An optional `english` key holds the prompt verb.
   - **Data:** sets it for gustar's three memberships, each with `english: "like (it)"`:
     - P9: `me gusta / te gusta / le gusta / nos gusta / les gusta`
     - F1: `me gustará … les gustará`
     - T1: `me gustó … les gustó`
   - **Safety:** it runs in one transaction and aborts unless exactly those 3 rows end up set. It's additive only; `dechats.verbs` is untouched.
2. **Shared helpers in `src/utils/arConjugation.js`:**
   - `withFormsOverride(verb, override, conjKey)` attaches a membership's override, tagged with the unit's tense column.
   - `conjForms(verb, conjKey)` returns the override only for that tense, otherwise the stored conjugations.
   - `shortEnglish` uses the override's `english`.
   - The MC, Pronoun and Full Conjugation builders, and `ConjDragRound`, now read forms through `conjForms`.
3. **Loaders attach the override:**
   - `VerbUnitQuiz` (all four sub-stages)
   - `verbPath.loadPathUnit` (unit page yo and él/ella columns)
   - `verbReview.loadReviewSession` (per-item verb copies, so each item expects its own unit's form)
4. **`design-notes/pending-fixes.md`:** the gustar entry is removed (now "None.").
5. **Docs:** `ARCHITECTURE.md` (the `forms_override` column, how overrides flow, column access) and `CHANGELOG.md`.

## Files touched

- New: `supabase/migrations/20261012014439_unit_forms_override.sql`, this report and `completion-reports/LATEST.md`
- Edited: `src/utils/arConjugation.js`, `src/utils/verbPath.js`, `src/utils/verbReview.js`, `src/pages/VerbUnitQuiz.jsx`, `src/pages/VerbPathUnit.jsx`, `src/pages/VerbDragMatch.jsx`, `design-notes/pending-fixes.md`, `ARCHITECTURE.md`, `CHANGELOG.md`

## Verification done

1. **Before applying:** the migration was parse-checked offline (6 statements, check block OK).
2. **After applying (read-only):**
   - P9, F1 and T1 hold the expected forms, and `english` = "like (it)".
   - Exactly 3 overrides exist among 210 memberships.
   - The migration history contains `20261012014439`.
   - The public API serves the column.
3. **New override browser suite (phone width): 33 checks, all passing.**
   - **Helpers:**
     - With no override, the verb object is unchanged.
     - The override applies only to its own tense column.
     - MC and Pronoun prompts show "me gusta · gustar".
     - Full Conjugation reads "I like (it)" / "They like (it)" and expects "me gusta".
     - Answer checking: "me gusta" is exact; stored "gusto" and bare "gusta" are wrong; "Les gusta" is accepted after the usual normalisation.
     - hablar is unchanged ("I speak" → "hablo").
   - **P9 end to end through the real UI:**
     - The drag chips were exactly me/te/le/nos/les gusta, and a drag block advanced the stage.
     - Every MC and Pronoun question showed only override forms.
     - Every Full Conjugation prompt was "<pronoun> like (it)", and 30 typed override answers were accepted.
     - P9 was mastered and seeded 5 gustar review items.
   - **Unit pages:**
     - P9 shows yo "me gusta", él/ella "le gusta".
     - F1 shows "me gustará" / "le gustará".
     - T1 shows "me gustó" / "le gustó".
     - hablar on F1 and T1 still shows hablaré / hablará and hablé / habló.
   - **Daily Review:**
     - gustar items in P9, F1 and T1 prompt "… like (it)" and expect their own unit's override.
     - Override answers moved box 1→2.
     - Typing the stored "gustó" for T1 was marked Incorrect (box 0, due tomorrow).
     - hablar behaved as before.
   - **Phone width:** no horizontal scroll on the P9 drag and question screens or the P9, F1 and T1 unit pages.
4. **Regression: everything rerun and passing.**
   - Node logic test: 16,200 comparisons plus session checks.
   - Engine suite: 129 checks (P9 now through the override forms; P1, P3 and T7 and the old AR quiz smoke test still use stored forms).
   - Path suite: 51 checks.
   - Daily Review suite: 62 checks.

   The test harness was made override-aware: it reads `forms_override` from the live database when working out correct answers.
5. **Lint and build:** lint is clean on all changed files (VerbDragMatch's old warning is unchanged), and `npm run build` succeeds. Screenshots of the P9 drag and Pronoun screens were checked by eye.

## Unresolved / needs a hand test

- **Process note:** you asked for write and apply in one prompt. That skipped the separate REVIEW stage in master section 15 and combined a migration with code changes, which the master file usually keeps apart. The change is additive and easy to reverse (drop the column), and the approval prompt before APPLY described it.
- **Hand test signed in:** open https://dechats-learn.vercel.app/verb-path/P9. It should show yo "me gusta", él/ella "le gusta". Start it; the drag chips should read me/te/le/nos/les gusta.
- **Content decision:** P9's rule text mentions "me gustan (several)", but the override drills only the singular "gusta" forms, as specified. Plural practice would need a separate unit or a second override.
- **Dictionary:** the "View verbs" dictionary popup still shows gustar's stored conjugation table (gusto, gustas…). That's the verb's reference conjugation, and old screens aren't changed.
