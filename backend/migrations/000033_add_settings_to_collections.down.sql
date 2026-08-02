ALTER TABLE collections DROP COLUMN IF EXISTS auth_config;
ALTER TABLE collections DROP COLUMN IF EXISTS pre_request_script;
ALTER TABLE collections DROP COLUMN IF EXISTS post_request_script;
ALTER TABLE collections DROP COLUMN IF EXISTS variables;
