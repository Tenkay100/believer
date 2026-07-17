// ── AMERICAN FIRST FINANCIAL — UTILITIES ──

// ── ACCOUNT NUMBER GENERATOR ──
export function generateAccountNumber() {
  const prefix = '4471';
  let num = prefix;
  for (let i = 0; i < 8; i++) num += Math.floor(Math.random() * 10);
  return num;
}

// ── IBAN GENERATOR ──
export function generateIBAN(accountNumber) {
  const countryCode = 'US';
  const bankCode = 'AFF';
  const checkDigits = String(Math.floor(Math.random() * 90) + 10);
  const bban = bankCode + checkDigits + accountNumber;
  return `${countryCode}${checkDigits} ${bban.slice(0, 4)} ${bban.slice(4, 8)} ${bban.slice(8, 12)} ${bban.slice(12)}`;
}

// ── SWIFT/BIC GENERATOR ──
export function generateSWIFT() {
  return 'AFFIUS33XXX';
}

// ── CARD NUMBER GENERATOR (Luhn-valid) ──
export function generateCardNumber(type = 'visa') {
  const prefixes = { visa: '4', mastercard: '5', amex: '37' };
  const prefix = prefixes[type] || '4';
  let number = prefix;
  const length = type === 'amex' ? 15 : 16;
  while (number.length < length - 1) number += Math.floor(Math.random() * 10);
  // Luhn check digit
  const digits = number.split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i -= 2) {
    let d = digits[i] * 2;
    if (d > 9) d -= 9;
    sum += d;
  }
  for (let i = digits.length - 2; i >= 0; i -= 2) sum += digits[i];
  const checkDigit = (10 - (sum % 10)) % 10;
  number += checkDigit;
  // Format
  if (type === 'amex') return number.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
  return number.replace(/(\d{4})/g, '$1 ').trim();
}

// ── CARD EXPIRY GENERATOR ──
export function generateExpiry() {
  const now = new Date();
  const year = (now.getFullYear() + Math.floor(Math.random() * 4) + 1) % 100;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  return `${month}/${String(year).padStart(2, '0')}`;
}

// ── CVV GENERATOR ──
export function generateCVV(type = 'visa') {
  const length = type === 'amex' ? 4 : 3;
  return String(Math.floor(Math.random() * Math.pow(10, length))).padStart(length, '0');
}

// ── SWIFT REFERENCE ──
export function generateSwiftRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'AFF';
  for (let i = 0; i < 13; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

// ── TRANSACTION REFERENCE ──
export function generateTxRef() {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
}

// ── LOAN REFERENCE ──
export function generateLoanRef() {
  return 'LN-' + Math.floor(Math.random() * 900000 + 100000);
}

// ── CURRENCY FORMATTER ──
const currencySymbols = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$',
  AUD: 'A$', CHF: 'Fr', CNY: '¥', INR: '₹', NGN: '₦',
  ZAR: 'R', BRL: 'R$', MXN: 'MX$', AED: 'د.إ', SGD: 'S$'
};

export function getCurrencySymbol(currency = 'USD') {
  return currencySymbols[currency] || currency + ' ';
}

export function formatCurrency(amount, currency = 'USD', showSymbol = true) {
  const num = parseFloat(amount) || 0;
  const symbol = currencySymbols[currency] || currency + ' ';
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return showSymbol ? `${symbol}${formatted}` : formatted;
}

export function formatCompact(amount) {
  const num = parseFloat(amount) || 0;
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
  return '$' + num.toFixed(2);
}

// ── DATE FORMATTERS ──
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// ── PASSWORD STRENGTH ──
export function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { level: 'weak', color: '#ef4444', percent: 25 };
  if (score <= 3) return { level: 'fair', color: '#f59e0b', percent: 50 };
  if (score <= 4) return { level: 'good', color: '#3b82f6', percent: 75 };
  return { level: 'strong', color: '#10b981', percent: 100 };
}

// ── INPUT SANITIZER ──
export function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── MASK CARD NUMBER ──
export function maskCardNumber(num) {
  const clean = String(num).replace(/\s/g, '');
  return '**** **** **** ' + clean.slice(-4);
}

// ── MASK ACCOUNT NUMBER ──
export function maskAccountNumber(num) {
  return String(num);
}

// ── QR CODE DATA ──
export function generateQRPayload(accountNumber, amount, currency, name) {
  return JSON.stringify({
    bank: 'American First Financial',
    account: accountNumber,
    amount: amount,
    currency: currency,
    beneficiary: name,
    timestamp: Date.now()
  });
}

// ── INTEREST CALCULATOR ──
export function calculateMonthlyPayment(principal, annualRate, termMonths) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export function generateAmortizationSchedule(principal, annualRate, termMonths) {
  const monthly = calculateMonthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 100 / 12;
  let balance = principal;
  const schedule = [];
  for (let i = 1; i <= termMonths; i++) {
    const interest = balance * r;
    const principalPaid = monthly - interest;
    balance -= principalPaid;
    schedule.push({
      month: i,
      payment: monthly,
      principal: principalPaid,
      interest: interest,
      balance: Math.max(0, balance)
    });
  }
  return schedule;
}

// ── TRANSFER FEE CALCULATOR ──
export function calculateTransferFee(amount, type = 'domestic') {
  const fees = {
    domestic: { flat: 0, percent: 0 },
    international: { flat: 15, percent: 0.005 },
    swift: { flat: 25, percent: 0.01 },
    express: { flat: 5, percent: 0.002 }
  };
  const fee = fees[type] || fees.domestic;
  return fee.flat + (amount * fee.percent);
}

// ── TOAST NOTIFICATION ──
export function showToast(message, type = 'info', duration = 3000) {
  const icons = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' };
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span style="font-size:1rem">${icons[type] || 'ℹ'}</span><span>${sanitize(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, duration);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// ── ANIMATED COUNTER ──
export function animateCounter(element, target, duration = 1500, prefix = '', suffix = '') {
  const start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(eased * target);
    element.textContent = prefix + current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(update);
    else element.textContent = prefix + target.toLocaleString() + suffix;
  }
  requestAnimationFrame(update);
}

// ── LOADING SCREEN ──
export function showLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (screen) screen.classList.remove('fade-out');
}

export function hideLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (screen) {
    setTimeout(() => {
      screen.classList.add('fade-out');
      setTimeout(() => screen.remove(), 500);
    }, 600);
  }
}

// ── SCROLL REVEAL ──
export function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

// ── DEBOUNCE ──
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ── LOCAL STORAGE HELPERS ──
export const Storage = {
  set: (key, value) => { try { localStorage.setItem('aff_' + key, JSON.stringify(value)); } catch (e) { } },
  get: (key) => { try { return JSON.parse(localStorage.getItem('aff_' + key)); } catch (e) { return null; } },
  remove: (key) => localStorage.removeItem('aff_' + key),
  clear: () => { Object.keys(localStorage).filter(k => k.startsWith('aff_')).forEach(k => localStorage.removeItem(k)); }
};

// ── SOUND NOTIFICATION ──
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch (e) { }
}

// ── COPY TO CLIPBOARD ──
export async function copyToClipboard(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} to clipboard`, 'success', 2000);
    return true;
  } catch (e) {
    showToast('Failed to copy', 'danger', 2000);
    return false;
  }
}
// ── SIDEBAR TOGGLE ──
export function initSidebar() {
  const toggles = document.querySelectorAll('.sidebar-toggle, .admin-sidebar-toggle');
  const sidebar = document.querySelector('.sidebar, .admin-sidebar');
  const overlays = document.querySelectorAll('.sidebar-overlay, .admin-sidebar-overlay');
  const closeBtns = document.querySelectorAll('.sidebar-close, .admin-sidebar-close');

  if (!sidebar) return;

  const openSidebar = () => {
    sidebar.classList.add('open');
    overlays.forEach(ov => ov.classList.add('active'));
  };

  const closeSidebar = () => {
    sidebar.classList.remove('open');
    overlays.forEach(ov => ov.classList.remove('active'));
  };

  toggles.forEach(t => t.addEventListener('click', openSidebar));
  overlays.forEach(o => o.addEventListener('click', closeSidebar));
  closeBtns.forEach(c => c.addEventListener('click', closeSidebar));
}
