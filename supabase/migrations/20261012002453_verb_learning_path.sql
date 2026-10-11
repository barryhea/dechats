-- Verb learning Path: 18 pattern units replacing the nine verb categories.
--
-- Source of truth: design-notes/verb-learning-plan.xlsx
--   Plan tab  -> dechats.verb_units (step code, order, tense, pattern, rule,
--                example forms, diary prompt)
--   Verbs tab -> dechats.verb_unit_members (the "Present step", "Future step"
--                and "Past step" columns; NOT the Plan tab's verb-list text)
--
-- A unit is one conjugation pattern in one tense, e.g. P4 = "Present: -GO verbs".
--   P1–P9 Present (tense 1), T1–T7 Past (tense 2), F1–F2 Future (tense 3),
--   using the existing tense convention (1 Present, 2 Past, 3 Future).
-- Every one of the 70 verbs belongs to exactly one unit per tense: 210 rows.
--
-- New per-user tables:
--   user_unit_progress          one row per (user, unit); sub_stage 0–4 has the
--                               same meaning as t<n>_cj_stage:
--                               0 Drag, 1 MC, 2 Pronoun, 3 Full conjugation, 4 Done
--   user_unit_pronoun_progress  per-pronoun correct-counts, mirroring
--                               user_verb_conjugation_progress but keyed by unit
--   user_review_items           spaced-review (Leitner box 0–5) per
--                               (user, unit, verb, pronoun)
--   user_verb_streak            one row per user: daily practice streak
--
-- Purely additive. No existing table or row is altered, dropped or wiped;
-- the old verb progress tables are left untouched.
--
-- The whole file runs in one transaction. If any sheet verb fails to match
-- dechats.verbs.spanish_infinitive, or the seeded membership is not exactly
-- one unit per verb per tense, it raises and nothing is created.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. verb_units — static unit content, publicly readable like verbs
-- ---------------------------------------------------------------------------

CREATE TABLE dechats.verb_units (
  id            TEXT        PRIMARY KEY CHECK (id ~ '^[PFT][0-9]+$'),
  sort_order    INTEGER     NOT NULL UNIQUE,
  tense         INTEGER     NOT NULL CHECK (tense IN (1, 2, 3)),
  pattern_name  TEXT        NOT NULL,
  rule_text     TEXT        NOT NULL,
  example_forms TEXT        NOT NULL,
  diary_prompt  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Step-code letter must agree with the tense column
  CHECK (
       (left(id, 1) = 'P' AND tense = 1)
    OR (left(id, 1) = 'T' AND tense = 2)
    OR (left(id, 1) = 'F' AND tense = 3)
  )
);

ALTER TABLE dechats.verb_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verb units are publicly readable"
  ON dechats.verb_units FOR SELECT
  USING (true);

INSERT INTO dechats.verb_units
  (id, sort_order, tense, pattern_name, rule_text, example_forms, diary_prompt)
VALUES
  ('P1',  1, 1, 'Regular -AR',
   'Drop -ar, add -o / -as / -a / -amos / -an. Same for every verb here.',
   'hablo, hablas, habla, hablamos, hablan',
   'Write 3 sentences about your normal workday (trabajo, hablo, tomo…).'),
  ('P2',  2, 1, 'Regular -ER / -IR',
   'Drop -er/-ir, add -o / -es / -e / -emos (-imos) / -en.',
   'como, comes, come, comemos, comen',
   'What do you eat and drink on a normal day?'),
  ('P3',  3, 1, 'The four essentials',
   'Fully irregular. Learn each as a set — these are the most used verbs in Spanish.',
   'soy, estoy, voy, hay',
   'Who are you, where are you, where are you going today?'),
  ('P4',  4, 1, '-GO verbs',
   '''I'' form ends in -go; the rest mostly follow the normal endings (tener/venir/decir also change vowel).',
   'tengo, vengo, digo, hago, pongo, salgo',
   'What do you have, make and bring this week?'),
  ('P5',  5, 1, 'Odd ''I'' forms',
   'Only the yo form is strange; everything else is regular.',
   'sé, doy, veo, conozco, parezco',
   'Who do you know, what do you see from your window?'),
  ('P6',  6, 1, 'o→ue boot verbs',
   'o (or u in jugar) becomes ue in every form except nosotros.',
   'puedo, duermo, encuentro, juego',
   'What can you do, how do you sleep, what do you play?'),
  ('P7',  7, 1, 'e→ie boot verbs',
   'e becomes ie in every form except nosotros.',
   'quiero, pienso, siento, cierro',
   'What do you want and think about at the weekend?'),
  ('P8',  8, 1, 'e→i boot verbs',
   'e becomes i in every form except nosotros.',
   'pido, sirvo, consigo',
   'What do you order in a café?'),
  ('P9',  9, 1, 'gustar',
   'Works backwards: ''it pleases me''. Me gusta (one thing), me gustan (several).',
   'me gusta, te gusta, le gustan',
   'Three things you like and one you don''t.'),
  ('F1', 10, 3, 'Regular future',
   'Keep the WHOLE infinitive, add -é / -ás / -á / -emos / -án. One rule for -ar, -er and -ir.',
   'hablaré, comeré, viviré',
   'What will you do tomorrow?'),
  ('F2', 11, 3, 'Short-stem future',
   'Same endings, shortened stem: tendr-, vendr-, pondr-, saldr-, mantendr-, podr-, querr-, sabr-, habr-, har-, dir-.',
   'tendré, haré, diré, podré',
   'What will you have, make and say next week?'),
  ('T1', 12, 2, 'Regular -AR',
   'Drop -ar, add -é / -aste / -ó / -amos / -aron.',
   'hablé, hablaste, habló',
   'What did you do yesterday at work?'),
  ('T2', 13, 2, 'Regular -ER / -IR',
   'Drop -er/-ir, add -í / -iste / -ió / -imos / -ieron.',
   'comí, comiste, comió',
   'What did you eat and drink yesterday?'),
  ('T3', 14, 2, 'Spelling change',
   'Only the ''I'' form changes spelling to keep the sound: -qué, -gué.',
   'busqué, llegué, pagué, saqué, jugué',
   'When did you arrive and what did you pay for?'),
  ('T4', 15, 2, '-IR vowel change',
   'Only él/ellos change: e→i or o→u.',
   'pidió, sirvió, sintió, durmió',
   'How did someone else sleep / what did they order?'),
  ('T5', 16, 2, 'Strong pasts',
   'New stem + unaccented endings -e / -iste / -o / -imos / -ieron.',
   'tuve, estuve, hice, dije, pude, puse, vine, traje',
   'Where were you and what did you have to do?'),
  ('T6', 17, 2, 'ser / ir / dar',
   'ser and ir share one set (fui, fuiste, fue…). dar uses -er endings (di, dio).',
   'fui, fue, di, dio',
   'Where did you go and what did you give?'),
  ('T7', 18, 2, 'y in él / ellos',
   'The i between vowels becomes y.',
   'creyó, oyó, creyeron',
   'What did someone hear or believe?');

-- ---------------------------------------------------------------------------
-- 2. verb_unit_members — which verbs are in which unit, publicly readable
-- ---------------------------------------------------------------------------

CREATE TABLE dechats.verb_unit_members (
  unit_id TEXT   NOT NULL REFERENCES dechats.verb_units(id),
  verb_id BIGINT NOT NULL REFERENCES dechats.verbs(id),
  PRIMARY KEY (unit_id, verb_id)
);

CREATE INDEX verb_unit_members_verb_id_idx
  ON dechats.verb_unit_members (verb_id);

ALTER TABLE dechats.verb_unit_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verb unit members are publicly readable"
  ON dechats.verb_unit_members FOR SELECT
  USING (true);

-- Seed by infinitive, then resolve to verbs.id. Dropped at COMMIT.
CREATE TEMP TABLE verb_unit_seed (
  unit_id    TEXT NOT NULL,
  infinitive TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO verb_unit_seed (unit_id, infinitive) VALUES
  ('P1', 'acabar'),
  ('P1', 'ayudar'),
  ('P1', 'bajar'),
  ('P1', 'buscar'),
  ('P1', 'comprar'),
  ('P1', 'crear'),
  ('P1', 'dejar'),
  ('P1', 'entrar'),
  ('P1', 'escuchar'),
  ('P1', 'esperar'),
  ('P1', 'ganar'),
  ('P1', 'hablar'),
  ('P1', 'llamar'),
  ('P1', 'llegar'),
  ('P1', 'llevar'),
  ('P1', 'mirar'),
  ('P1', 'necesitar'),
  ('P1', 'pagar'),
  ('P1', 'quedar'),
  ('P1', 'resultar'),
  ('P1', 'sacar'),
  ('P1', 'terminar'),
  ('P1', 'tomar'),
  ('P1', 'trabajar'),
  ('P1', 'tratar'),
  ('P1', 'viajar'),
  ('P2', 'abrir'),
  ('P2', 'beber'),
  ('P2', 'comer'),
  ('P2', 'correr'),
  ('P2', 'creer'),
  ('P2', 'deber'),
  ('P2', 'escribir'),
  ('P2', 'permitir'),
  ('P2', 'recibir'),
  ('P2', 'subir'),
  ('P3', 'estar'),
  ('P3', 'haber'),
  ('P3', 'ir'),
  ('P3', 'ser'),
  ('P4', 'decir'),
  ('P4', 'hacer'),
  ('P4', 'mantener'),
  ('P4', 'oír'),
  ('P4', 'poner'),
  ('P4', 'salir'),
  ('P4', 'tener'),
  ('P4', 'traer'),
  ('P4', 'venir'),
  ('P5', 'aparecer'),
  ('P5', 'conocer'),
  ('P5', 'dar'),
  ('P5', 'parecer'),
  ('P5', 'saber'),
  ('P5', 'ver'),
  ('P6', 'dormir'),
  ('P6', 'encontrar'),
  ('P6', 'jugar'),
  ('P6', 'poder'),
  ('P6', 'recordar'),
  ('P7', 'cerrar'),
  ('P7', 'entender'),
  ('P7', 'pensar'),
  ('P7', 'perder'),
  ('P7', 'querer'),
  ('P7', 'sentir'),
  ('P8', 'conseguir'),
  ('P8', 'pedir'),
  ('P8', 'servir'),
  ('P9', 'gustar'),
  ('F1', 'abrir'),
  ('F1', 'acabar'),
  ('F1', 'aparecer'),
  ('F1', 'ayudar'),
  ('F1', 'bajar'),
  ('F1', 'beber'),
  ('F1', 'buscar'),
  ('F1', 'cerrar'),
  ('F1', 'comer'),
  ('F1', 'comprar'),
  ('F1', 'conocer'),
  ('F1', 'conseguir'),
  ('F1', 'correr'),
  ('F1', 'crear'),
  ('F1', 'creer'),
  ('F1', 'dar'),
  ('F1', 'deber'),
  ('F1', 'dejar'),
  ('F1', 'dormir'),
  ('F1', 'encontrar'),
  ('F1', 'entender'),
  ('F1', 'entrar'),
  ('F1', 'escribir'),
  ('F1', 'escuchar'),
  ('F1', 'esperar'),
  ('F1', 'estar'),
  ('F1', 'ganar'),
  ('F1', 'gustar'),
  ('F1', 'hablar'),
  ('F1', 'ir'),
  ('F1', 'jugar'),
  ('F1', 'llamar'),
  ('F1', 'llegar'),
  ('F1', 'llevar'),
  ('F1', 'mirar'),
  ('F1', 'necesitar'),
  ('F1', 'oír'),
  ('F1', 'pagar'),
  ('F1', 'parecer'),
  ('F1', 'pedir'),
  ('F1', 'pensar'),
  ('F1', 'perder'),
  ('F1', 'permitir'),
  ('F1', 'quedar'),
  ('F1', 'recibir'),
  ('F1', 'recordar'),
  ('F1', 'resultar'),
  ('F1', 'sacar'),
  ('F1', 'sentir'),
  ('F1', 'ser'),
  ('F1', 'servir'),
  ('F1', 'subir'),
  ('F1', 'terminar'),
  ('F1', 'tomar'),
  ('F1', 'trabajar'),
  ('F1', 'traer'),
  ('F1', 'tratar'),
  ('F1', 'ver'),
  ('F1', 'viajar'),
  ('F2', 'decir'),
  ('F2', 'haber'),
  ('F2', 'hacer'),
  ('F2', 'mantener'),
  ('F2', 'poder'),
  ('F2', 'poner'),
  ('F2', 'querer'),
  ('F2', 'saber'),
  ('F2', 'salir'),
  ('F2', 'tener'),
  ('F2', 'venir'),
  ('T1', 'acabar'),
  ('T1', 'ayudar'),
  ('T1', 'bajar'),
  ('T1', 'cerrar'),
  ('T1', 'comprar'),
  ('T1', 'crear'),
  ('T1', 'dejar'),
  ('T1', 'encontrar'),
  ('T1', 'entrar'),
  ('T1', 'escuchar'),
  ('T1', 'esperar'),
  ('T1', 'ganar'),
  ('T1', 'gustar'),
  ('T1', 'hablar'),
  ('T1', 'llamar'),
  ('T1', 'llevar'),
  ('T1', 'mirar'),
  ('T1', 'necesitar'),
  ('T1', 'pensar'),
  ('T1', 'quedar'),
  ('T1', 'recordar'),
  ('T1', 'resultar'),
  ('T1', 'terminar'),
  ('T1', 'tomar'),
  ('T1', 'trabajar'),
  ('T1', 'tratar'),
  ('T1', 'viajar'),
  ('T2', 'abrir'),
  ('T2', 'aparecer'),
  ('T2', 'beber'),
  ('T2', 'comer'),
  ('T2', 'conocer'),
  ('T2', 'correr'),
  ('T2', 'deber'),
  ('T2', 'entender'),
  ('T2', 'escribir'),
  ('T2', 'parecer'),
  ('T2', 'perder'),
  ('T2', 'permitir'),
  ('T2', 'recibir'),
  ('T2', 'salir'),
  ('T2', 'subir'),
  ('T2', 'ver'),
  ('T3', 'buscar'),
  ('T3', 'jugar'),
  ('T3', 'llegar'),
  ('T3', 'pagar'),
  ('T3', 'sacar'),
  ('T4', 'conseguir'),
  ('T4', 'dormir'),
  ('T4', 'pedir'),
  ('T4', 'sentir'),
  ('T4', 'servir'),
  ('T5', 'decir'),
  ('T5', 'estar'),
  ('T5', 'haber'),
  ('T5', 'hacer'),
  ('T5', 'mantener'),
  ('T5', 'poder'),
  ('T5', 'poner'),
  ('T5', 'querer'),
  ('T5', 'saber'),
  ('T5', 'tener'),
  ('T5', 'traer'),
  ('T5', 'venir'),
  ('T6', 'dar'),
  ('T6', 'ir'),
  ('T6', 'ser'),
  ('T7', 'creer'),
  ('T7', 'oír');

-- Fail loudly if any sheet verb has no exact match in dechats.verbs
DO $$
DECLARE
  unmatched TEXT;
  sheet_verbs INTEGER;
BEGIN
  SELECT string_agg(DISTINCT s.infinitive, ', ' ORDER BY s.infinitive)
    INTO unmatched
  FROM verb_unit_seed s
  WHERE NOT EXISTS (
    SELECT 1 FROM dechats.verbs v WHERE v.spanish_infinitive = s.infinitive
  );

  IF unmatched IS NOT NULL THEN
    RAISE EXCEPTION 'Verb Path seed: no dechats.verbs row for: %', unmatched;
  END IF;

  SELECT count(DISTINCT infinitive) INTO sheet_verbs FROM verb_unit_seed;
  IF sheet_verbs <> 70 THEN
    RAISE EXCEPTION 'Verb Path seed: expected 70 distinct verbs, found %', sheet_verbs;
  END IF;
END
$$;

INSERT INTO dechats.verb_unit_members (unit_id, verb_id)
SELECT s.unit_id, v.id
FROM verb_unit_seed s
JOIN dechats.verbs v ON v.spanish_infinitive = s.infinitive;

-- Verify: 210 rows, and every verb in exactly one unit for each of the 3 tenses
DO $$
DECLARE
  total INTEGER;
  bad   TEXT;
BEGIN
  SELECT count(*) INTO total FROM dechats.verb_unit_members;
  IF total <> 210 THEN
    RAISE EXCEPTION 'Verb Path seed: expected 210 member rows, found %', total;
  END IF;

  SELECT string_agg(v.spanish_infinitive || ' (tense ' || t.tense || ': ' || coalesce(c.n, 0) || ')', ', ')
    INTO bad
  FROM dechats.verbs v
  CROSS JOIN (VALUES (1), (2), (3)) AS t(tense)
  LEFT JOIN (
    SELECT m.verb_id, u.tense, count(*) AS n
    FROM dechats.verb_unit_members m
    JOIN dechats.verb_units u ON u.id = m.unit_id
    GROUP BY m.verb_id, u.tense
  ) c ON c.verb_id = v.id AND c.tense = t.tense
  WHERE coalesce(c.n, 0) <> 1;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Verb Path seed: verbs not in exactly one unit per tense: %', bad;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. user_unit_progress — one row per (user, unit)
-- ---------------------------------------------------------------------------

CREATE TABLE dechats.user_unit_progress (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id     TEXT        NOT NULL REFERENCES dechats.verb_units(id),
  sub_stage   INTEGER     NOT NULL DEFAULT 0 CHECK (sub_stage BETWEEN 0 AND 4),
  mastered_at TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

ALTER TABLE dechats.user_unit_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own unit progress"
  ON dechats.user_unit_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unit progress"
  ON dechats.user_unit_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unit progress"
  ON dechats.user_unit_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unit progress"
  ON dechats.user_unit_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. user_unit_pronoun_progress — per-pronoun counts, keyed by unit
-- ---------------------------------------------------------------------------

CREATE TABLE dechats.user_unit_pronoun_progress (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id       TEXT        NOT NULL REFERENCES dechats.verb_units(id),
  sub_stage     INTEGER     NOT NULL CHECK (sub_stage IN (1, 2, 3)),
  pronoun       TEXT        NOT NULL CHECK (pronoun IN ('yo', 'tu', 'el', 'nosotros', 'ellos')),
  correct_count INTEGER     NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id, sub_stage, pronoun)
);

ALTER TABLE dechats.user_unit_pronoun_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own unit pronoun progress"
  ON dechats.user_unit_pronoun_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unit pronoun progress"
  ON dechats.user_unit_pronoun_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unit pronoun progress"
  ON dechats.user_unit_pronoun_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unit pronoun progress"
  ON dechats.user_unit_pronoun_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. user_review_items — spaced review per (user, unit, verb, pronoun)
-- ---------------------------------------------------------------------------

CREATE TABLE dechats.user_review_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id         TEXT        NOT NULL,
  verb_id         BIGINT      NOT NULL,
  pronoun         TEXT        NOT NULL CHECK (pronoun IN ('yo', 'tu', 'el', 'nosotros', 'ellos')),
  box             INTEGER     NOT NULL DEFAULT 0 CHECK (box BETWEEN 0 AND 5),
  due_on          DATE        NOT NULL DEFAULT current_date,
  last_correct_on DATE        NULL,
  last_seen_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id, verb_id, pronoun),
  -- The verb must actually belong to the unit (covers both unit and verb FKs)
  FOREIGN KEY (unit_id, verb_id)
    REFERENCES dechats.verb_unit_members (unit_id, verb_id)
);

CREATE INDEX user_review_items_user_due_idx
  ON dechats.user_review_items (user_id, due_on);

ALTER TABLE dechats.user_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own review items"
  ON dechats.user_review_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review items"
  ON dechats.user_review_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review items"
  ON dechats.user_review_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review items"
  ON dechats.user_review_items FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. user_verb_streak — one row per user
-- ---------------------------------------------------------------------------

CREATE TABLE dechats.user_verb_streak (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER     NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER     NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_on DATE        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dechats.user_verb_streak ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own verb streak"
  ON dechats.user_verb_streak FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verb streak"
  ON dechats.user_verb_streak FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verb streak"
  ON dechats.user_verb_streak FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own verb streak"
  ON dechats.user_verb_streak FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
