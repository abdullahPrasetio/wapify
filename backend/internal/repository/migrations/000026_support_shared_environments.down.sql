DELETE FROM environments WHERE team_id IS NULL OR is_global = TRUE;
ALTER TABLE environments ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE environments DROP COLUMN is_global;
