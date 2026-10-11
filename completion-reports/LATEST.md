# Completion report — apply verb Path migration, Rule 2 rewrite, ARCHITECTURE.md

**Finished:** 2026-10-12 00:31 (local)
**Commit:** `48e9147` (CLAUDE.md, ARCHITECTURE.md, CHANGELOG). This report is committed separately, straight after it.
**Deploy:** production deployment `dechats-ebzxp8bhs` is Ready and aliased to https://dechats-learn.vercel.app (HTTP 200, title "DeChats").

## What changed

1. **Migration `20261012002453_verb_learning_path` applied** to the shared project, using master section 15:
   - `supabase db query --linked -f supabase/migrations/20261012002453_verb_learning_path.sql` (ran cleanly, no errors)
   - `supabase migration repair --status applied 20261012002453 --linked` (recorded only that one version)
   - Before applying, I confirmed the file was unchanged since the reviewed commit `a05949e`, after pulling from GitHub.
2. **CLAUDE.md Rule 2 rewritten.** It is now "Apply migrations with the shared-project flow, never `supabase db push`". It points to master section 15 (BUILD → REVIEW → APPLY), gives the two apply commands, and warns never to run the `--status reverted` repair the CLI suggests.
3. **ARCHITECTURE.md:** new "Verb learning Path" section documenting all six tables (columns, defaults, checks, keys, RLS), plus index entries at the top.
4. **CHANGELOG.md:** entries for the apply, the Rule 2 rewrite and the ARCHITECTURE.md update.
5. **Production redeployed** as asked. No app code changed, so the deploy is functionally the same as the previous one.

## Files touched

- `CLAUDE.md`, `ARCHITECTURE.md`, `CHANGELOG.md` (edited)
- `completion-reports/2026-10-12-0031-apply-verb-path-migration.md`, `completion-reports/LATEST.md` (new / overwritten)
- Database: six new tables in `dechats` and one new row in `supabase_migrations.schema_migrations`. No existing table touched.

## Verification done (all read-only after the apply)

- **Row counts:** `verb_units` = 18, `verb_unit_members` = 210. Members per unit: P1 26, P2 10, P3 4, P4 9, P5 6, P6 5, P7 6, P8 3, P9 1, F1 59, F2 11, T1 27, T2 16, T3 5, T4 5, T5 12, T6 3, T7 2.
- **Membership rule:** 0 violations of "each of the 70 verbs is in exactly one unit per tense".
- **RLS:** enabled on all six new tables. Each `user_*` table (`user_unit_progress`, `user_unit_pronoun_progress`, `user_review_items`, `user_verb_streak`) has 4 policies. `verb_units` and `verb_unit_members` have 1 public-read policy each.
- **Old tables unchanged:** I compared row counts for every pre-existing `dechats` table before and after the apply. The diff shows only the six new tables. Unchanged counts include `user_verb_progress` 35, `user_verb_conjugation_progress` 45, `user_verb_mastery_results` 1, `user_verb_match_tree_results` 1, `verbs` 70, `user_word_progress` 566 and `words` 931.
- **Migration history:** `supabase_migrations.schema_migrations` contains `20261012002453 / verb_learning_path`.
- **Public API (anonymous key, `Accept-Profile: dechats`):** `verb_units` and `verb_unit_members` return rows. `user_unit_progress` returns `[]` to an anonymous caller, as intended.
- **Deploy:** `vercel inspect` shows status Ready, target production, alias dechats-learn.vercel.app. The live URL returns 200.

## Unresolved

- **First deploy attempt failed with "Not authorized"** and created no deployment. An immediate retry succeeded. The cause is unknown: the Vercel CLI is outdated (59.11.7, latest 63.x), which may be related. Updating it with `npm i -g vercel@latest` would be worth doing.
- **Not hand-tested:** signed-in writes to the four `user_*` tables (insert/update as yourself, and confirming you can't see other users' rows). Nothing in the app uses these tables yet, so that test belongs with the UI prompt that starts writing to them.
- `design-notes/` (including the source spreadsheet) is still not in git.
