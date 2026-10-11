# Completion report — verb learning Path migration + completion-report rule

**Finished:** 2026-10-12 00:26 (local)
**Commit:** `a05949e` (migration, CLAUDE.md, CHANGELOG). This report is committed separately, straight after it.
**Status:** MIGRATION READY FOR REVIEW. It has **not** been applied to the database.

## What changed

1. **CLAUDE.md:** new "Completion reports" section. Every task, even a failed one, ends with `completion-reports/<YYYY-MM-DD-HHMM>-<slug>.md` plus an identical `completion-reports/LATEST.md`, covering what changed, files touched, verification done, anything unresolved, and the commit hash. In this repo the reports are committed to git.
2. **Migration written, not applied:** `supabase/migrations/20261012002453_verb_learning_path.sql`. It is one transaction, all in the `dechats` schema, and only adds things:
   - `verb_units`: 18 rows seeded from the Plan tab. `sort_order` runs 1–18 in Plan order (P1–P9, F1–F2, T1–T7). `tense` is 1 for Present, 2 for Past and 3 for Future. A check makes the step letter agree with the tense. Anyone can read it, like `verbs`.
   - `verb_unit_members`: 210 rows seeded from the Verbs tab's Present/Future/Past step columns and matched to `verbs` by `spanish_infinitive`. Anyone can read it. The migration aborts with the unmatched names if any verb fails to match or the sheet doesn't give 70 verbs. It aborts again unless there are exactly 210 rows and every verb is in exactly one unit per tense.
   - `user_unit_progress`: primary key (user_id, unit_id), `sub_stage` 0–4 (default 0), `mastered_at`, timestamps.
   - `user_unit_pronoun_progress`: mirrors `user_verb_conjugation_progress` (uuid id, sub_stage 1–3, pronoun yo/tu/el/nosotros/ellos, correct_count ≥ 0), unique on (user_id, unit_id, sub_stage, pronoun).
   - `user_review_items`: box 0–5 (default 0), `due_on` (default today), `last_correct_on`, `last_seen_at`, timestamps. Unique on (user_id, unit_id, verb_id, pronoun), with an index on (user_id, due_on).
   - `user_verb_streak`: user_id is the primary key. Holds current/longest streak (default 0, never negative) and `last_active_on`.
   - Every `user_*` table: RLS on, own-row select/insert/update/delete policies in the same form as the existing ones, and `user_id` linked to `auth.users` so a user's rows are deleted with their account.
3. **CHANGELOG.md:** entries for both changes.

## Files touched

- `CLAUDE.md` (edited)
- `CHANGELOG.md` (edited)
- `supabase/migrations/20261012002453_verb_learning_path.sql` (new)
- `completion-reports/2026-10-12-0026-verb-path-migration.md` and `completion-reports/LATEST.md` (new)

## Verification done

- **Live database (read-only queries only):** `dechats.verbs` has 70 rows with 70 distinct infinitives. All 70 sheet verbs match exactly, accents included (`oír`), with no unmatched names either way. None of the six new table names already exist. `verbs.id` is `bigint`, and `verbs` uses the policy "Verbs are publicly readable" (`USING (true)`), which the new static tables copy.
- **Spreadsheet consistency:** for every unit except F1, the Plan tab's verb list matches the Verbs tab exactly. For every unit, the Plan tab's verb count matches the number of verbs the Verbs tab assigns to it (F1 = 59). The total is 210.
- **SQL syntax:** parsed offline with the Postgres parser (pglast). All 40 statements parse, and so do both check blocks. The file never touched the database.
- **Safety scan:** the file has no DROP, TRUNCATE, DELETE or UPDATE, and makes no change to any existing table. Its 6 ALTERs only turn on RLS for the new tables.

## Unresolved / decisions for Barry

- **Not applied, as asked.** The next step is APPLY, using the shared-project flow in master section 15 (`supabase db query --linked -f …` then `supabase migration repair --status applied 20261012002453 --linked`), **not** `supabase db push`.
- **Project CLAUDE.md Rule 2 conflicts with this workflow.** It says "Always run `supabase db push --linked` after any schema change… before the session ends". The master three-stage flow, and this task, say the opposite, and `db push` refuses on the shared project anyway. Should Rule 2 be rewritten to point at master section 15?
- **Completion reports are committed here,** as this task asked. The master CLAUDE.md says to gitignore the folder, so the new dechats rule says explicitly that the dechats version wins. Confirm that's what you want.
- **Design choices worth a glance in review:**
  - `user_review_items` links (unit_id, verb_id) to `verb_unit_members` as a pair, not to `verb_units` and `verbs` separately, so a review item can only exist for a verb that really belongs to its unit.
  - Unit and verb links have no cascade delete, so removing a unit or verb that progress refers to is blocked rather than silently wiping progress.
  - `due_on` defaults to today.
  - As with the existing tables, there is no automatic `updated_at` trigger: the app must set `updated_at` on update.
  - The rule text, example forms and diary prompts are copied word for word from the sheet, including the "…" character and the em dashes.
- **Old verb-category UI and progress stay as they are.** Nothing reads the new tables yet. That's later prompts.
