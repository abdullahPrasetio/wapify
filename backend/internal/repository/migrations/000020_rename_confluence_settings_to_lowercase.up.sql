INSERT INTO system_settings (key, value, updated_at) VALUES ('confluence_enabled', 'false', NOW());
INSERT INTO system_settings (key, value, updated_at) VALUES ('confluence_base_url', '', NOW());
INSERT INTO system_settings (key, value, updated_at) VALUES ('confluence_personal_token', '', NOW());
INSERT INTO system_settings (key, value, updated_at) VALUES ('confluence_space_key', '', NOW());

-- Migration to move data if already exists in uppercase
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'CONFLUENCE_ENABLED') WHERE key = 'confluence_enabled' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'CONFLUENCE_ENABLED');
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'CONFLUENCE_BASE_URL') WHERE key = 'confluence_base_url' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'CONFLUENCE_BASE_URL');
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'CONFLUENCE_PERSONAL_TOKEN') WHERE key = 'confluence_personal_token' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'CONFLUENCE_PERSONAL_TOKEN');
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'CONFLUENCE_SPACE_KEY') WHERE key = 'confluence_space_key' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'CONFLUENCE_SPACE_KEY');

-- Delete old uppercase keys
DELETE FROM system_settings WHERE key IN ('CONFLUENCE_ENABLED', 'CONFLUENCE_BASE_URL', 'CONFLUENCE_PERSONAL_TOKEN', 'CONFLUENCE_SPACE_KEY');
