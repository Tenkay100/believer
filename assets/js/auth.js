// ── AMERICAN FIRST FINANCIAL — AUTH MODULE ──
import { initSupabase, getSupabase, signIn, signOut, getSession, getUser, logLogin, dbSelect, dbInsert } from './firebase.js';
import { showToast, Storage } from './utils.js';

// ── INIT ──
initSupabase();

import { initSupportWidget } from './support-widget.js';
if (!window.location.pathname.includes('/admin/')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportWidget);
  } else {
    initSupportWidget();
  }
}

// ── ROUTE GUARD (call on protected pages) ──
export async function requireAuth(allowedRoles = ['client', 'admin', 'super_admin', 'support', 'auditor']) {
  const session = await getSession();
  if (!session) { redirectToLogin(); return null; }
  const profile = await loadProfile(session.user.id);
  if (!profile) {
    await signOut();
    redirectToLogin();
    return null;
  }
  if (profile.kyc_status !== 'approved') {
    await signOut();
    redirectToLogin();
    return null;
  }
  if (profile.status === 'suspended') {
    await signOut();
    showToast("Your account has been suspended.", "danger");
    setTimeout(() => redirectToLogin(), 2000);
    return null;
  }

  const role = profile.role || 'client';
  if (!allowedRoles.includes(role)) {
    if (!window.location.pathname.endsWith('dashboard.html')) {
      window.location.href = 'dashboard.html';
    }
    return null;
  }

  // Start Idle Timer for secure pages
  const lastActivity = parseInt(localStorage.getItem('aff_last_activity') || Date.now());
  const diff = (Date.now() - lastActivity) / 1000;
  if (diff >= 120) { // 2 minutes
    console.log("Session expired on load. Logging out...");
    await logout(false);
    return null;
  }
  startIdleTimer();

  return profile;
}

export async function requireAdminAuth(allowedRoles = ['super_admin', 'admin', 'support', 'auditor']) {
  const session = await getSession();

  // Hardcoded bypass for demo admin
  const storedAdmin = Storage.get('admin_profile');
  if (storedAdmin && storedAdmin.email === 'admin') {
    return storedAdmin;
  }

  if (!session) { window.location.href = 'login.html'; return null; }
  const db = getSupabase();
  const { data: admin } = await db.from('admins').select('*').eq('email', session.user.email).single();
  if (!admin || !admin.is_active) {
    await signOut();
    window.location.href = 'login.html';
    return null;
  }
  if (!allowedRoles.includes(admin.role)) {
    showToast('Access denied for your role', 'danger');
    if (!window.location.pathname.endsWith('dashboard.html')) {
      window.location.href = 'dashboard.html';
    }
    return null;
  }
  Storage.set('admin_profile', admin);

  // Start Idle Timer for secure pages
  const lastActivity = parseInt(localStorage.getItem('aff_last_activity') || Date.now());
  const diff = (Date.now() - lastActivity) / 1000;
  if (diff >= 120) { // 2 minutes
    console.log("Admin session expired on load. Logging out...");
    await logout(true);
    return null;
  }
  startIdleTimer();

  return admin;
}

// ── LOAD USER PROFILE ──
export async function loadProfile(authId) {
  const { data } = await dbSelect('users', { eq: { auth_id: authId }, limit: 1 });
  if (data && data[0]) {
    Storage.set('user_profile', data[0]);
    return data[0];
  }
  return null;
}

// ── CLIENT LOGIN ──
export async function clientLogin(email, password) {
  const { data: user } = await dbSelect('users', { eq: { email }, limit: 1 });
  if (!user || user.length === 0) {
    return { success: false, message: 'Invalid email or password.' };
  }

  const storedPwd = Storage.get('mock_pwd_' + email);
  if (storedPwd && storedPwd !== password) {
    return { success: false, message: 'Invalid email or password.' };
  }

  const profile = user[0];
  if (profile.kyc_status !== 'approved') {
    await logLoginAttempt(email, false, 'Account pending admin approval.');
    return { success: false, message: 'Account pending admin approval.' };
  }
  if (profile.status === 'suspended') {
    await logLoginAttempt(email, false, 'Account suspended.');
    return { success: false, message: 'Your account has been suspended by administration.' };
  }

  await logLoginAttempt(email, true);
  localStorage.setItem('mock_session', JSON.stringify({ user: { id: profile.auth_id, email: profile.email } }));
  Storage.set('user_profile', profile);
  return { success: true, profile };
}

// ── ADMIN LOGIN ──
export async function adminLogin(email, password) {
  // Hardcoded bypass for demo purposes
  if (email === 'admin' && password === 'admin4321') {
    const mockAdmin = {
      id: 'mock-admin-id',
      email: 'admin',
      full_name: 'System Administrator',
      role: 'super_admin',
      is_active: true
    };
    Storage.set('admin_profile', mockAdmin);
    Storage.set('session', { user: mockAdmin }); // Mock session
    return { success: true, admin: mockAdmin };
  }

  try {
    const { data, error } = await signIn(email, password);
    if (error) {
      await logLoginAttempt(email, false, error.message);
      return { success: false, message: parseAuthError(error.message) };
    }
    // Check admin record
    const db = getSupabase();
    const { data: admin } = await db.from('admins').select('*').eq('email', email).single();
    if (!admin || !admin.is_active) {
      await signOut();
      return { success: false, message: 'Admin account not found or inactive.' };
    }
    // Update last login
    await db.from('admins').update({ last_login: new Date().toISOString() }).eq('id', admin.id);
    await logLoginAttempt(email, true);
    Storage.set('admin_profile', admin);
    Storage.set('session', data.session);
    return { success: true, admin };
  } catch (e) {
    return { success: false, message: 'Login failed. Please try again.' };
  }
}

// ── LOGOUT ──
export async function logout(isAdmin = false) {
  try {
    await signOut();
  } catch (e) {
    console.error("Sign out error:", e);
  }
  Storage.clear();
  // Absolute redirect to project root index
  const isSubDir = window.location.pathname.includes('/admin/');
  window.location.href = isSubDir ? '../index.html' : 'index.html';
}

// ── REGISTER ──
export async function register(formData) {
  try {
    const db = getSupabase();
    // Check if email exists
    const { data: existing } = await db.from('users').select('id').eq('email', formData.email).single();
    if (existing) return { success: false, message: 'Email already registered.' };

    // BYPASS SUPABASE AUTH API TO PREVENT RATE LIMITS FOREVER
    Storage.set('mock_pwd_' + formData.email, formData.password);
    const fakeAuthId = crypto.randomUUID();

    const { data: userRecord, error: dbError } = await dbInsert('users', {
      auth_id: fakeAuthId,
      email: formData.email,
      full_name: formData.fullName,
      phone: formData.phone || null,
      address: formData.address || null,
      ssn: formData.ssn || null,
      kyc_status: 'approved',
      status: 'active'
    });

    if (dbError) return { success: false, message: 'Database Error: ' + dbError.message };

    if (userRecord && userRecord[0]) {
      const { generateAccountNumber, generateIBAN, generateSWIFT } = await import('./utils.js');
      const accountNumber = generateAccountNumber();
      const { data: acct } = await dbInsert('accounts', {
        user_id: userRecord[0].id,
        account_number: accountNumber,
        iban: generateIBAN(accountNumber),
        swift: generateSWIFT(),
        account_type: 'checking',
        currency: 'USD',
        status: 'active',
        nickname: 'Primary Checking'
      });
      if (acct && acct[0]) await dbInsert('balances', { account_id: acct[0].id, available: 0.00, pending: 0.00 });

      const userId = userRecord[0].id;
      await dbInsert('kyc_documents', { user_id: userId, doc_type: 'national_id', file_name: 'id_front.jpg', status: 'pending' });
      await dbInsert('kyc_documents', { user_id: userId, doc_type: 'national_id', file_name: 'id_back.jpg', status: 'pending' });
      await dbInsert('kyc_documents', { user_id: userId, doc_type: 'selfie', file_name: 'selfie.jpg', status: 'pending' });

      await dbInsert('notifications', {
        user_id: userId,
        title: 'Welcome to American First Financial!',
        message: 'Your account has been created and your identity is fully verified.',
        type: 'success'
      });
    }
    return { success: true, message: 'Account created successfully! You can now log in.' };
  } catch (e) {
    return { success: false, message: 'Registration failed. Please try again.' };
  }
}

// ── SESSION CHECK (redirect if already logged in) ──
export async function redirectIfLoggedIn(adminPage = false) {
  const session = await getSession();
  if (session) {
    if (!adminPage) {
      const profile = await loadProfile(session.user.id);
      if (!profile || profile.kyc_status !== 'approved') {
        await signOut();
        return;
      }
    } else {
      const db = getSupabase();
      const { data: admin } = await db.from('admins').select('id, is_active').eq('email', session.user.email).single();
      if (!admin || !admin.is_active) {
        await signOut();
        return;
      }
    }
    window.location.href = 'dashboard.html';
  }
}

// ── HELPERS ──
function redirectToLogin() {
  const isSubDir = window.location.pathname.includes('/admin/');
  window.location.href = isSubDir ? 'login.html' : 'login.html';
}

async function logLoginAttempt(email, success, reason = null) {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const { ip } = await res.json();
    await dbInsert('login_logs', {
      email, ip_address: ip, user_agent: navigator.userAgent,
      success, failure_reason: reason, timestamp: new Date().toISOString()
    });
  } catch (e) { }
}

function parseAuthError(msg) {
  if (!msg) return 'An error occurred.';
  if (msg.includes('Invalid login')) return 'Invalid email or password.';
  if (msg.includes('Email not confirmed')) return 'Please verify your email first.';
  if (msg.includes('Too many requests')) return 'Too many attempts. Please wait a moment.';
  if (msg.includes('User already registered')) return 'Email already registered.';
  return msg;
}

// ── RATE LIMITING (client-side) ──
export function checkRateLimit(key, maxAttempts = 5, windowMs = 300000) {
  const stored = Storage.get('rate_' + key) || { count: 0, resetAt: Date.now() + windowMs };
  if (Date.now() > stored.resetAt) { stored.count = 0; stored.resetAt = Date.now() + windowMs; }
  stored.count++;
  Storage.set('rate_' + key, stored);
  if (stored.count > maxAttempts) {
    const remaining = Math.ceil((stored.resetAt - Date.now()) / 60000);
    return { blocked: true, message: `Too many attempts. Try again in ${remaining} minute(s).` };
  }
  return { blocked: false };
}

export function resetRateLimit(key) { Storage.remove('rate_' + key); }

// ── GET STORED PROFILE ──
export function getStoredProfile() { return Storage.get('user_profile'); }
export function getStoredAdmin() { return Storage.get('admin_profile'); }

// ── SESSION MANAGEMENT (Custom Mock Session logic) ──
const SESSION_KEY = 'aff_demo_session';

// Global Inactivity Tracking (2 minutes)
let idleInterval = null;
let timerElement = null;

export function startIdleTimer() {
  if (idleInterval) return;

  // Create Timer UI
  if (!timerElement) {
    timerElement = document.createElement('div');
    timerElement.id = 'session-timer';
    timerElement.style = `
      position: fixed; bottom: 20px; left: 20px; 
      background: rgba(0,0,0,0.8); color: #fff; 
      padding: 6px 12px; border-radius: 20px; 
      font-size: 0.75rem; font-weight: bold; font-family: monospace;
      z-index: 10000; border: 1px solid var(--border);
      pointer-events: none; backdrop-filter: blur(4px);
      display: flex; align-items: center; gap: 6px;
    `;
    timerElement.innerHTML = `<i class="ph-bold ph-clock"></i> <span id="session-time">02:00</span>`;
    document.body.appendChild(timerElement);
  }

  console.log("Idle timer started (120s limit)");

  const resetTimer = () => {
    localStorage.setItem('aff_last_activity', Date.now());
  };

  if (!localStorage.getItem('aff_last_activity')) resetTimer();

  // Strict events only
  const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(evt => document.addEventListener(evt, resetTimer));

  idleInterval = setInterval(() => {
    const lastActivity = parseInt(localStorage.getItem('aff_last_activity') || Date.now());
    const diff = Math.floor((Date.now() - lastActivity) / 1000);
    const remaining = Math.max(0, 120 - diff);

    // Update UI
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const display = document.getElementById('session-time');
    if (display) display.textContent = timeStr;

    if (remaining < 30) {
      timerElement.style.color = '#ef4444'; // Danger color
      timerElement.style.borderColor = '#ef4444';
    } else {
      timerElement.style.color = '#fff';
      timerElement.style.borderColor = 'var(--border)';
    }

    if (remaining <= 0) {
      console.log("Session limit reached. Logging out...");
      clearInterval(idleInterval);
      showToast("Session expired due to inactivity.", "warning");
      setTimeout(() => logout(false), 1500);
    }
  }, 1000);
}

export function getMockSession() { return Storage.get('admin_profile'); }
