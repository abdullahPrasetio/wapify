ALTER TABLE request_examples
    ALTER COLUMN request_body TYPE jsonb USING CASE
        WHEN request_body IS NULL OR request_body = '' THEN '{}'::jsonb
        ELSE jsonb_build_object('raw', request_body)
    END;
