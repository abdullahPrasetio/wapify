ALTER TABLE mock_scenarios ADD COLUMN response_type VARCHAR(20) NOT NULL DEFAULT 'text';
ALTER TABLE mock_scenarios ADD COLUMN file_name VARCHAR(255);
ALTER TABLE mock_scenarios ADD COLUMN file_base64 TEXT;
