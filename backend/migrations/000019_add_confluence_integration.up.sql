ALTER TABLE collections ADD COLUMN IF NOT EXISTS confluence_page_id VARCHAR(100);

INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_ENABLED', 'false', NOW()) ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_BASE_URL', '', NOW()) ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_PERSONAL_TOKEN', '', NOW()) ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_SPACE_KEY', '', NOW()) ON CONFLICT (key) DO NOTHING;
