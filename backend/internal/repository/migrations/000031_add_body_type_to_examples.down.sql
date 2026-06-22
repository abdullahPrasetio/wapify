-- WARNING: rollback only safe if no form-data/urlencoded bodies exist yet.
-- Array bodies will be cast to their JSON text representation.
ALTER TABLE request_examples
    ALTER COLUMN request_body TYPE text USING COALESCE(request_body->>'raw', request_body::text);
