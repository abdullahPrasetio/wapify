CREATE TABLE mock_scenarios (
    id               SERIAL PRIMARY KEY,
    mock_endpoint_id INTEGER NOT NULL REFERENCES mock_endpoints(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    status_code      INTEGER NOT NULL DEFAULT 200,
    response_headers JSONB NOT NULL DEFAULT '{}',
    response_body    TEXT NOT NULL DEFAULT '',
    conditions       JSONB NOT NULL DEFAULT '[]',
    is_default       BOOLEAN NOT NULL DEFAULT false,
    order_index      DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE mock_endpoints ADD COLUMN evaluation_mode VARCHAR(20) NOT NULL DEFAULT 'auto';
ALTER TABLE mock_endpoints ADD COLUMN active_scenario_id INTEGER REFERENCES mock_scenarios(id) ON DELETE SET NULL;
