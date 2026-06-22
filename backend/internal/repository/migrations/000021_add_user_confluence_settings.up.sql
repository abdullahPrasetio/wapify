CREATE TABLE user_confluence_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    base_url TEXT DEFAULT '',
    personal_token TEXT DEFAULT '',
    space_key TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Move existing global data to all existing users as initial state if you want, 
-- but usually per-user means they start empty or with their own.
-- Let's just leave it empty for now as it's a new "per-user" paradigm.
