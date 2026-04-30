-- Step 1: Add team_id to mock_endpoints
ALTER TABLE mock_endpoints ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;

-- Step 2: Make collection_id optional
ALTER TABLE mock_endpoints ALTER COLUMN collection_id DROP NOT NULL;

-- Step 3: Add index for performance
CREATE INDEX idx_mock_endpoints_team_id ON mock_endpoints(team_id);
