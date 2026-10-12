# CLAUDE.md — DeChats Project

> **Read this file in full before making any changes in a session.**
> It is the authoritative reference for file responsibilities, non-negotiable rules, and known issues.

---

## Source File Inventory

### Entry Points

| File | Responsibility |
|------|---------------|
| `src/main.jsx` | React entry point — mounts `<App>` into the DOM |
| `src/App.jsx` | Router setup — all route definitions and the `ProtectedRoute` wrapper |
| `src/index.css` | Global CSS reset and base typography |
| `src/App.css` | Minimal app-level style overrides |

### Utilities

| File | Responsibility |
|------|---------------|
| `src/utils/supabaseClient.js` | Supabase client singleton, initialised from `VITE_SUPABASE_*` env vars |
| `src/utils/courseData.js` | Static data: `VOCAB_THEMES` and `VERB_CATEGORIES` arrays — the source of truth for theme/category IDs and titles |
| `src/utils/verbPath.js` | Shared verb learning Path helpers: `unitStatus` (the ONLY place a unit's status — not started / in progress + stage / mastered — is derived), `nextUpUnit`, `PATH_SECTIONS` (Present → Future → Past), and the Path data loaders |
| `src/utils/arConjugation.js` | Shared conjugation helpers for every conjugation engine (VerbArTenseQuiz, VerbUnitQuiz, Mastery, Match Tree): pronoun constants, `SUB_LABEL`, `CONJ_PASS_PER_PRONOUN`, question builders, answer normalisation/checking, `pronounSequence`. Pure functions only |

### Hooks

| File | Responsibility |
|------|---------------|
| `src/hooks/useAuth.js` | Auth state hook — subscribes to Supabase auth changes, exposes `{ user, loading }` |

### Components

| File | Responsibility |
|------|---------------|
| `src/components/NavBar.jsx` | Top navigation bar with logo, current-route highlighting, and user avatar / logout |
| `src/components/ProtectedRoute.jsx` | Route guard — redirects unauthenticated users to `/login` |
| `src/components/ConjQuestionCard.jsx` | Shared conjugation question/feedback card (MC, Pronoun typed, Full Conjugation typed) used by VerbArTenseQuiz and VerbUnitQuiz. Presentational only — engines own state and scoring |
| `src/components/ConjResultsCard.jsx` | Shared conjugation results card (per-pronoun progress toward 5) used by VerbArTenseQuiz and VerbUnitQuiz |

---

### Pages — Vocabulary Trainer

| File | Route | Responsibility |
|------|-------|---------------|
| `src/pages/Home.jsx` | `/` | Landing screen — navigation cards to Vocabulary Trainer and Verb Trainer |
| `src/pages/Login.jsx` | `/login` | Magic-link auth form — handles Supabase OTP sign-in |
| `src/pages/AuthCallback.jsx` | `/auth/callback` | OAuth / magic-link callback handler — establishes session then redirects to home |
| `src/pages/Dashboard.jsx` | `/vocabulary` | Vocabulary Trainer home — theme cards with mastery progress, entry to vocab quiz and custom quiz |
| `src/pages/Quiz.jsx` | `/quiz/:themeId` | Vocabulary quiz engine — L1 MC, L2 typed-EN, L3 typed-ES stages for a single vocab theme. Reads/writes `words` + `user_word_progress`. |
| `src/pages/CustomQuiz.jsx` | `/custom-quiz` | Vocabulary custom quiz runner — receives word selections from Dashboard, runs a mixed session. Reads/writes `words` + `user_word_progress`. |
| `src/pages/Dictionary.jsx` | `/dictionary` | Searchable/filterable list of all vocab words with mastery indicators |
| `src/pages/HiddenWords.jsx` | `/hidden` | Management screen for words hidden/snoozed from the quiz pool |
| `src/pages/Polish.jsx` | `/polish` | "Polish mode" — surfaces near-mastered vocab words for review |

---

### Pages — Verb Trainer

| File | Route | Responsibility |
|------|-------|---------------|
| `src/pages/VerbTrainer.jsx` | `/verbs` | Verb Trainer home = the verb learning **Path**: all 18 units in sort order under Present → Future → Past, each with code, pattern, verb count and status; "Next up" highlight and a Continue button for the first unmastered unit; Verb Dictionary button. Refetches on every visit. Reads only the Path tables (via `verbPath.js`). |
| `src/pages/VerbPathUnit.jsx` | `/verb-path/:unitId` | Path unit page — pattern card (rule + examples), status, visible verbs with that tense's yo / él-ella forms, Start/Continue into `/verb-unit/:unitId`, and "View verbs" (FilteredDictionaryModal). Refetches on every visit. |
| `src/pages/VerbQuiz.jsx` | `/verb-quiz/:categoryId` | Main verb conjugation quiz engine for general verb categories. Handles L1 drag-and-match, L2 MC, L3 typed, L4 typed. Reads/writes `user_verb_progress`. **Do not share logic with `Quiz.jsx` or `VerbArTenseQuiz.jsx`.** |
| `src/pages/VerbArTenseQuiz.jsx` | `/verb-ar-tense-quiz` | AR tense-specific quiz (Present → Past → Future). Runs 10-question pronoun-by-pronoun sessions with a pass threshold of 5 correct per pronoun. Reads/writes `user_verb_progress` columns: `t1_cj_stage`, `t2_cj_stage`, `t3_cj_stage`, `t1_score`, `t2_score`, `t3_score`. **Do not share logic with `Quiz.jsx` or `VerbQuiz.jsx`.** |
| `src/pages/VerbUnitQuiz.jsx` | `/verb-unit/:unitId` | Verb learning Path conjugation engine — runs any of the 18 units in `verb_units` through Drag & Match → MC → Pronoun → Full Conjugation with the 5-per-pronoun pass rule. Reads/writes only `user_unit_progress` + `user_unit_pronoun_progress` (plus a read-only hidden filter on `user_verb_progress`). URL-only for now. **Do not share logic with the other quiz engines except via the shared modules.** |
| `src/pages/VerbDragMatch.jsx` | *(component, not routed)* | Shared drag-and-match component library — exports `ConjDragRound`, used by VerbQuiz, VerbArTenseQuiz and VerbUnitQuiz for drag sessions |
| `src/pages/VerbProgress.jsx` | *(component, not routed)* | Shared progress display library — exports `VerbProgressRow`, `PronounProgressView`, and `PRONOUNS` constants; used by VerbCategoryModal |
| `src/pages/VerbCategoryModal.jsx` | *(overlay, not routed)* | Old verb category card overlay — shows per-verb progress rows, hide/unhide controls, and entry into quiz. Imports from VerbProgress. **No longer opened from anywhere** since the Path replaced the category home (2026-10-12); code kept in place. |
| `src/pages/VerbCustomQuizSelect.jsx` | `/verb-custom-quiz-select` | Custom quiz configuration screen — verb-level toggles (L1–L4) and session-only per-verb exclusion. Passes selections to VerbCustomQuiz. |
| `src/pages/VerbCustomQuiz.jsx` | `/verb-custom-quiz` | Custom quiz runner — receives selections from VerbCustomQuizSelect and runs the chosen levels for each verb |
| `src/pages/VerbDictionary.jsx` | `/verb-dictionary` | Searchable list of all verbs with family/progress indicators; links to VerbDetail |
| `src/pages/VerbDetail.jsx` | `/verb-dictionary/:verbId` | Single-verb detail view — family stamp, full conjugation table (Present/Past/Future), and stage progress strip. Read-only, no quiz actions. |

---

## Rules

These rules apply in every session. Do not deviate without explicit user instruction.

### 1 — Never let logic bleed between quiz engines

`Quiz.jsx`, `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` and `VerbUnitQuiz.jsx` are completely separate quiz engines. They serve different content types and different progress schemas. Never share state, helper functions, or scoring logic across these files. If a utility is genuinely common (e.g. a shuffle function) it must live in a shared util, not be copied from one quiz file to another. The conjugation engines (`VerbArTenseQuiz.jsx`, `VerbUnitQuiz.jsx`) share `src/utils/arConjugation.js`, `src/components/ConjQuestionCard.jsx` and `src/components/ConjResultsCard.jsx`.

### 2 — Apply migrations with the shared-project flow, never `supabase db push`

Schema changes follow the master CLAUDE.md **section 15** three-stage flow: BUILD (write the file, don't run it) → REVIEW (Barry approves; amendments go in the same file) → APPLY (in the next prompt). DeChats lives on the **shared** Supabase project, where `supabase db push` refuses because the remote history holds other apps' versions. APPLY like this instead:

```bash
supabase db query --linked -f supabase/migrations/<version>_<name>.sql
supabase migration repair --status applied <version> --linked
```

The second command records **only that one version**. Never run the `supabase migration repair --status reverted …` the CLI may suggest — it would wipe other apps' migration history. After applying, verify with read-only queries, and don't leave an approved migration unapplied.

### 3 — Always refetch Supabase data when navigating back to a screen

Do not rely on stale in-memory state when a user navigates back. Screens that show Supabase-backed data must re-run their data fetch on mount (or on focus/visibility if using a listener). Use `useLocation` key or an effect dependency on navigation state to trigger refetches where needed.

### 4 — Never hardcode progress states

Progress values (stage numbers, score thresholds, mastery flags) must always be derived from live Supabase data for the authenticated user. Do not substitute hard-coded fallback states that would misrepresent actual progress.

### 5 — Session lengths are fixed

| Quiz type | Session length |
|-----------|---------------|
| L1 — Drag and match | 5 rounds |
| L2 — Multiple choice | 25 questions |
| L3 — Typed | 10 questions |
| L4 — Typed | 10 questions |

### 6 — AR tense stage pass condition

Each AR tense stage (Present / Past / Future) runs a 10-question session. The pass condition is **5 correct answers per pronoun** (yo, tú, él/ella, nosotros, ellos/ellas). Passing all pronouns advances the `t_cj_stage` column for that tense. Do not change question count or pass threshold without explicit instruction.

---

## Completion reports

At the end of **every** task — including one that failed, was abandoned partway, or was blocked — Claude Code writes a completion report. It is written in addition to the usual terminal summary, never instead of it.

1. **File:** `completion-reports/<YYYY-MM-DD-HHMM>-<slug>.md`, using the local time the work finished (`date '+%Y-%m-%d-%H%M'`) and a short kebab-case slug for the task, e.g. `completion-reports/2026-10-12-0030-verb-path-migration.md`. Create the folder if it is missing.
2. **Latest copy:** overwrite `completion-reports/LATEST.md` with an exact copy of the same report.
3. **Content**, using these headings:
   - **What changed** — the outcome in plain language, including what did *not* get done if the task failed.
   - **Files touched** — every file created, edited or deleted.
   - **Verification done** — what was checked and how (commands, queries, manual checks), with the result.
   - **Unresolved** — anything not verified, needing a hand test, still broken, or waiting on a decision from Barry. Write "None" if empty.
   - The commit hash, or "no commit".
4. **Order:** write the report after the final commit/push/deploy so it carries the real hash and outcome, then commit the report itself.
5. **In this repo the reports are committed to git** (not gitignored), so they travel with the code. This overrides the master file's suggestion to gitignore the folder.

---

## Permission prompts

Whenever Claude Code is about to ask for permission to run a bash command, it must first give a one-sentence plain English explanation of what the command does and why, written for a non-technical reader. Put the explanation in the reply immediately before the tool call, so it is on screen when the approval prompt appears.

Format:

> This command [plain English description of what it does], so that [reason].

Guidelines:

- No jargon, no flag names, no file paths unless the path is the point. Say "saves a snapshot of the changes" rather than "runs `git commit`".
- Say what the command *changes*, and be explicit when it changes nothing (read-only) — that is the most useful thing to know before approving.
- Flag anything hard to undo — deleting files, force-pushing, rewriting history, pushing to production — in the same sentence.
- One command, one sentence. For a batched or piped command, describe the overall effect rather than each part.

Scope note: this rule governs the text Claude writes before the call. The approval dialog itself is rendered by Claude Code and cannot be modified from this file, so the explanation appears in the message above it, not inside the prompt box.

---

## Known Issues

*This section should be updated whenever a bug or limitation is discovered. Include the date and a brief description.*

| Date | Issue | Status |
|------|-------|--------|
| 2026-06-08 | `VerbCategoryModal` tense unlock state is sometimes out of sync with `VerbTrainer` home card progress display | Obsolete — the category home was replaced by the Path on 2026-10-12 |
| 2026-06-08 | Hidden verbs are excluded from regular quizzes but still appear in the custom quiz screen | Open |
| 2026-06-08 | AR tense quiz occasionally serves wrong tense conjugations as prompts | Open |
| 2026-06-08 | `VerbDetail.jsx` stage progress bars show tense completion as grey despite user having completed tenses | Open |
