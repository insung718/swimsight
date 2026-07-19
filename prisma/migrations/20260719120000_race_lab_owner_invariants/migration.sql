-- Defense in depth: a split or saved scenario may only reference a result owned
-- by the same account. Application queries already enforce this invariant.
CREATE FUNCTION "enforce_race_split_owner_match"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "SwimResult"
    WHERE "id" = NEW."swimResultId" AND "userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'Race split owner must match the source result owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RaceSplit_owner_match"
BEFORE INSERT OR UPDATE OF "userId", "swimResultId" ON "RaceSplit"
FOR EACH ROW EXECUTE FUNCTION "enforce_race_split_owner_match"();

CREATE FUNCTION "enforce_race_lab_scenario_owner_match"() RETURNS trigger AS $$
BEGIN
  IF NEW."baseResultId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "SwimResult"
    WHERE "id" = NEW."baseResultId" AND "userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'Race Lab scenario owner must match the source result owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RaceLabScenario_owner_match"
BEFORE INSERT OR UPDATE OF "userId", "baseResultId" ON "RaceLabScenario"
FOR EACH ROW EXECUTE FUNCTION "enforce_race_lab_scenario_owner_match"();

-- The source-result foreign key uses ON DELETE SET NULL. Preserve snapshot
-- immutability while allowing that one database-managed reference detach.
CREATE OR REPLACE FUNCTION "enforce_race_lab_scenario_immutability"() RETURNS trigger AS $$
BEGIN
  IF OLD."baseResultId" IS NOT NULL
    AND NEW."baseResultId" IS NULL
    AND (to_jsonb(NEW) - 'baseResultId') = (to_jsonb(OLD) - 'baseResultId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Race Lab scenarios are immutable; save a new scenario instead';
END;
$$ LANGUAGE plpgsql;
