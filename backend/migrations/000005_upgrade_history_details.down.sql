ALTER TABLE request_histories 
DROP COLUMN IF EXISTS request_headers,
DROP COLUMN IF EXISTS request_body,
DROP COLUMN IF EXISTS response_headers,
DROP COLUMN IF EXISTS response_body;
