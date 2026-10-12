# ARCHITECTURE.md — DeChats Supabase Schema

> Generated from `supabase/migrations/` and `src/` source files.
> Update this file whenever a schema change is made or a component's data access changes.

---

## Tables

- [profiles](#profiles)
- [words](#words)
- [user\_word\_progress](#user_word_progress)
- [verbs](#verbs)
- [user\_verb\_progress](#user_verb_progress)
- [saved\_quizzes](#saved_quizzes)
- [verb\_units](#verb_units)
- [verb\_unit\_members](#verb_unit_members)
- [user\_unit\_progress](#user_unit_progress)
- [user\_unit\_pronoun\_progress](#user_unit_pronoun_progress)
- [user\_review\_items](#user_review_items)
- [user\_verb\_streak](#user_verb_streak)

---

## `profiles`

Stores one row per authenticated user. Created on first login via `AuthCallback.jsx` or implicitly on first quiz load via `Quiz.jsx` / `VerbQuiz.jsx`.

**Unique constraint:** `id`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | — | Primary key; equals `auth.users.id` |
| `email` | TEXT | — | User's email address |
| `full_name` | TEXT | NULL | From `user_metadata.full_name` at login |
| `avatar_url` | TEXT | NULL | From `user_metadata.avatar_url` at login |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `id` | `AuthCallback.jsx` | `AuthCallback.jsx`, `Quiz.jsx`, `VerbQuiz.jsx` |
| `email` | — | `AuthCallback.jsx`, `Quiz.jsx`, `VerbQuiz.jsx` |
| `full_name` | — | `AuthCallback.jsx` |
| `avatar_url` | — | `AuthCallback.jsx` |

**Notes:**
- `AuthCallback.jsx` does a `select('id')` existence check then `insert` on first login.
- `Quiz.jsx` and `VerbQuiz.jsx` call `upsert({ id, email }, { onConflict: 'id' })` as a guard on every quiz load — they do not read from `profiles`.

---

## `words`

Static vocabulary content table. No component writes to it; all rows are seeded via migrations or Supabase Studio.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | INTEGER | — | Primary key |
| `english` | TEXT | — | English translation |
| `spanish` | TEXT | — | Spanish word |
| `theme` | TEXT | — | Vocab theme title (matches `VOCAB_THEMES[].title` in `courseData.js`) |
| `phonetic` | TEXT | NULL | Phonetic pronunciation hint (added in `20260530120000`; not yet read by any component) |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `id` | `Dashboard.jsx`, `Quiz.jsx`, `CustomQuiz.jsx`, `Dictionary.jsx`, `HiddenWords.jsx` (join), `Polish.jsx` (join) | — |
| `english` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dictionary.jsx`, `HiddenWords.jsx` (join), `Polish.jsx` (join) | — |
| `spanish` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dictionary.jsx`, `HiddenWords.jsx` (join), `Polish.jsx` (join) | — |
| `theme` | `Dashboard.jsx`, `Quiz.jsx`, `Dictionary.jsx`, `HiddenWords.jsx` (join) | — |
| `phonetic` | *(unused)* | — |

**Notes:**
- `HiddenWords.jsx` and `Polish.jsx` access word content via a Supabase relational join from `user_word_progress`: `.select('id, word_id, words(english, spanish, theme)')`.
- `phonetic` was added in migration `20260530120000` but is not yet selected in any component.

---

## `user_word_progress`

Tracks each user's learning progress for each vocabulary word. One row per `(user_id, word_id)` pair.

**Unique constraint:** `(user_id, word_id)`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | INTEGER | — | Primary key |
| `user_id` | UUID | — | FK → `auth.users.id` |
| `word_id` | INTEGER | — | FK → `words.id` |
| `stage` | INTEGER | 1 | Current learning stage: 1 = MC, 2 = typed EN, 3 = typed ES |
| `consecutive_correct` | INTEGER | 0 | Correct answers in a row in the current stage |
| `hidden` | BOOLEAN | false | Whether the word is snoozed from quiz sessions |
| `mastered` | BOOLEAN | false | Set true when S3 reaches 5 consecutive correct |
| `polish_correct` | INTEGER | 0 | Correct answers in Polish mode (not in migrations — legacy column) |
| `polish_incorrect` | INTEGER | 0 | Incorrect answers in Polish mode (not in migrations — legacy column) |
| `s1_incorrect` | INTEGER | 0 | Total incorrect answers at stage 1 (added `20260605120000`) |
| `s2_incorrect` | INTEGER | 0 | Total incorrect answers at stage 2 (added `20260605120000`) |
| `s3_incorrect` | INTEGER | 0 | Total incorrect answers at stage 3 (added `20260605120000`) |
| `s1_resets` | INTEGER | 0 | Number of times stage 1 was reset (added `20260605120000`) |
| `s2_resets` | INTEGER | 0 | Number of times stage 2 was reset (added `20260605120000`) |
| `s3_resets` | INTEGER | 0 | Number of times stage 3 was reset (added `20260605120000`) |
| `total_incorrect` | INTEGER | 0 | Total incorrect answers across all stages (added `20260605120000`) |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `id` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx`, `Polish.jsx` | — |
| `user_id` | — | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx` |
| `word_id` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx`, `HiddenWords.jsx`, `Polish.jsx` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx` |
| `stage` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx` |
| `consecutive_correct` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx` | `Quiz.jsx`, `CustomQuiz.jsx` |
| `hidden` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx`, `HiddenWords.jsx` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx`, `HiddenWords.jsx` |
| `mastered` | `Quiz.jsx`, `CustomQuiz.jsx`, `Dashboard.jsx`, `Dictionary.jsx` | `Quiz.jsx`, `CustomQuiz.jsx` |
| `polish_correct` | `Polish.jsx` | `Polish.jsx` |
| `polish_incorrect` | `Polish.jsx` | `Polish.jsx` |
| `s1_incorrect` | `Quiz.jsx` | `Quiz.jsx` |
| `s2_incorrect` | `Quiz.jsx` | `Quiz.jsx` |
| `s3_incorrect` | `Quiz.jsx` | `Quiz.jsx` |
| `s1_resets` | `Quiz.jsx` | `Quiz.jsx` |
| `s2_resets` | `Quiz.jsx` | `Quiz.jsx` |
| `s3_resets` | `Quiz.jsx` | `Quiz.jsx` |
| `total_incorrect` | `Quiz.jsx` | `Quiz.jsx` |

**Notes:**
- `Dashboard.jsx` reads `hidden` to filter the word list and writes it when the user toggles hide from the quiz selector panel.
- `HiddenWords.jsx` sets `hidden = false` (unhide only) via `.update({ hidden: false })`.
- `polish_correct` / `polish_incorrect` are not in any migration file — they pre-exist in the original schema.

---

## `verbs`

Static verb content table. No component writes to it; all rows and schema changes are managed via migrations.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | INTEGER | — | Primary key |
| `spanish_infinitive` | TEXT | — | Infinitive form (e.g. `hablar`) |
| `english` | TEXT | — | Primary English translation |
| `english_alt1` | TEXT | NULL | Alternate English meaning 1 (pre-migration column) |
| `english_alt2` | TEXT | NULL | Alternate English meaning 2 (pre-migration column) |
| `category` | TEXT | — | Verb group (e.g. `'Verbs -AR'`, `'Core Verbs'`, `'Stem-Changing O→UE'`, etc.) |
| `verb_family` | TEXT | NULL | Family tag: `'regular-ar'`, `'regular-er'`, `'regular-ir'`, `'irregular'` (added `20260521140000`) |
| `requires_all_answers` | BOOLEAN | false | If true, L3 typed stage shows one input per slash-separated meaning (added `20260521120000`) |
| `present_conjugations` | JSONB | — | Map of pronoun key → conjugated form for present tense |
| `past_conjugations` | JSONB | — | Map of pronoun key → conjugated form for past tense |
| `future_conjugations` | JSONB | — | Map of pronoun key → conjugated form for future tense |

Pronoun keys used in conjugation objects: `yo`, `tu`, `el`, `nosotros`, `ellos`.

**Reusable filtered Verb Dictionary modal (`FilteredDictionaryModal.jsx`):** a popup overlay (not a navigation) that takes a set of verbs and shows a condensed, searchable dictionary of just those verbs, each expandable to its Present/Past/Future conjugation table. It fetches the `verbs` conjugation columns for the given ids. Reused from the category options popup (`VerbCategoryModal.jsx`, filtered to that category) and from the verb quiz conclusion screen (`VerbQuiz.jsx`, filtered to the just-quizzed category).

**Regular -AR endings cheat sheet:** when `FilteredDictionaryModal` is passed `showEndings` (only for the Verbs -AR category), it adds an "-AR Endings" tab. The endings are **derived at runtime** from the fetched conjugation data — for each tense/pronoun it strips the stem (infinitive minus the final `ar`) from each verb's form and takes the most common remainder — and rendered as `___` + ending (e.g. `___o`, `___é`, `___aré`). It is never shown for the other categories, which contain irregular AR verbs. It is presented in two places: the tab inside the AR dictionary modal, and an option on the Verbs -AR quiz conclusion screen (which opens the modal on that tab).

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `id` | `VerbCategoryModal.jsx`, `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCustomQuiz.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx`, `VerbUnitQuiz.jsx`, `VerbPathUnit.jsx` | — |
| `spanish_infinitive` | `VerbCategoryModal.jsx`, `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCustomQuiz.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | — |
| `english` | `VerbCategoryModal.jsx`, `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCustomQuiz.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | — |
| `english_alt1` | `VerbQuiz.jsx` | — |
| `english_alt2` | `VerbQuiz.jsx` | — |
| `category` | `VerbCategoryModal.jsx`, `VerbCustomQuiz.jsx`, `VerbDictionary.jsx` | — |
| `verb_family` | `VerbDictionary.jsx`, `VerbDetail.jsx` | — |
| `requires_all_answers` | `VerbQuiz.jsx` | — |
| `present_conjugations` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | — |
| `past_conjugations` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | — |
| `future_conjugations` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | — |

**Notes:**
- `english_alt1` / `english_alt2` are not in any migration file — pre-existing columns. `VerbQuiz.jsx` renders them as hint text in the L3/L4 typed stages.
- `VerbArTenseQuiz.jsx` also queries `verbs` with `.eq('category', 'Verbs -AR')` to get the list of AR verb IDs for the stage-2 reset guard.

---

## `user_verb_progress`

Tracks each user's learning progress for each verb across all quiz stages. One row per `(user_id, verb_id)` pair.

**Unique constraint:** `(user_id, verb_id)`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | INTEGER | — | Primary key |
| `user_id` | UUID | — | FK → `auth.users.id` |
| `verb_id` | INTEGER | — | FK → `verbs.id` |
| `current_stage` | INTEGER | 1 | Current L-stage: 1=L1 drag, 2=L2 MC, 3=L3 typed, 4=L4 typed |
| `drag_match_score` | INTEGER | 0 | Cumulative correct drag rounds (L1); advances stage at 5 |
| `stage2_mastery` | INTEGER | 0 | Score within L2 MC; advances stage at 3 |
| `stage3_mastery` | INTEGER | 0 | Score within L3 typed; advances stage at 3 |
| `l4_score` | INTEGER | 0 | Score within L4 typed; verb mastered at 5 |
| `hidden` | BOOLEAN | false | Whether the verb is hidden from quiz sessions (added `20260521130000`) |
| `t1_score` | INTEGER | 0 | Score within the current AR present-tense sub-stage (added `20260603130000`) |
| `t2_score` | INTEGER | 0 | Score within the current AR past-tense sub-stage (added `20260603130000`) |
| `t3_score` | INTEGER | 0 | Score within the current AR future-tense sub-stage (added `20260603130000`) |
| `t1_cj_stage` | INTEGER | 0 | AR present-tense conjugation sub-stage (0–4); 4 = tense mastered (added `20260604120000`) |
| `t2_cj_stage` | INTEGER | 0 | AR past-tense conjugation sub-stage (0–4); 4 = tense mastered (added `20260604120000`) |
| `t3_cj_stage` | INTEGER | 0 | AR future-tense conjugation sub-stage (0–4); 4 = tense mastered (added `20260604120000`) |
| `l1_incorrect` | INTEGER | 0 | Total incorrect answers at L1 (added `20260605120000`) |
| `l2_incorrect` | INTEGER | 0 | Total incorrect answers at L2 (added `20260605120000`) |
| `l3_incorrect` | INTEGER | 0 | Total incorrect answers at L3 (added `20260605120000`) |
| `l4_incorrect` | INTEGER | 0 | Total incorrect answers at L4 (added `20260605120000`) |
| `l1_resets` | INTEGER | 0 | Number of times L1 was reset (added `20260605120000`) |
| `l2_resets` | INTEGER | 0 | Number of times L2 was reset (added `20260605120000`) |
| `l3_resets` | INTEGER | 0 | Number of times L3 was reset (added `20260605120000`) |
| `l4_resets` | INTEGER | 0 | Number of times L4 was reset (added `20260605120000`) |
| `total_incorrect` | INTEGER | 0 | Total incorrect answers across all levels (added `20260605120000`) |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `id` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | — |
| `user_id` | — | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` |
| `verb_id` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` |
| `current_stage` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` |
| `drag_match_score` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx` |
| `stage2_mastery` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx` |
| `stage3_mastery` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx` |
| `l4_score` | `VerbQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDictionary.jsx`, `VerbDetail.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` |
| `hidden` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbUnitQuiz.jsx`, `VerbPathUnit.jsx` (via `verbPath.js`) *(read-only, hidden filter)* | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` *(session toggle)*, `VerbCategoryModal.jsx` |
| `t1_score` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` *(reset)* |
| `t2_score` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` *(reset)* |
| `t3_score` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx`, `VerbDetail.jsx` | `VerbArTenseQuiz.jsx`, `VerbCategoryModal.jsx` *(reset)* |
| `t1_cj_stage` | `VerbArTenseQuiz.jsx`, `VerbDetail.jsx` | `VerbArTenseQuiz.jsx` |
| `t2_cj_stage` | `VerbArTenseQuiz.jsx`, `VerbDetail.jsx` | `VerbArTenseQuiz.jsx` |
| `t3_cj_stage` | `VerbArTenseQuiz.jsx`, `VerbDetail.jsx` | `VerbArTenseQuiz.jsx` |
| `l1_incorrect` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l2_incorrect` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l3_incorrect` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l4_incorrect` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l1_resets` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l2_resets` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l3_resets` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `l4_resets` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |
| `total_incorrect` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` | `VerbQuiz.jsx`, `VerbArTenseQuiz.jsx` |

**Notes on `t_n_cj_stage` sub-stage encoding:**
- `0` = sub-stage 1 (drag & match) in progress
- `1` = sub-stage 2 (MC) in progress — drag done
- `2` = sub-stage 3 (typed conj → EN) in progress
- `3` = sub-stage 4 (typed EN → conj) in progress
- `4` = all four sub-stages done; tense mastered

**Two separate pass systems — infinitive vs conjugation (do not mix):**

The verb trainer has two completely independent progression systems with different pass rules. They share neither thresholds nor logic.

| | Infinitive verb-learning (`VerbQuiz.jsx`) | AR tense conjugation (`VerbArTenseQuiz.jsx`) |
|---|---|---|
| Purpose | Learn the verbs themselves (L1–L4) | Drill each subject pronoun (Present/Past/Future) |
| Granularity | **Per-verb** — each verb advances independently | **Per-pronoun, cohort** — all verbs of a tense advance together |
| Pass rule | Per-verb thresholds: L1 `drag_match_score >= 5`; L2 `stage2_mastery >= 3`; L3 `stage3_mastery >= 3`; L4 `l4_score >= 5` (inline in `VerbQuiz.jsx`) | Flat **5 correct per pronoun** on every sub-stage: `STAGE2_PER_PRONOUN_THRESHOLD = 5`. A sub-stage advances only when all five pronouns (Yo, Tú, Él/Ella, Nosotros, Ellos/Ellas) reach 5 → `advanceAllVerbsFromSub` raises `t_n_cj_stage` for the whole cohort |
| Columns | `current_stage`, `drag_match_score`, `stage2_mastery`, `stage3_mastery`, `l4_score` | `t_n_cj_stage` (the authoritative sub-stage); `t_n_score` is a legacy per-verb score and does **not** gate conjugation progression |

All conjugation stage-completion / results cards render through a single shared `ConjResultsCard` component in `VerbArTenseQuiz.jsx`. Both the drag sub-stage (`drag-summary` phase) and the MC/typed sub-stages (`session-summary` phase) pass their per-pronoun cumulative counts to it, so every sub-stage and tense displays each pronoun as cumulative-correct out of a uniform denominator of five (dots match the count), with the per-session score shown separately. There is no per-sub-stage results rendering that can diverge.

There is **no** per-verb pass counter or per-sub-stage threshold in the conjugation flow. The old `SUB_THRESHOLD = {0:5,1:3,2:3,3:5}` per-verb counter was removed from `VerbArTenseQuiz.jsx`; conjugation now depends solely on the five-correct-per-pronoun gate, applied identically across all four sub-stages of all three tenses. The infinitive thresholds in `VerbQuiz.jsx` are unrelated and unchanged.

**Conjugation per-pronoun counts are stored in Supabase, not localStorage.** The five-per-pronoun graduation counters live in the `user_verb_conjugation_progress` table (one row per `user_id, tense, sub_stage, pronoun`, integer `correct_count`), so they carry reliably across sessions and devices. `VerbArTenseQuiz.jsx` loads a sub-stage's counts from the DB on entry (`loadConjCounts`) and upserts the single incremented pronoun on each correct answer (`saveConjCount`, monotonic — never reset on a wrong answer). `VerbCategoryModal.jsx` reads them from the DB too (in `loadModalData`). A one-time client backfill (`backfillConjProgress`, flag `verb-ar-cj-migrated-<userId>` in localStorage) migrates any legacy `verb-ar-cj-*` localStorage counts plus a known snapshot into the DB when a user has no DB counts yet, taking the higher value per pronoun. The old `verb-ar-cj-<userId>-<tense>-<sub>` localStorage keys are no longer written or read (they are left in place, not cleared).

**Notes on `VerbCategoryModal.jsx` resets:**
- A level-1 reset writes: `current_stage=1, stage2_mastery=0, stage3_mastery=0, l4_score=0, drag_match_score=0, t1_score=0, t2_score=0, t3_score=0`
- A level-2 reset writes: `current_stage=2, stage2_mastery=0, stage3_mastery=0, l4_score=0, drag_match_score=0, t1_score=0, t2_score=0, t3_score=0`
- A level-3 reset writes: `current_stage=3, stage3_mastery=0, l4_score=0, drag_match_score=0, t1_score=0, t2_score=0, t3_score=0`
- A level-4 reset writes: `current_stage=4, l4_score=0, drag_match_score=0, t1_score=0, t2_score=0, t3_score=0`
- All reset paths also clear the conjugation sub-stages: `t1_cj_stage=0, t2_cj_stage=0, t3_cj_stage=0` (tense progress is downstream of infinitive mastery, so it is reset alongside it).

**Notes on `VerbArTenseQuiz.jsx` stage-2 reset guard:**
- On load, if the AR stage-2 t1 reset key is not found in `localStorage`, it resets `t1_cj_stage=1, t1_score=0` for all AR verbs that have `t1_cj_stage >= 1` (one-time migration guard).

---

## `saved_quizzes`

Persists user-defined quiz configurations so they can be replayed without reconfiguring. One row per saved quiz. Added in migration `20260608120000`.

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | — | FK → `auth.users.id` (cascade delete) |
| `name` | TEXT | — | User-supplied name for the saved quiz |
| `quiz_type` | TEXT | — | `'vocab'` or `'verb'` |
| `configuration` | JSONB | `{}` | Selected words/verbs and levels; shape depends on `quiz_type` |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `id` | *(no component yet)* | *(no component yet)* |
| `user_id` | *(no component yet)* | *(no component yet)* |
| `name` | *(no component yet)* | *(no component yet)* |
| `quiz_type` | *(no component yet)* | *(no component yet)* |
| `configuration` | *(no component yet)* | *(no component yet)* |
| `created_at` | *(no component yet)* | *(no component yet)* |

---

## `user_verb_conjugation_progress`

Persistent AR tense conjugation per-pronoun progress (previously browser localStorage only). One row per `(user_id, tense, sub_stage, pronoun)`. Added in migration `20260701120000`.

- `tense`: 1 = Present, 2 = Past, 3 = Future
- `sub_stage`: 1 = Multiple Choice, 2 = Pronoun, 3 = Full Conjugation (Drag & Match is not persisted per pronoun)
- `pronoun`: `yo | tu | el | nosotros | ellos`

Graduation is 5 cumulative correct per pronoun; `correct_count` is monotonic (incremented on correct answers, never reset on wrong).

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | — | FK → `auth.users.id` (cascade delete) |
| `tense` | INTEGER | — | 1/2/3 (Present/Past/Future); CHECK IN (1,2,3) |
| `sub_stage` | INTEGER | — | 1/2/3 (MC/Pronoun/Full Conjugation); CHECK IN (1,2,3) |
| `pronoun` | TEXT | — | yo/tu/el/nosotros/ellos; CHECK constrained |
| `correct_count` | INTEGER | `0` | Cumulative correct answers for this pronoun; CHECK `>= 0` |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp |

Unique constraint on `(user_id, tense, sub_stage, pronoun)`.

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `tense` / `sub_stage` / `pronoun` / `correct_count` | `VerbArTenseQuiz.jsx` (`loadConjCounts`), `VerbCategoryModal.jsx` (`loadModalData`) | `VerbArTenseQuiz.jsx` (`saveConjCount`, `backfillConjProgress`) |

---

## `user_verb_mastery_results`

Last-5 results metric for the **AR Mastery quiz** (`VerbMasteryQuiz.jsx`, route `/verb-mastery-quiz`). The Mastery quiz is a **practice-only** quiz for Verbs -AR: it draws Stage 4 "Full Conjugation" (typed EN→conjugation) questions mixed evenly across Present/Past/Future, is unlocked once every visible AR verb has `t1/t2/t3_cj_stage = 4`, and **never** modifies conjugation counts or tense progression. It records only this metric.

One row per user (PK `user_id`) holding a `recent_sessions` JSONB array of the 5 most recent sessions (newest first). The client trims to 5 on write; a `CHECK` enforces `jsonb_array_length <= 5`. Added in migration `20260701130000`; wired up in `VerbMasteryQuiz.jsx`.

Each element of `recent_sessions` is one completed session:

```json
{
  "at": "<ISO-8601 timestamp>",
  "correct": <int>, "total": <int>,
  "tense":   { "1": {"correct":<int>,"incorrect":<int>},   // 1 Present, 2 Past, 3 Future
               "2": {...}, "3": {...} },
  "pronoun": { "yo": {"correct":<int>,"incorrect":<int>},
               "tu": {...}, "el": {...}, "nosotros": {...}, "ellos": {...} }
}
```

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | UUID | — | Primary key; FK → `auth.users.id` (cascade delete) |
| `recent_sessions` | JSONB | `[]` | Up to 5 most recent Mastery session results (newest first); CHECK: array with `length <= 5` |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `recent_sessions` | `VerbMasteryQuiz.jsx` (`saveMasterySession` read-modify-write; future overview screen) | `VerbMasteryQuiz.jsx` (`saveMasterySession`, on session completion) |

---

## `user_verb_match_tree_results`

Last-5 results metric for the **AR Match Tree** practice quiz (`VerbMatchTree.jsx`, route `/verb-match-tree`), which is **Mastery Stage 1** (the typed Mastery quiz is Stage 2). Both stages are reached from the Verbs -AR category modal and share the same unlock (every visible AR verb has `t1/t2/t3_cj_stage = 4`).

Match Tree is **practice-only** — a 20-question session with randomised subject pronouns (never the same pronoun twice in a row; a repeated pronoun uses a different verb than its previous appearance). Each question presents exactly the three correct forms and the user drags/tap-places a single verb's Past/Present/Future into three tense slots (reusing the Level 1 drag-and-match interaction). The results card aggregates per pronoun across its multiple appearances. It **never** modifies tense progression or conjugation counts. Same shape/RLS/CHECK as `user_verb_mastery_results` (one row per user, `recent_sessions` JSONB array capped at 5, newest first). Added in migration `20260701140000`.

Each element of `recent_sessions`: `{ at, correct, total, tense: { past|present|future → {correct, incorrect} }, pronoun: { yo|tu|el|nosotros|ellos → {correct, incorrect} } }`.

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `recent_sessions` | `VerbMatchTree.jsx` (`saveSession` read-modify-write; future overview screen) | `VerbMatchTree.jsx` (`saveSession`, on session completion) |

---

# Verb learning Path

Added in migration `20261012002453_verb_learning_path` (applied 2026-10-12). The Path replaces the nine verb categories with **18 units**, each one conjugation pattern in one tense (e.g. P4 = "Present: -GO verbs"). Source of truth: `design-notes/verb-learning-plan.xlsx` (Plan tab → `verb_units`; Verbs tab step columns → `verb_unit_members`).

Unit codes and order: **P1–P9** Present (tense 1), **F1–F2** Future (tense 3), **T1–T7** Past (tense 2). Every one of the 70 verbs is in exactly one unit per tense (210 memberships).

The six tables below are additive. The old verb tables (`user_verb_progress`, `user_verb_conjugation_progress`, etc.) and their rows were left untouched.

### Path home — `VerbTrainer.jsx` (route `/verbs`)

The Verb Trainer home is the Path; the old nine category cards are no longer shown.
- **Layout:** lists all 18 `verb_units` in `sort_order` under three sections in learning order: **Present → Future → Past**. All units are open (no locking).
- **Each row:** unit code, pattern name, verb count from `verb_unit_members`, and a status.
- **Next up:** the first unit in `sort_order` that isn't mastered is highlighted "Next up", and a **Continue: <unit>** button at the top opens its unit page.
- **Also on the page:** the Verb Dictionary button.
- **Refresh:** data is refetched on every navigation to the screen (Rule 3, `location.key`).

### Unit page — `VerbPathUnit.jsx` (route `/verb-path/:unitId`)

Mobile-first. It shows:
- the tense, the status pill, and the pattern card (`rule_text`, `example_forms` as chips)
- the unit's verbs, excluding hidden ones, each with infinitive, italic English meaning, and that tense's yo and él/ella forms, plus a note counting hidden verbs
- a **Start / Continue / Open** button (by status) that launches `/verb-unit/:unitId`
- a **View verbs** button that opens `FilteredDictionaryModal` with the unit's visible verbs

It is refetched on every navigation (Rule 3). The engine's exits (results-card back button, mastered and empty screens) return here.

### Shared Path helpers — `src/utils/verbPath.js`

- **`unitStatus(progressRow)`** is the ONLY place a unit's status is derived. Every surface calls it:
  - **not started** (grey): no `user_unit_progress` row
  - **in progress** (orange) with its stage name: a row with `sub_stage` 0–3. The row is created when the engine is first opened.
  - **mastered** (green): `sub_stage` 4 or `mastered_at` set
- **`nextUpUnit`**: the first unmastered unit in `sort_order`.
- **`PATH_SECTIONS`**: the Present → Future → Past order, with each section's conjugation column.
- **`loadPathOverview` / `loadPathUnit`**: the home and unit page data loads. The hidden filter reads only `user_verb_progress.verb_id where hidden = true`.

### Daily Review — `VerbReview.jsx` (route `/verb-review`) + `src/utils/verbReview.js`

The spaced-repetition (Leitner) layer of the Path. All dates are the **device's local date** (`localDateStr`), never UTC.

**Seeding:**
- When `VerbUnitQuiz` advances a unit to `sub_stage` 4, it inserts one `user_review_items` row per visible verb × 5 pronouns, at box 0, due tomorrow.
- **Backfill:** loading the Path home seeds any mastered unit that has no items.
- Both use `upsert … on_conflict=user_id,unit_id,verb_id,pronoun` with ignore-duplicates, so items are never duplicated.

**Session:**
- **Items:** up to 20 due items (`due_on <= today`, hidden verbs excluded), ordered lowest box first, then oldest `due_on`. Ties are shuffled so units and tenses mix.
- **No repeats:** `noConsecutiveVerbPronoun` ensures the same verb + pronoun (which recurs across P/F/T units) is never asked twice in a row.
- **Questions:** each one is a typed Full Conjugation (English → Spanish) through the shared `ConjQuestionCard` and `checkDualAnswer`, showing a tense tag and the infinitive with its italic English meaning.

**Scheduling (`scheduleAnswer`):**
- **Correct:** box +1 (max 5) and `due_on` = today + 1/2/4/8/16/32 days for the new box 0–5. `last_correct_on` is set to today.
- **Wrong:** box 0 and `due_on` = tomorrow.
- `last_seen_at` and `updated_at` are always set.

**End screen:** score, items moved up a box, items due tomorrow, Back to Verb Path, and the Verb Dictionary button.

**Streak (`nextStreak`, `recordStreakActivity`):**
- **What counts:** a day counts on finishing a Daily Review session, or on the first answered question of a `VerbUnitQuiz` visit.
- **Rules:** if `last_active_on` was yesterday, the streak continues (+1). If it's older or missing, the streak resets to 1. If it's today, nothing changes. `longest_streak` keeps the maximum.
- **Display:** the Path home shows the streak only while it's alive (active today or yesterday), otherwise 0 (`displayStreak`).

**Path home additions:** a Daily Review card shows the number due today, or "All caught up · next review <date>", and opens `/verb-review`. Unit rows show an "N due" badge.

**Old tables:** these screens read and write only the Path tables. The only exception is the read-only hidden flag, read through `verbPath.loadHiddenVerbIds`.

### Path conjugation engine — `VerbUnitQuiz.jsx` (route `/verb-unit/:unitId`)

Runs any unit, by URL only for now (no navigation entry yet). It uses the same four sub-stages as the Verbs -AR flow: **0 Drag & Match**, **1 Multiple Choice**, **2 Pronoun** (typed), **3 Full Conjugation** (typed EN → pronoun + conjugation).
- **Verbs:** taken from `verb_unit_members` for the unit, minus the user's hidden verbs.
- **Tense:** comes from `verb_units.tense`: 1 → `present_conjugations`, 2 → `past_conjugations`, 3 → `future_conjugations`.

**Pass rule:**
- **Sub-stages 1–3:** pass when every pronoun (yo, tu, el, nosotros, ellos) reaches 5 cumulative correct. Counts are stored in `user_unit_pronoun_progress`, loaded on entry and upserted on each correct answer. They are monotonic: a wrong answer never lowers a count.
- **Drag & Match:** passes on a 5-round block in which every pronoun is matched correctly each round. It isn't persisted per pronoun, because the table only allows sub-stages 1–3. This is the same as the AR flow.

When a sub-stage passes, `user_unit_progress.sub_stage` advances. Reaching 4 sets `mastered_at`, and every update sets `updated_at`. If a load finds a sub-stage already passing (e.g. the advance write failed earlier), it advances straight away.

**Sessions:**
- **Length:** Multiple Choice 15 questions, Pronoun and Full Conjugation 10.
- **Ordering:** the pronoun sequence never repeats a pronoun back to back, even across a session boundary or reload, so the same verb + pronoun never appears twice in a row. Small units (P9 = 1 verb, T7 = 2, P8/T6 = 3) reuse verbs to fill sessions.
- **Display:** each verb's English meaning is shown in italics beside the infinitive.

**Empty and error states:**
- A unit whose verbs are all hidden shows an empty state.
- An unknown unit id shows an error.

**Old tables:** the engine reads only `user_verb_progress.verb_id where hidden = true`, for the hidden filter, and never writes to any old verb progress table.

**Shared modules:** the engine shares the following with `VerbArTenseQuiz.jsx` (no logic is copied between the engines, per CLAUDE.md Rule 1):
- `src/utils/arConjugation.js`: pronoun constants, `SUB_LABEL`, `CONJ_PASS_PER_PRONOUN`, question builders, answer normalisation/checking, `pronounSequence`
- `src/components/ConjQuestionCard.jsx`: the question/feedback card
- `src/components/ConjResultsCard.jsx`: the results card
- `ConjDragRound` from `VerbDragMatch.jsx`

---

## `verb_units`

Static unit content, one row per Path unit (18 rows).

**RLS:** enabled — publicly readable (`SELECT USING (true)`, like `verbs`); no write policies.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT | — | Primary key; step code (`P1`…`P9`, `F1`, `F2`, `T1`…`T7`). CHECK `^[PFT][0-9]+$` |
| `sort_order` | INTEGER | — | Path order 1–18 (P1–P9, F1–F2, T1–T7); UNIQUE |
| `tense` | INTEGER | — | 1 = Present, 2 = Past, 3 = Future. CHECK: must agree with the code letter (P→1, T→2, F→3) |
| `pattern_name` | TEXT | — | e.g. `-GO verbs`, `o→ue boot verbs` |
| `rule_text` | TEXT | — | "What to learn" rule from the plan |
| `example_forms` | TEXT | — | Example conjugated forms, comma-separated |
| `diary_prompt` | TEXT | — | Prompt for the 3-sentence diary exercise |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |

---

## `verb_unit_members`

Which verbs belong to which unit (210 rows: 70 verbs × 3 tenses).

**RLS:** enabled — publicly readable; no write policies.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `unit_id` | TEXT | — | FK → `verb_units.id` |
| `verb_id` | BIGINT | — | FK → `verbs.id` |

Primary key `(unit_id, verb_id)`; index on `verb_id`.

### Column access (both content tables)

| Table | Read by | Written by |
|-------|---------|------------|
| `verb_units` | `VerbTrainer.jsx` (`loadPathOverview`: `id, sort_order, tense, pattern_name`); `VerbPathUnit.jsx` (`loadPathUnit`: all content columns); `VerbUnitQuiz.jsx` (`loadUnit`: `id, tense, pattern_name, rule_text, example_forms`) | — (seeded by migration) |
| `verb_unit_members` | `VerbTrainer.jsx` (`loadPathOverview`: `unit_id`, for verb counts); `VerbPathUnit.jsx` and `VerbUnitQuiz.jsx` (`verb_id` for the unit) | — (seeded by migration) |

---

## `user_unit_progress`

One row per `(user_id, unit_id)`: where the user is within a unit.

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | UUID | — | FK → `auth.users.id` (cascade delete) |
| `unit_id` | TEXT | — | FK → `verb_units.id` |
| `sub_stage` | INTEGER | `0` | Same meaning as `t<n>_cj_stage`: 0 Drag, 1 MC, 2 Pronoun, 3 Full conjugation, 4 Done. CHECK 0–4 |
| `mastered_at` | TIMESTAMPTZ | NULL | When the unit was completed |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp (set by the app; no trigger) |

Primary key `(user_id, unit_id)`.

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `sub_stage` | `VerbUnitQuiz.jsx` (`loadUnit`); `VerbTrainer.jsx` and `VerbPathUnit.jsx` via `verbPath.js` → `unitStatus` | `VerbUnitQuiz.jsx`: created at 0 on first entry (upsert, ignore duplicates); advanced by `advanceFrom` |
| `mastered_at` | `VerbTrainer.jsx` and `VerbPathUnit.jsx` via `verbPath.js` → `unitStatus` | `VerbUnitQuiz.jsx` (`advanceFrom`, when sub_stage reaches 4) |
| `updated_at` | — | `VerbUnitQuiz.jsx` (`advanceFrom`) |

---

## `user_unit_pronoun_progress`

Per-pronoun correct-counts within a unit's sub-stage. Mirrors `user_verb_conjugation_progress`, keyed by unit instead of tense.

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | — | FK → `auth.users.id` (cascade delete) |
| `unit_id` | TEXT | — | FK → `verb_units.id` |
| `sub_stage` | INTEGER | — | 1/2/3 (MC/Pronoun/Full Conjugation); CHECK IN (1,2,3) |
| `pronoun` | TEXT | — | yo/tu/el/nosotros/ellos; CHECK constrained |
| `correct_count` | INTEGER | `0` | Cumulative correct answers; CHECK `>= 0` |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp |

Unique constraint on `(user_id, unit_id, sub_stage, pronoun)`.

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `correct_count` | `VerbUnitQuiz.jsx` (`loadCounts`, on entering a sub-stage) | `VerbUnitQuiz.jsx` (`saveCount`: upsert on `user_id,unit_id,sub_stage,pronoun` with the incremented count, on each correct answer) |
| `updated_at` | — | `VerbUnitQuiz.jsx` (`saveCount`) |

---

## `user_review_items`

Daily Review items. See "Daily Review" above.

Spaced review (Leitner boxes) per `(user, unit, verb, pronoun)`.

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | — | FK → `auth.users.id` (cascade delete) |
| `unit_id` | TEXT | — | Part of composite FK `(unit_id, verb_id)` → `verb_unit_members` (the verb must belong to the unit) |
| `verb_id` | BIGINT | — | Part of the same composite FK |
| `pronoun` | TEXT | — | yo/tu/el/nosotros/ellos; CHECK constrained |
| `box` | INTEGER | `0` | Leitner box; CHECK 0–5 |
| `due_on` | DATE | `current_date` | Next review date |
| `last_correct_on` | DATE | NULL | Last day answered correctly |
| `last_seen_at` | TIMESTAMPTZ | NULL | Last time shown |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp |

Unique constraint on `(user_id, unit_id, verb_id, pronoun)`; index on `(user_id, due_on)` for "what's due today" lookups.

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `unit_id`, `verb_id`, `pronoun` | `VerbReview.jsx`, `VerbTrainer.jsx` (via `verbReview.js`) | `VerbUnitQuiz.jsx` (seed on mastery), `VerbTrainer.jsx` (backfill) — via `seedUnitReviewItems` |
| `box`, `due_on` | `VerbReview.jsx` (session order), `VerbTrainer.jsx` (due count, badges, next due date) | seed (0, tomorrow); `VerbReview.jsx` (`saveReviewAnswer`, Leitner) |
| `last_correct_on`, `last_seen_at`, `updated_at` | — | `VerbReview.jsx` (`saveReviewAnswer`) |

---

## `user_verb_streak`

Daily verb-practice streak. See "Daily Review" above.

One row per user: daily verb-practice streak.

**RLS:** enabled — users can only read, insert, update, and delete their own rows.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | UUID | — | Primary key; FK → `auth.users.id` (cascade delete) |
| `current_streak` | INTEGER | `0` | Current run of consecutive active days; CHECK `>= 0` |
| `longest_streak` | INTEGER | `0` | Best streak; CHECK `>= 0` |
| `last_active_on` | DATE | NULL | Last day with verb practice |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp |

### Column access

| Column | Read by | Written by |
|--------|---------|------------|
| `current_streak`, `longest_streak`, `last_active_on` | `VerbTrainer.jsx` (streak line), `verbReview.recordStreakActivity` | `recordStreakActivity` — from `VerbReview.jsx` (session finished) and `VerbUnitQuiz.jsx` (first answer of a visit); upsert on `user_id` |
| `updated_at` | — | `recordStreakActivity` |
