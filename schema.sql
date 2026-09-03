-- Access codes table
CREATE TABLE IF NOT EXISTS access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  checkout_session_id TEXT UNIQUE NOT NULL,
  paid_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_codes_code ON access_codes(code);
CREATE INDEX idx_codes_status ON access_codes(status);

-- Answers table
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  phase TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (code) REFERENCES access_codes(code)
);

CREATE INDEX idx_answers_code ON answers(code);
