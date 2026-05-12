ALTER TABLE user_confluence_settings ADD COLUMN confluence_pat TEXT DEFAULT '';
ALTER TABLE user_confluence_settings ADD COLUMN confluence_api_token TEXT DEFAULT '';
-- Kita biarkan personal_token ada dulu agar tidak breaking, atau kita migrasi datanya.
UPDATE user_confluence_settings SET confluence_api_token = personal_token;
