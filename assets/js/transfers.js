// ── TRANSFERS LOGIC ──
import { requireAuth, logout } from './auth.js';
import { dbSelect, dbInsert, dbUpdate } from './firebase.js';
import { formatCurrency, formatDate, showToast, generateSwiftRef, initSidebar } from './utils.js';

let currentUser = null;
let currentAccount = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth(['client', 'admin', 'super_admin']);
  if (!currentUser) return;

  initUI();
  await loadAccountData();
  await loadTransferHistory();
  
  
  document.getElementById('transfer-form').addEventListener('submit', handleTransferSubmit);

  document.getElementById('transfer-type').addEventListener('change', (e) => {
    const intlFields = document.getElementById('intl-fields');
    if (e.target.value === 'international') {
      intlFields.classList.remove('hidden');
      document.getElementById('recipient-swift').required = true;
      document.getElementById('recipient-bank').required = true;
      document.getElementById('recipient-country').required = true;
    } else {
      intlFields.classList.add('hidden');
      document.getElementById('recipient-swift').required = false;
      document.getElementById('recipient-bank').required = false;
      document.getElementById('recipient-country').required = false;
    }
  });
});

function initUI() {
  document.getElementById('user-name').textContent = currentUser.full_name;
  document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}&background=1a56db&color=fff`;
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.stopPropagation(); logout(false);
  });
  initSidebar();
}

async function loadAccountData() {
  const { data: accounts } = await dbSelect('accounts', { eq: { user_id: currentUser.id } });
  if (accounts && accounts.length > 0) {
    currentAccount = accounts[0];
    const { data: balances } = await dbSelect('balances', { eq: { account_id: currentAccount.id } });
    if (balances && balances.length > 0) {
      const bal = balances[0];
      const realAvailable = Number(bal.available) - Number(bal.pending);
      document.getElementById('available-balance').textContent = formatCurrency(realAvailable, currentAccount.currency);
      currentAccount.available = bal.available;
      currentAccount.pending = bal.pending;
      currentAccount.realAvailable = realAvailable;
    }
  }
}

async function loadTransferHistory() {
  if (!currentAccount) return;
  const { data: transfers } = await dbSelect('transfers', { 
    eq: { from_account_id: currentAccount.id },
    order: { column: 'created_at', ascending: false },
    limit: 6
  });

  const list = document.getElementById('transfer-history');
  list.innerHTML = '';

  if (!transfers || transfers.length === 0) {
    list.innerHTML = `<div class="text-center text-muted text-sm py-16">No transfers found</div>`;
    return;
  }

  transfers.forEach(tr => {
    let badgeClass = 'badge-neutral';
    if (tr.status === 'completed') badgeClass = 'badge-success';
    if (tr.status === 'failed') badgeClass = 'badge-danger';
    if (tr.status === 'pending') badgeClass = 'badge-warning';

    list.innerHTML += `
      <div class="flex-between p-16 border-b border-[var(--border)] hover:bg-[var(--glass)] transition rounded">
        <div>
          <div class="font-bold text-sm">${tr.to_name}</div>
          <div class="text-xs text-muted">${formatDate(tr.created_at)}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">${formatCurrency(tr.amount, tr.currency || currentAccount.currency)}</div>
          <div class="badge ${badgeClass} mt-4" style="font-size: 0.6rem;">${tr.status}</div>
        </div>
      </div>
    `;
  });
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  const alertBox = document.getElementById('transfer-alert');
  const btn = document.getElementById('submit-btn');
  
  const type = document.getElementById('transfer-type').value;
  const name = document.getElementById('recipient-name').value;
  const account = document.getElementById('recipient-account').value;
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  let note = document.getElementById('transfer-note').value;

  if (type === 'international') {
    const swift = document.getElementById('recipient-swift').value;
    const bank = document.getElementById('recipient-bank').value;
    const country = document.getElementById('recipient-country').value;
    note = `[Intl Wire] Bank: ${bank}, SWIFT: ${swift}, Country: ${country}. Note: ${note}`;
  }

  alertBox.classList.add('hidden');

  if (!currentAccount) return;
  if (amount <= 0) {
    showError('Amount must be greater than 0.');
    return;
  }
  
  // Calculate fee
  const fee = type === 'international' ? 15 : 0;
  const totalDeduction = amount + fee;

  if (totalDeduction > currentAccount.realAvailable) {
    showError('Insufficient available balance for this transfer.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner spinner"></i> Processing...';

  // Insert Transfer Record (Status: Pending)
  const { data, error } = await dbInsert('transfers', {
    from_account_id: currentAccount.id,
    to_name: name,
    to_iban: account,
    amount: amount,
    fee: fee,
    currency: currentAccount.currency || 'USD',
    type: type,
    status: 'pending',
    swift_ref: generateSwiftRef(),
    note: note
  });

  if (error) {
    showError('Transfer failed to process. Try again.');
    btn.disabled = false;
    btn.innerHTML = '<span>Send Transfer</span><i class="ph-bold ph-paper-plane-tilt"></i>';
    return;
  }

  // Create pending transaction record
  const { error: txError } = await dbInsert('transactions', {
    account_id: currentAccount.id,
    type: 'transfer',
    amount: -totalDeduction,
    currency: currentAccount.currency || 'USD',
    description: `Transfer to ${name}`,
    status: 'pending',
    ref_no: data.swift_ref
  });

  if (txError) {
    showError('Transfer failed to process. Try again.');
    btn.disabled = false;
    btn.innerHTML = '<span>Send Transfer</span><i class="ph-bold ph-paper-plane-tilt"></i>';
    return;
  }

  // Increment Pending Balance
  const newPending = Number(currentAccount.pending || 0) + totalDeduction;
  await dbUpdate('balances', { pending: newPending }, { account_id: currentAccount.id });

  // Create notification for admin (simulated by just adding to notifications or handled in admin app)
  // Show success modal
  document.getElementById('confirm-modal').classList.add('active');
}

function showError(msg) {
  const box = document.getElementById('transfer-alert');
  box.className = 'alert alert-danger animate-fade-in';
  box.innerHTML = `<i class="ph-bold ph-warning-circle"></i> ${msg}`;
}
