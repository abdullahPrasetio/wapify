-- 001_init.sql
-- Mirror 1:1 dari backend/internal/repository/models.go — lihat docs/local-app-design.md §4.

-- ─── Tabel domain (§4.1) ────────────────────────────────────────────────────

CREATE TABLE teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by  INTEGER,               -- selalu local user id (1)
  created_at  TEXT NOT NULL
);

CREATE TABLE collections (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  team_id            INTEGER NOT NULL REFERENCES teams(id),
  created_by         INTEGER,
  confluence_page_id TEXT NOT NULL DEFAULT '',
  chaos_mode         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- ON DELETE CASCADE mirror dari backend/migrations/000001_init_schema.up.sql
CREATE TABLE folders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  collection_id    INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  order_index      REAL NOT NULL DEFAULT 0
);

CREATE TABLE requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  method              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  headers             TEXT NOT NULL DEFAULT '{}',   -- JSON
  body                TEXT NOT NULL DEFAULT '{}',   -- JSON
  body_type           TEXT NOT NULL DEFAULT 'raw-json',
  body_variants       TEXT NOT NULL DEFAULT '{}',   -- JSON
  auth_config         TEXT NOT NULL DEFAULT '{}',   -- JSON
  field_validations   TEXT NOT NULL DEFAULT '{}',   -- JSON
  extraction_rules    TEXT NOT NULL DEFAULT '[]',   -- JSON
  schema_assertions   TEXT NOT NULL DEFAULT '[]',   -- JSON
  collection_id       INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  folder_id           INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  created_by          INTEGER,
  order_index         REAL NOT NULL DEFAULT 0,
  pre_request_script  TEXT NOT NULL DEFAULT '',
  post_request_script TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_requests_collection ON requests(collection_id);
CREATE INDEX idx_requests_folder     ON requests(folder_id);

CREATE TABLE request_examples (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id       INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  request_method   TEXT NOT NULL,
  request_url      TEXT NOT NULL,
  request_headers  TEXT NOT NULL DEFAULT '{}',
  request_body     TEXT NOT NULL DEFAULT '{}',  -- JSON any (object/array/raw)
  response_status  INTEGER NOT NULL,
  response_headers TEXT NOT NULL DEFAULT '{}',
  response_body    TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE environments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  variables  TEXT NOT NULL DEFAULT '{}',        -- JSON
  team_id    INTEGER REFERENCES teams(id),      -- NULL = global env
  is_global  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE request_history (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL DEFAULT 1,
  team_id          INTEGER NOT NULL,
  request_id       INTEGER NOT NULL,
  method           TEXT NOT NULL,
  url              TEXT NOT NULL,
  request_headers  TEXT NOT NULL DEFAULT '{}',
  request_body     TEXT NOT NULL DEFAULT '',
  response_headers TEXT NOT NULL DEFAULT '{}',
  response_body    TEXT NOT NULL DEFAULT '',
  status_code      INTEGER NOT NULL DEFAULT 0,
  response_time    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_history_team    ON request_history(team_id);
CREATE INDEX idx_history_request ON request_history(request_id);

CREATE TABLE request_versions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id          INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  created_by          INTEGER NOT NULL DEFAULT 1,
  name                TEXT,
  method              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  headers             TEXT NOT NULL DEFAULT '{}',
  body                TEXT NOT NULL DEFAULT '{}',
  auth_config         TEXT NOT NULL DEFAULT '{}',
  pre_request_script  TEXT NOT NULL DEFAULT '',
  post_request_script TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL
);

CREATE TABLE comments (          -- local-only di v1, tidak disync
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL DEFAULT 1,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ─── Tabel infrastruktur sync (§4.2) ────────────────────────────────────────

-- sync metadata per row, terpisah dari tabel domain agar skema domain tetap mirror server
CREATE TABLE sync_meta (
  entity      TEXT NOT NULL,            -- 'team' | 'collection' | 'folder' | 'request' | 'environment' | 'example'
  local_id    INTEGER NOT NULL,
  remote_id   INTEGER,                  -- id di server pusat; NULL = belum pernah dipush
  dirty       INTEGER NOT NULL DEFAULT 0,
  deleted_at  TEXT,                     -- tombstone: dihapus lokal, belum dipropagate ke server
  base_hash   TEXT,                     -- hash konten saat terakhir sync (deteksi konflik 3-way)
  last_synced_at TEXT,
  PRIMARY KEY (entity, local_id)
);
CREATE INDEX idx_sync_dirty  ON sync_meta(dirty);
CREATE INDEX idx_sync_remote ON sync_meta(entity, remote_id);

-- konflik yang menunggu keputusan user
CREATE TABLE sync_conflicts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity       TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'content', -- 'content' | 'delete_edit' | 'name_collision' (§6.4)
  local_id     INTEGER NOT NULL,
  remote_id    INTEGER,                 -- NULL utk name_collision (belum ter-map)
  local_snapshot  TEXT NOT NULL,        -- JSON row lokal saat konflik terdeteksi
  remote_snapshot TEXT NOT NULL,        -- JSON row server saat konflik terdeteksi
  detected_at  TEXT NOT NULL,
  resolved_at  TEXT,                    -- NULL = masih pending
  resolution   TEXT                     -- 'local' | 'remote' | 'merged' | 'renamed' | NULL
);

-- state sync global (key-value)
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,               -- 'server_url', 'last_full_sync_at', 'sync_account_email', ...
  value TEXT
);
