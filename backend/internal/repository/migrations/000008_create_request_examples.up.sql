CREATE TABLE request_examples (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    request_url TEXT NOT NULL,
    request_headers JSONB,
    request_body TEXT,
    response_status INT NOT NULL,
    response_headers JSONB,
    response_body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_request_examples_request_id ON request_examples(request_id);
