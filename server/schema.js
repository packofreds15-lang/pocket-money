// Database tables. These are created automatically the first time the site runs,
// so there's nothing to paste into the database console.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    age_band TEXT NOT NULL DEFAULT '',
    parent_consent INTEGER NOT NULL DEFAULT 0,
    google_sub TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL,
    terms_version TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS sessions(
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS login_links(
    token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, payload TEXT, expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0, next TEXT)`,
  `CREATE TABLE IF NOT EXISTS user_state(
    user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, key))`,
  `CREATE TABLE IF NOT EXISTS quiz_attempts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, kind TEXT NOT NULL,
    score INTEGER NOT NULL, total INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS quiz_user ON quiz_attempts(user_id)`,
  `CREATE TABLE IF NOT EXISTS feedback(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, rating INTEGER NOT NULL, comment TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT, email TEXT, topic TEXT, body TEXT,
    created_at INTEGER NOT NULL, handled INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS page_views(day TEXT NOT NULL, page TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day, page))`,
  `CREATE TABLE IF NOT EXISTS activity(day TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(day, user_id))`,
  `CREATE TABLE IF NOT EXISTS company_views(day TEXT NOT NULL, symbol TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day, symbol))`,
  `CREATE TABLE IF NOT EXISTS site_content(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)`,
];
