ALTER TABLE request_histories ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_request_histories_team_id ON request_histories(team_id);
CREATE INDEX IF NOT EXISTS idx_request_histories_user_id ON request_histories(user_id);
