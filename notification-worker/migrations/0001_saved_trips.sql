CREATE TABLE IF NOT EXISTS saved_trips (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  journey_key TEXT NOT NULL,
  trip_json TEXT NOT NULL,
  flags_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE (subscription_id, journey_key)
);

CREATE INDEX IF NOT EXISTS saved_trips_due_idx ON saved_trips(date_key, starts_at);
CREATE INDEX IF NOT EXISTS saved_trips_expiry_idx ON saved_trips(expires_at);
