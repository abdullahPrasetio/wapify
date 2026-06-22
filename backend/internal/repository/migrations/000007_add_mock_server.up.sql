CREATE TABLE mock_endpoints (
    id               SERIAL PRIMARY KEY,
    collection_id    INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    request_id       INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    method           VARCHAR(10) NOT NULL,
    path             TEXT NOT NULL,
    status_code      INTEGER NOT NULL DEFAULT 200,
    response_headers JSONB NOT NULL DEFAULT '{}',
    response_body    TEXT NOT NULL DEFAULT '',
    delay_ms         INTEGER NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mock_endpoints_collection ON mock_endpoints(collection_id);
