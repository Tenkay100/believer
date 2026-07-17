-- ============================================================
--  AMERICAN FIRST FINANCIAL — ROW LEVEL SECURITY POLICIES
--  Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings    ENABLE ROW LEVEL SECURITY;

-- ── HELPER: Check if current user is admin ──
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── HELPER: Check if current user is super_admin ──
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE auth_id = auth.uid() AND role = 'super_admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── HELPER: Get current user's UUID ──
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── USERS TABLE ──
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE USING (is_admin());

CREATE POLICY "Allow user insert on registration"
  ON users FOR INSERT WITH CHECK (TRUE);

-- ── ADMINS TABLE ──
CREATE POLICY "Admins can view admin list"
  ON admins FOR SELECT USING (is_admin());

CREATE POLICY "Super admins can manage admins"
  ON admins FOR ALL USING (is_super_admin());

-- ── ACCOUNTS TABLE ──
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT USING (
    user_id = current_user_id() OR is_admin()
  );

CREATE POLICY "Admins can manage accounts"
  ON accounts FOR ALL USING (is_admin());

CREATE POLICY "Users can create own accounts"
  ON accounts FOR INSERT WITH CHECK (user_id = current_user_id());

-- ── BALANCES TABLE ──
CREATE POLICY "Users can view own balances"
  ON balances FOR SELECT USING (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = account_id AND a.user_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Admins can manage balances"
  ON balances FOR ALL USING (is_admin());

-- ── TRANSACTIONS TABLE ──
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = account_id AND a.user_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Admins can manage transactions"
  ON transactions FOR ALL USING (is_admin());

CREATE POLICY "Users can create transactions on own accounts"
  ON transactions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = account_id AND a.user_id = current_user_id())
  );

-- ── TRANSFERS TABLE ──
CREATE POLICY "Users can view own transfers"
  ON transfers FOR SELECT USING (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = from_account_id AND a.user_id = current_user_id())
    OR EXISTS (SELECT 1 FROM accounts a WHERE a.id = to_account_id AND a.user_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can create transfers"
  ON transfers FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = from_account_id AND a.user_id = current_user_id())
  );

CREATE POLICY "Admins can manage transfers"
  ON transfers FOR ALL USING (is_admin());

-- ── CARDS TABLE ──
CREATE POLICY "Users can view own cards"
  ON cards FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update own cards"
  ON cards FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "Admins can manage cards"
  ON cards FOR ALL USING (is_admin());

-- ── NOTIFICATIONS TABLE ──
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "System and admins can insert notifications"
  ON notifications FOR INSERT WITH CHECK (TRUE);

-- ── SUPPORT TICKETS ──
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update own open tickets"
  ON support_tickets FOR UPDATE USING (user_id = current_user_id() AND status = 'open');

CREATE POLICY "Admins can manage all tickets"
  ON support_tickets FOR ALL USING (is_admin());

-- ── TICKET REPLIES ──
CREATE POLICY "Ticket parties can view replies"
  ON ticket_replies FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND t.user_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users and admins can reply"
  ON ticket_replies FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND t.user_id = current_user_id())
    OR is_admin()
  );

-- ── LOGIN LOGS ──
CREATE POLICY "Users can view own login logs"
  ON login_logs FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "System can insert login logs"
  ON login_logs FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admins can view all login logs"
  ON login_logs FOR SELECT USING (is_admin());

-- ── KYC DOCUMENTS ──
CREATE POLICY "Users can view own KYC docs"
  ON kyc_documents FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can upload KYC docs"
  ON kyc_documents FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Admins can manage KYC"
  ON kyc_documents FOR ALL USING (is_admin());

-- ── LOANS ──
CREATE POLICY "Users can view own loans"
  ON loans FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can apply for loans"
  ON loans FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Admins can manage loans"
  ON loans FOR ALL USING (is_admin());

-- ── INVESTMENTS ──
CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can create investments"
  ON investments FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Admins can manage investments"
  ON investments FOR ALL USING (is_admin());

-- ── SAVINGS GOALS ──
CREATE POLICY "Users can manage own savings goals"
  ON savings_goals FOR ALL USING (user_id = current_user_id() OR is_admin());

-- ── BENEFICIARIES ──
CREATE POLICY "Users can manage own beneficiaries"
  ON beneficiaries FOR ALL USING (user_id = current_user_id() OR is_admin());

-- ── ADMIN LOGS ──
CREATE POLICY "Admins and auditors can view admin logs"
  ON admin_logs FOR SELECT USING (is_admin());

CREATE POLICY "Admins can insert logs"
  ON admin_logs FOR INSERT WITH CHECK (is_admin());

-- ── SYSTEM SETTINGS ──
CREATE POLICY "Anyone can read settings"
  ON system_settings FOR SELECT USING (TRUE);

CREATE POLICY "Only super admin can modify settings"
  ON system_settings FOR ALL USING (is_super_admin());
