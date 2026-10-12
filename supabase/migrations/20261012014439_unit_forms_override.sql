-- Per-unit conjugation overrides for the verb learning Path.
--
-- Some units teach a form that differs from the verb's stored conjugations. P9
-- (gustar) teaches "me gusta / te gusta / le gusta …" but dechats.verbs holds
-- gusto / gustas / gusta. Rather than special-casing gustar in code, a unit
-- membership can now carry its own forms in verb_unit_members.forms_override:
--
--   { "yo": …, "tu": …, "el": …, "nosotros": …, "ellos": …,   -- required
--     "english": "like (it)" }                                   -- optional prompt verb
--
-- When present, the Path (VerbUnitQuiz, the unit page, Daily Review) uses these
-- forms instead of the verb's stored conjugations for that unit's tense, and
-- "english" (if given) replaces the verb's meaning in English prompts
-- ("I like (it)"). dechats.verbs and every old screen are untouched.
--
-- Additive only: one nullable column, one CHECK, and three UPDATEs on that new
-- column for gustar's memberships (P9 present, F1 future, T1 past). The file
-- runs in one transaction and aborts unless exactly those three rows are set.

BEGIN;

ALTER TABLE dechats.verb_unit_members
  ADD COLUMN forms_override JSONB NULL;

ALTER TABLE dechats.verb_unit_members
  ADD CONSTRAINT verb_unit_members_forms_override_shape CHECK (
    forms_override IS NULL OR (
      jsonb_typeof(forms_override) = 'object'
      AND forms_override ?& ARRAY['yo', 'tu', 'el', 'nosotros', 'ellos']
    )
  );

UPDATE dechats.verb_unit_members m
SET forms_override = o.forms
FROM dechats.verbs v,
     (VALUES
       ('P9', '{"yo": "me gusta",   "tu": "te gusta",   "el": "le gusta",   "nosotros": "nos gusta",   "ellos": "les gusta",   "english": "like (it)"}'::jsonb),
       ('F1', '{"yo": "me gustará", "tu": "te gustará", "el": "le gustará", "nosotros": "nos gustará", "ellos": "les gustará", "english": "like (it)"}'::jsonb),
       ('T1', '{"yo": "me gustó",   "tu": "te gustó",   "el": "le gustó",   "nosotros": "nos gustó",   "ellos": "les gustó",   "english": "like (it)"}'::jsonb)
     ) AS o(unit_id, forms)
WHERE m.verb_id = v.id
  AND v.spanish_infinitive = 'gustar'
  AND m.unit_id = o.unit_id;

DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT count(*) INTO n
  FROM dechats.verb_unit_members m
  JOIN dechats.verbs v ON v.id = m.verb_id
  WHERE v.spanish_infinitive = 'gustar' AND m.forms_override IS NOT NULL
    AND m.unit_id IN ('P9', 'F1', 'T1');
  IF n <> 3 THEN
    RAISE EXCEPTION 'forms_override: expected gustar overrides on P9, F1, T1; set %', n;
  END IF;

  SELECT count(*) INTO n FROM dechats.verb_unit_members WHERE forms_override IS NOT NULL;
  IF n <> 3 THEN
    RAISE EXCEPTION 'forms_override: expected exactly 3 overrides in total, found %', n;
  END IF;
END
$$;

COMMIT;
