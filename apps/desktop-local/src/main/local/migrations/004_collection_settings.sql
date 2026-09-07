-- Collection-level settings parity dgn requests (auth/scripts) + variables
-- scope terpisah dari environments, mirror Postgres migration 000033.
ALTER TABLE collections ADD COLUMN auth_config TEXT NOT NULL DEFAULT '{}';
ALTER TABLE collections ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT '';
ALTER TABLE collections ADD COLUMN post_request_script TEXT NOT NULL DEFAULT '';
ALTER TABLE collections ADD COLUMN variables TEXT NOT NULL DEFAULT '{}';
