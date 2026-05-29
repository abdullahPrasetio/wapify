DROP TABLE IF EXISTS mock_request_logs;

ALTER TABLE mock_endpoints
  DROP COLUMN IF EXISTS delay_max_ms,
  DROP COLUMN IF EXISTS error_rate,
  DROP COLUMN IF EXISTS error_status_code;

ALTER TABLE collections
  DROP COLUMN IF EXISTS chaos_mode;
