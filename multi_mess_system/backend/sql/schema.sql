-- Multi-mess schema with strict mess isolation via mess_id on all domain tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS mess (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mess_name  TEXT NOT NULL,
  mess_code  TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('super_admin', 'mess_admin', 'member')),
  mess_id    UUID NULL REFERENCES mess(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  mess_id    UUID NOT NULL REFERENCES mess(id) ON DELETE CASCADE,
  join_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_mess_name ON members(mess_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_members_mess_status ON members(mess_id, status);

CREATE TABLE IF NOT EXISTS meals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mess_id    UUID NOT NULL REFERENCES mess(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  meal_count NUMERIC(6,2) NOT NULL CHECK (meal_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meals_mess_member_date ON meals(mess_id, member_id, date);
CREATE INDEX IF NOT EXISTS idx_meals_mess_date ON meals(mess_id, date);

CREATE TABLE IF NOT EXISTS bazaar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mess_id     UUID NOT NULL REFERENCES mess(id) ON DELETE CASCADE,
  member_id   UUID NULL REFERENCES members(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bazaar_mess_date ON bazaar(mess_id, date);
CREATE INDEX IF NOT EXISTS idx_bazaar_mess_member ON bazaar(mess_id, member_id);

-- Public "create mess" request workflow: a user submits a request and a Super Admin approves it.
CREATE TABLE IF NOT EXISTS mess_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mess_name       TEXT NOT NULL,
  requester_name  TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  message         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ NULL,
  decided_by      UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  mess_id         UUID NULL REFERENCES mess(id) ON DELETE SET NULL,
  admin_user_id   UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mess_requests_status_created ON mess_requests(status, created_at DESC);
