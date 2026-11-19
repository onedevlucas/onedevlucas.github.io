CREATE TABLE operations_revisions (
  revision INTEGER PRIMARY KEY,
  published_at INTEGER NOT NULL,
  changes_json TEXT NOT NULL,
  summary_json TEXT NOT NULL
);

INSERT INTO operations_revisions VALUES (0, 0, '[]', '[]');

CREATE TABLE operations_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE operations_login_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
