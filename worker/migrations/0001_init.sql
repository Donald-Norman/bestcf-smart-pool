CREATE TABLE IF NOT EXISTS pools(
 id TEXT PRIMARY KEY,name TEXT NOT NULL,region TEXT NOT NULL,carrier TEXT NOT NULL DEFAULT 'auto',
 size INTEGER NOT NULL DEFAULT 20,update_interval_minutes INTEGER NOT NULL DEFAULT 30,
 mode TEXT NOT NULL DEFAULT 'auto',ipv4 INTEGER NOT NULL DEFAULT 1,ipv6 INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pool_items(
 id TEXT PRIMARY KEY,pool_id TEXT NOT NULL,ip TEXT NOT NULL,version INTEGER NOT NULL,
 region TEXT,carrier TEXT,source TEXT,status TEXT NOT NULL DEFAULT 'active',locked INTEGER NOT NULL DEFAULT 0,
 score REAL NOT NULL DEFAULT 0,latency_ms REAL,success_rate REAL,speed_mbps REAL,last_test_at INTEGER,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(pool_id,ip)
);
CREATE INDEX IF NOT EXISTS idx_pool_items_pool ON pool_items(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_items_score ON pool_items(pool_id,score DESC);
CREATE TABLE IF NOT EXISTS candidates(
 ip TEXT PRIMARY KEY,version INTEGER NOT NULL,region TEXT,carrier TEXT,source TEXT,last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_region ON candidates(region);
CREATE TABLE IF NOT EXISTS test_history(
 id INTEGER PRIMARY KEY AUTOINCREMENT,ip TEXT NOT NULL,available INTEGER NOT NULL,latency_ms REAL,
 success_rate REAL,speed_mbps REAL,tested_at INTEGER NOT NULL
);
