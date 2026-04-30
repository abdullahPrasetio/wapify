DROP INDEX IF EXISTS idx_mock_endpoints_team_id;
ALTER TABLE mock_endpoints ALTER COLUMN collection_id SET NOT NULL;
ALTER TABLE mock_endpoints DROP COLUMN IF EXISTS team_id;
