ALTER TABLE collections ADD COLUMN auth_config JSONB DEFAULT '{}';
ALTER TABLE collections ADD COLUMN pre_request_script TEXT DEFAULT '';
ALTER TABLE collections ADD COLUMN post_request_script TEXT DEFAULT '';
ALTER TABLE collections ADD COLUMN variables JSONB DEFAULT '{}';
