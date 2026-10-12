# Completion report — Daily Review (spaced repetition) and verb streak

**Finished:** 2026-10-12 01:36 (local)
**Commit:** `543284e` (code and docs). This report is committed separately, straight after it.
**Deploy:** production deployment `dechats-342xxg1ef` is Ready and aliased to https://dechats-learn.vercel.app. `/verbs` and `/verb-review` return 200, and the live bundle contains Daily Review.

## What changed

1. **`src/utils/verbReview.js` (new)** holds all Daily Review logic.
   - **Dates:** local-date helpers using the device's date, never UTC.
   - **`scheduleAnswer` (Leitner):**
     - Correct: box +1 (max 5), due today + 1/2/4/8/16/32 days for the new box, `last_correct_on` = today.
     - Wrong: box 0, due tomorrow.
     - Always sets `last_seen_at` and `updated_at`.
   - **Streak rules:** `nextStreak`, `displayStreak` and `recordStreakActivity`.
   - **Seeding:** `seedUnitReviewItems` upserts on the unique key with ignore-duplicates.
   - **Backfill:** mastered units with no items are seeded on Path load.
   - **Session loader:** up to 20 due items, hidden verbs excluded, lowest box then oldest `due_on`, with ties shuffled to mix units and tenses.
   - **No-repeat ordering:** `noConsecutiveVerbPronoun` keeps priority order unless that would put the same verb + pronoun back to back. It only allows a repeat if no other arrangement exists.
2. **`/verb-review` (`VerbReview.jsx`, new).**
   - **Questions:** typed Full Conjugation through the shared `ConjQuestionCard` and `checkDualAnswer`, with a tense tag and the infinitive plus its italic English meaning.
   - **Saving:** each answer reschedules its item.
   - **End screen:** score, moved up a box, due tomorrow, current streak, Back to Verb Path and the Verb Dictionary button.
   - **Empty states:** "All caught up" with the next due date, or "Nothing to review yet" when there are no items.
3. **`VerbUnitQuiz.jsx`:**
   - When a unit reaches `sub_stage` 4, it seeds review items for its visible verbs × 5 pronouns (box 0, due tomorrow).
   - The first answer of a visit (drag round, MC or typed) records the day for the streak.
4. **Path home (`VerbTrainer.jsx`):**
   - **Daily Review card:** "N items due today" (highlighted), "All caught up · next review <date>", or "Master a unit to start reviewing it".
   - **Streak line:** "🔥 N-day streak · best M".
   - **Badges:** "N due" on unit rows.
   - **Backfill:** runs on load.
5. **`verbPath.js`:** new shared `loadHiddenVerbIds` (read-only hidden flag), used by the unit page and Daily Review.
6. **Route and NavBar:** `/verb-review` added; the NavBar highlights Verbs there.
7. **Docs:**
   - `ARCHITECTURE.md`: Daily Review section, plus column access for `user_review_items` and `user_verb_streak`.
   - `CLAUDE.md`: file inventory updated.
   - `CHANGELOG.md` updated.

## Files touched

- New: `src/pages/VerbReview.jsx`, `src/utils/verbReview.js`, this report and `completion-reports/LATEST.md`
- Edited: `src/pages/VerbTrainer.jsx`, `src/pages/VerbUnitQuiz.jsx`, `src/utils/verbPath.js`, `src/App.jsx`, `src/components/NavBar.jsx`, `ARCHITECTURE.md`, `CLAUDE.md`, `CHANGELOG.md`

## Verification done

**1. Daily Review browser suite: 62 checks, all passing on 2 consecutive runs.**
- **Setup:** phone width (390 px), with the browser in **Pacific/Auckland time at 08:00 on 13 Oct** while the UTC date was still 12 Oct. Content data came live from the database; Path progress, review items and the streak were simulated in memory.
- **Local dates:** "today" = 13 Oct and "tomorrow" = 14 Oct, so the device date is used, not UTC.
- **Leitner rules:** for boxes 0–5, both correct and wrong:
  - correct moves the box up by 1 (max 5) and schedules the next review 1/2/4/8/16/32 days out
  - wrong goes to box 0, due tomorrow
  - `last_correct_on` is set only on correct answers, and `last_seen_at` / `updated_at` are always set
- **Streak rules:** yesterday 3→4; today unchanged; older 7→1 with best 7 kept; first day 1; a new best (5→6) is tracked; continues across a month boundary. The displayed streak is 0 once a day is missed.
- **No-repeat ordering:** 3,000 random lists, with no avoidable repeats, nothing lost, and order kept when there was no conflict.
- **Seeding on mastery, through the real engine UI:**
  - P9 reached sub_stage 4 and seeded 5 items (gustar × 5).
  - P1 seeded 120 items (24 visible verbs × 5) and none for resultar or terminar.
  - All items were box 0, due 14 Oct.
  - The seeding request used the unique key with ignore-duplicates.
  - Answering in the unit session recorded the streak.
- **Backfill on Path load:**
  - Mastered T7 with no items got 10 items.
  - Mastered P2, which already had items, was left alone.
  - Unmastered F2 got none.
  - Reloading made no duplicates.
- **Due ordering and cap:** 33 fixture items, of which 25 were due (future and hidden items excluded).
  - The card said "25 items due today", and the badges were P1 4, P2 4, P4 5, F1 4, T1 4, T2 4.
  - The session served exactly the top 20 in order: box 0 (10 Oct → 12 Oct → 13 Oct), then box 1, then box 2. It covered 5 units and all 3 tenses.
- **Transitions:** every answered item's box, `due_on`, `last_seen_at`, `updated_at` and `last_correct_on` matched the rules, with every third answer wrong.
- **End screen:** 13/20, 13 moved up, 10 due tomorrow, matching the database. Back to Verb Path then showed "5 items due today".
- **Box ceiling:** box 5 stays 5 (+32 days), 4→5 (+32) and 2→3 (+8). "Moved up" excluded the box-5 item.
- **No back-to-back repeats:** 6 full sessions with hablar·yo and hablar·tu each in P1, F1 and T1 never asked the same verb + pronoun twice in a row.
- **Streak through the UI:** for the yesterday, today, older and new-best cases, the home's streak before, the stored row after, the end-screen streak and the home's streak after all matched.
- **Empty states:** "All caught up · next review Tue, Oct 20" on the card and on `/verb-review`, with no badges. With no items at all, the card says "Master a unit…" and `/verb-review` says "Nothing to review yet". The empty state writes nothing.
- **Phone width:** no horizontal scroll on the Path home with the card, a review question, the end screen or the empty state.
- **Old tables:** writes went only to Path tables, the old progress table was read only for the hidden flag, and there were no console errors or warnings.

**2. Regression suites rerun, all passing:**
- engine suite, 129 checks
- Path suite, 51 checks

The engine suite's table allow-list was updated to accept the new streak and review writes. Its harness was also hardened to ignore requests still in flight when a test closes a page.

**3. Live database, as you, under the real security rules, in a rolled-back transaction:**
- Seeding twice left 5 items, not 10.
- A Leitner update by id worked.
- Box 6 was rejected.
- A verb not in its unit (hablar in P9) was rejected by the unit-membership link.
- A write for another user was rejected.
- The streak upsert continued from 1 to 2.
- Another user saw none of the rows.
- After rollback both tables had 0 rows.

**4. Lint and build:** lint is clean on all changed files, `npm run build` succeeds, and screenshots of the home card, a question and the end screen were checked by eye.

## Unresolved / needs a hand test

- **Hand test signed in.** You have no mastered units yet, so Daily Review starts empty.
  1. Open `/verbs`. The card should say "Master a unit to start reviewing it", with a 0-day streak.
  2. Answer one question in any unit; the streak becomes 1.
  3. Master a small unit (P9 is quickest). Supabase should show 5 rows in `dechats.user_review_items` due tomorrow.
  4. Tomorrow, the card shows "5 items due today".
- **Decisions for you:**
  - **Hidden verbs** keep their review items but are left out of due counts and sessions while hidden. They come back if you unhide them.
  - **Wrong answers** aren't re-asked within the same session; they're rescheduled for tomorrow.
  - **Streak trigger in units:** the first answer of a unit visit counts, right or wrong.
  - **Date format** follows the phone's locale ("Tue 20 Oct" or "Tue, Oct 20").
