-- ============================================================
--  AMERICAN FIRST FINANCIAL — SUPABASE DATABASE SCHEMA
--  Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ──
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID UNIQUE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  date_of_birth DATE,
  address       TEXT,
  ssn           TEXT UNIQUE,
  city          TEXT,
  country       TEXT DEFAULT 'US',
  postal_code   TEXT,
  avatar_url    TEXT,
  kyc_status    TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending','submitted','approved','rejected')),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','frozen','closed')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADMINS ──
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('super_admin','admin','support','auditor')),
  permissions JSONB DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACCOUNTS ──
CREATE TABLE IF NOT EXISTS accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  account_number TEXT UNIQUE NOT NULL,
  iban           TEXT UNIQUE,
  swift          TEXT DEFAULT 'AFFIUS33XXX',
  account_type   TEXT DEFAULT 'checking' CHECK (account_type IN ('checking','savings','investment','loan')),
  currency       TEXT DEFAULT 'USD',
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','frozen','closed')),
  nickname       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── BALANCES ──
CREATE TABLE IF NOT EXISTS balances (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id   UUID UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  available    NUMERIC(15,2) DEFAULT 0.00,
  pending      NUMERIC(15,2) DEFAULT 0.00,
  total        NUMERIC(15,2) GENERATED ALWAYS AS (available + pending) STORED,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSACTIONS ──
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('credit','debit','transfer','fee','interest','reversal')),
  amount       NUMERIC(15,2) NOT NULL,
  currency     TEXT DEFAULT 'USD',
  description  TEXT,
  category     TEXT DEFAULT 'other',
  ref_no       TEXT UNIQUE,
  status       TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSFERS ──
CREATE TABLE IF NOT EXISTS transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_account_id UUID REFERENCES accounts(id),
  to_account_id   UUID REFERENCES accounts(id),
  to_iban         TEXT,
  to_swift        TEXT,
  to_name         TEXT,
  to_bank         TEXT,
  amount          NUMERIC(15,2) NOT NULL,
  fee             NUMERIC(10,2) DEFAULT 0.00,
  currency        TEXT DEFAULT 'USD',
  type            TEXT DEFAULT 'domestic' CHECK (type IN ('domestic','international','swift','express')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  swift_ref       TEXT UNIQUE,
  note            TEXT,
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── CARDS ──
CREATE TABLE IF NOT EXISTS cards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  card_number   TEXT NOT NULL,
  cardholder    TEXT NOT NULL,
  expiry        TEXT NOT NULL,
  cvv_hash      TEXT,
  card_type     TEXT DEFAULT 'visa' CHECK (card_type IN ('visa','mastercard','amex')),
  card_tier     TEXT DEFAULT 'standard' CHECK (card_tier IN ('standard','gold','platinum','black')),
  is_virtual    BOOLEAN DEFAULT TRUE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','frozen','blocked','expired','cancelled')),
  daily_limit   NUMERIC(10,2) DEFAULT 5000.00,
  online_enabled       BOOLEAN DEFAULT TRUE,
  contactless_enabled  BOOLEAN DEFAULT TRUE,
  intl_enabled         BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATIONS ──
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','danger','transaction','security')),
  is_read    BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUPPORT TICKETS ──
CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  category      TEXT DEFAULT 'general' CHECK (category IN ('general','transfer','card','account','loan','technical','fraud')),
  priority      TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status        TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to   UUID REFERENCES admins(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── TICKET REPLIES ──
CREATE TABLE IF NOT EXISTS ticket_replies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID,
  sender_type TEXT CHECK (sender_type IN ('user','admin')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOGIN LOGS ──
CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email       TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  location    TEXT,
  success     BOOLEAN DEFAULT TRUE,
  failure_reason TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- ── KYC DOCUMENTS ──
CREATE TABLE IF NOT EXISTS kyc_documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('passport','drivers_license','national_id','utility_bill','bank_statement','selfie')),
  file_url     TEXT,
  file_name    TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOANS ──
CREATE TABLE IF NOT EXISTS loans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES accounts(id),
  loan_ref        TEXT UNIQUE,
  loan_type       TEXT DEFAULT 'personal' CHECK (loan_type IN ('personal','mortgage','auto','business','education')),
  amount          NUMERIC(15,2) NOT NULL,
  interest_rate   NUMERIC(5,2) NOT NULL,
  term_months     INTEGER NOT NULL,
  monthly_payment NUMERIC(10,2),
  outstanding     NUMERIC(15,2),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','active','paid','defaulted','rejected')),
  disbursed_at    TIMESTAMPTZ,
  next_payment_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVESTMENTS ──
CREATE TABLE IF NOT EXISTS investments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id    UUID REFERENCES accounts(id),
  inv_type      TEXT DEFAULT 'fixed_deposit' CHECK (inv_type IN ('fixed_deposit','mutual_fund','stocks','bonds','crypto')),
  amount        NUMERIC(15,2) NOT NULL,
  return_rate   NUMERIC(5,2) DEFAULT 5.00,
  current_value NUMERIC(15,2),
  maturity_date DATE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','matured','withdrawn','cancelled')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SAVINGS GOALS ──
CREATE TABLE IF NOT EXISTS savings_goals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id     UUID REFERENCES accounts(id),
  goal_name      TEXT NOT NULL,
  target_amount  NUMERIC(15,2) NOT NULL,
  current_amount NUMERIC(15,2) DEFAULT 0.00,
  deadline       DATE,
  icon           TEXT DEFAULT '🎯',
  color          TEXT DEFAULT '#1a56db',
  auto_save      BOOLEAN DEFAULT FALSE,
  auto_save_amount NUMERIC(10,2) DEFAULT 0.00,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── BENEFICIARIES ──
CREATE TABLE IF NOT EXISTS beneficiaries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name      TEXT NOT NULL,
  iban           TEXT,
  swift          TEXT,
  currency       TEXT DEFAULT 'USD',
  country        TEXT DEFAULT 'US',
  is_favourite   BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADMIN LOGS ──
CREATE TABLE IF NOT EXISTS admin_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SYSTEM SETTINGS ──
CREATE TABLE IF NOT EXISTS system_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      JSONB NOT NULL,
  label      TEXT,
  category   TEXT DEFAULT 'general',
  updated_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEFAULT SETTINGS ──
INSERT INTO system_settings (key, value, label, category) VALUES
  ('base_currency',      '"USD"',       'Base Currency',              'currency'),
  ('supported_currencies','["USD","EUR","GBP","CAD","AUD","JPY","CHF","SGD","AED","NGN"]', 'Supported Currencies', 'currency'),
  ('domestic_fee',       '0',           'Domestic Transfer Fee ($)',  'fees'),
  ('intl_fee_flat',      '15',          'International Fee Flat ($)', 'fees'),
  ('intl_fee_percent',   '0.5',         'International Fee (%)',      'fees'),
  ('swift_fee',          '25',          'SWIFT Transfer Fee ($)',     'fees'),
  ('savings_rate',       '3.5',         'Savings Interest Rate (%)',  'rates'),
  ('loan_rate',          '8.9',         'Default Loan Rate (%)',      'rates'),
  ('fd_rate',            '5.2',         'Fixed Deposit Rate (%)',     'rates'),
  ('daily_transfer_limit','50000',      'Daily Transfer Limit ($)',   'limits'),
  ('single_transfer_limit','25000',     'Single Transfer Limit ($)',  'limits'),
  ('maintenance_mode',   'false',       'Maintenance Mode',           'system'),
  ('allow_registration', 'true',        'Allow New Registrations',    'system'),
  ('require_kyc',        'true',        'Require KYC for Transfers',  'system'),
  ('bank_name',          '"American First Financial"', 'Bank Name',   'branding'),
  ('bank_tagline',       '"Your Trusted Financial Partner"', 'Tagline', 'branding')
ON CONFLICT (key) DO NOTHING;

-- ── INDEXES ──
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_time ON admin_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status);

-- ── UPDATED_AT TRIGGER ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
