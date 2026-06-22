INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_ENABLED', 'false', NOW());
INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_BASE_URL', '', NOW());
INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_PERSONAL_TOKEN', '', NOW());
INSERT INTO system_settings (key, value, updated_at) VALUES ('CONFLUENCE_SPACE_KEY', '', NOW());

UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'confluence_enabled') WHERE key = 'CONFLUENCE_ENABLED' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'confluence_enabled');
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'confluence_base_url') WHERE key = 'CONFLUENCE_BASE_URL' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'confluence_base_url');
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'confluence_personal_token') WHERE key = 'CONFLUENCE_PERSONAL_TOKEN' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'confluence_personal_token');
UPDATE system_settings SET value = (SELECT value FROM system_settings WHERE key = 'confluence_space_key') WHERE key = 'CONFLUENCE_SPACE_KEY' AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'confluence_space_key');

DELETE FROM system_settings WHERE key IN ('confluence_enabled', 'confluence_base_url', 'confluence_personal_token', 'confluence_space_key');
