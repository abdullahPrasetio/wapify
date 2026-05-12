ALTER TABLE user_confluence_settings ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'cloud';
