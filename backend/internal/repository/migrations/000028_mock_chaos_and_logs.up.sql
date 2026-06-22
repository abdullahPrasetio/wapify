-- Per-endpoint chaos/simulation fields
ALTER TABLE mock_endpoints
  ADD COLUMN IF NOT EXISTS delay_max_ms      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_rate        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_status_code INTEGER NOT NULL DEFAULT 500;

-- Collection-level chaos mode flag
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS chaos_mode BOOLEAN NOT NULL DEFAULT false;

-- Request log for mock server
CREATE TABLE IF NOT EXISTS mock_request_logs (
  id           BIGSERIAL PRIMARY KEY,
  endpoint_id  INTEGER,
  collection_id INTEGER,
  method       TEXT    NOT NULL DEFAULT '',
  path         TEXT    NOT NULL DEFAULT '',
  matched      BOOLEAN NOT NULL DEFAULT false,
  injected_error BOOLEAN NOT NULL DEFAULT false,
  status_code  INTEGER NOT NULL DEFAULT 0,
  latency_ms   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_request_logs_collection_id ON mock_request_logs(collection_id);
CREATE INDEX IF NOT EXISTS idx_mock_request_logs_created_at ON mock_request_logs(created_at DESC);
