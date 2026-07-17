// ── CLIENT APP LOGIC ──
import { requireAuth, logout, getStoredProfile } from './auth.js';
import { dbSelect, dbInsert, dbUpdate, subscribeToTable, getSupabase } from './firebase.js';
import { formatCurrency, getCurrencySymbol, formatDate, maskAccountNumber, showToast, animateCounter, generateSwiftRef, initSidebar } from './utils.js';

let currentUser = null;
let currentAccount = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth(['client', 'admin', 'super_admin']);
  if (!currentUser) return;

  initUI();
  await loadAccountData();
  await loadTransactions();
  initChart();
  initAnnouncements();
});

function initUI() {
  document.getElementById('user-name').textContent = currentUser.full_name;
  document.getElementById('card-name').textContent = currentUser.full_name;
  document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}&background=1a56db&color=fff`;

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    logout(false);
  });

  initSidebar();

  const notifBtn = document.getElementById('notif-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('notif-dropdown');
      dropdown.classList.toggle('hidden');

      if (!dropdown.classList.contains('hidden')) {
        const list = document.getElementById('notif-list');
        list.innerHTML = '<div class="p-16 text-center text-sm text-muted"><i class="ph-bold ph-spinner spinner"></i> Loading...</div>';

        const { data: notifs } = await dbSelect('notifications', {
          eq: { user_id: currentUser.id },
          order: { column: 'created_at', ascending: false }
        });

        if (!notifs || notifs.length === 0) {
          list.innerHTML = '<div class="p-16 text-center text-sm text-muted">No notifications</div>';
        } else {
          list.innerHTML = '';
          notifs.forEach(n => {
            let icon = 'ph-bell';
            let color = 'text-primary';
            if (n.type === 'success') { icon = 'ph-check-circle'; color = 'text-success'; }
            if (n.type === 'error') { icon = 'ph-warning-circle'; color = 'text-danger'; }
            if (n.type === 'warning') { icon = 'ph-warning'; color = 'text-warning'; }

            list.innerHTML += `
              <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; text-align: left;">
                <i class="ph-bold ${icon} ${color}" style="margin-top: 2px;"></i>
                <div>
                  <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 4px; color: white;">${n.title}</div>
                  <div style="font-size: 0.75rem; color: var(--text-400);">${n.message}</div>
                  <div style="font-size: 0.65rem; color: var(--text-500); margin-top: 6px;">${new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            `;
          });
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!notifBtn.contains(e.target)) {
        document.getElementById('notif-dropdown').classList.add('hidden');
      }
    });
  }
}

async function loadAccountData() {
  const { data: accounts } = await dbSelect('accounts', { eq: { user_id: currentUser.id } });
  if (accounts && accounts.length > 0) {
    currentAccount = accounts[0];
    document.getElementById('primary-account').textContent = maskAccountNumber(currentAccount.account_number);

    // Load balance
    const { data: balances } = await dbSelect('balances', { eq: { account_id: currentAccount.id } });
    if (balances && balances.length > 0) {
      const bal = balances[0];
      const available = Number(bal.available) - Number(bal.pending);
      animateCounter(document.getElementById('total-balance'), available, 1500, getCurrencySymbol(currentAccount.currency));
      document.getElementById('pending-balance').textContent = formatCurrency(bal.pending, currentAccount.currency);
    }

    // Subscribe to balance updates
    subscribeToTable('balances', (payload) => {
      if (payload.new.account_id === currentAccount.id) {
        const available = Number(payload.new.available) - Number(payload.new.pending);
        document.getElementById('total-balance').textContent = formatCurrency(available, currentAccount.currency);
        document.getElementById('pending-balance').textContent = formatCurrency(payload.new.pending, currentAccount.currency);
        showToast('Balance updated', 'success');
      }
    }, `account_id=eq.${currentAccount.id}`);
    // Load card
    const { data: cards } = await dbSelect('cards', { eq: { user_id: currentUser.id }, order: { column: 'created_at', ascending: false } });
    const cardNumEl = document.getElementById('card-number');
    const cardExpEl = document.getElementById('card-expiry');
    const cardCvvEl = document.getElementById('card-cvv');

    if (cards && cards.length > 0) {
      const card = cards[0];
      if (cardNumEl) cardNumEl.textContent = card.card_number;
      if (cardExpEl) cardExpEl.textContent = card.expiry;
      if (cardCvvEl) cardCvvEl.textContent = card.cvv_hash;
    } else {
      if (cardNumEl) cardNumEl.textContent = "No Active Card";
      if (cardExpEl) cardExpEl.textContent = "--/--";
      if (cardCvvEl) cardCvvEl.textContent = "---";
    }
  }
}

async function loadTransactions() {
  if (!currentAccount) return;
  const { data: txs } = await dbSelect('transactions', {
    eq: { account_id: currentAccount.id },
    order: { column: 'created_at', ascending: false },
    limit: 5
  });

  const list = document.getElementById('tx-list');
  list.innerHTML = '';

  if (!txs || txs.length === 0) {
    list.innerHTML = `<div class="text-center p-24 text-muted text-sm">No recent transactions</div>`;
    return;
  }

  txs.forEach(tx => {
    const isCredit = tx.type === 'credit' || tx.type === 'interest';
    const amountClass = isCredit ? 'credit' : 'debit';
    const sign = isCredit ? '+' : '-';

    let icon = 'ph-arrows-left-right';
    let iconClass = 'transfer';
    if (tx.type === 'credit') { icon = 'ph-arrow-down-left'; iconClass = 'credit'; }
    if (tx.type === 'debit') { icon = 'ph-shopping-cart'; iconClass = 'debit'; }

    const item = document.createElement('div');
    item.className = 'tx-item animate-fade-in';
    item.innerHTML = `
      <div class="tx-icon ${iconClass}"><i class="ph-bold ${icon}"></i></div>
      <div class="tx-info">
        <div class="tx-name">${tx.description || 'Transaction'}</div>
        <div class="tx-date">${formatDate(tx.created_at)} • ${tx.status}</div>
      </div>
      <div class="tx-amount ${amountClass}">${sign}${formatCurrency(tx.amount, currentAccount.currency)}</div>
    `;
    list.appendChild(item);
  });
}

function initChart() {
  const ctx = document.getElementById('spendingChart');
  if (!ctx) return;

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'Income',
          data: [1200, 1900, 800, 1500],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: [500, 800, 1200, 400],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { display: false, beginAtZero: true },
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
      }
    }
  });

  // Attach filter events
  const filters = document.querySelectorAll('.chart-filter');
  filters.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filters.forEach(f => f.classList.remove('active'));
      e.target.classList.add('active');

      const period = e.target.textContent;
      if (period === '1W') {
        chart.data.labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        chart.data.datasets[0].data = [120, 190, 80, 150, 200, 50, 10];
        chart.data.datasets[1].data = [50, 80, 120, 40, 110, 90, 30];
      } else if (period === '1M') {
        chart.data.labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        chart.data.datasets[0].data = [1200, 1900, 800, 1500];
        chart.data.datasets[1].data = [500, 800, 1200, 400];
      } else if (period === '1Y') {
        chart.data.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        chart.data.datasets[0].data = [12000, 19000, 18000, 15000, 20000, 25000, 21000, 19000, 22000, 24000, 28000, 30000];
        chart.data.datasets[1].data = [5000, 8000, 12000, 4000, 11000, 9000, 8000, 9000, 10000, 8000, 12000, 14000];
      }
      chart.update();
    });
  });
}

// Global actions
window.downloadStatement = () => {
  showToast('Preparing your statement...', 'info');
  setTimeout(() => {
    const csvContent = "data:text/csv;charset=utf-8,Date,Description,Amount,Status\n" +
      "2026-05-12,Mobile Check Deposit,150.00,Completed\n" +
      "2026-05-11,Spotify Premium,-10.99,Completed\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "AFF_Statement.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Statement downloaded.', 'success');
  }, 1500);
};

window.submitWithdrawal = async () => {
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  if (!amount || amount <= 0) {
    showToast('Enter a valid amount', 'danger');
    return;
  }
  if (!currentAccount) return;

  const btn = document.getElementById('confirm-withdraw-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner spinner"></i> Processing...';

  const db = getSupabase();
  const { data: b } = await db.from('balances').select('available, pending').eq('account_id', currentAccount.id).single();
  const realAvailable = Number(b.available || 0) - Number(b.pending || 0);

  if (!b || realAvailable < amount) {
    showToast('Insufficient available funds', 'danger');
    btn.disabled = false;
    btn.innerHTML = 'Request Withdrawal';
    return;
  }

  const ref = generateSwiftRef();

  const { error: txError } = await dbInsert('transactions', {
    account_id: currentAccount.id,
    type: 'debit',
    amount: amount,
    currency: currentAccount.currency || 'USD',
    description: 'Bank Withdrawal Request',
    status: 'pending',
    ref_no: ref
  });

  if (txError) {
    showToast('Withdrawal request failed', 'danger');
  } else {
    // Increment Pending Balance
    const newPending = Number(b.pending || 0) + amount;
    await dbUpdate('balances', { pending: newPending }, { account_id: currentAccount.id });

    showToast('Withdrawal requested successfully. Pending admin approval.', 'success');
    document.getElementById('withdraw-modal').classList.remove('active');
    document.getElementById('withdraw-amount').value = '';
    loadAccountData();
    loadTransactions();
  }

  btn.disabled = false;
  btn.innerHTML = 'Request Withdrawal';
};

window.submitExchange = async () => {
  const amount = parseFloat(document.getElementById('exchange-amount').value);
  const currency = document.getElementById('exchange-currency').value;
  if (!amount || amount <= 0) {
    showToast('Enter a valid amount', 'danger');
    return;
  }
  if (!currentAccount) return;

  const btn = document.getElementById('confirm-exchange-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner spinner"></i> Processing...';

  const db = getSupabase();
  const { data: b } = await db.from('balances').select('available, pending').eq('account_id', currentAccount.id).single();
  const realAvailable = Number(b.available || 0) - Number(b.pending || 0);

  if (!b || realAvailable < amount) {
    showToast('Insufficient available funds', 'danger');
    btn.disabled = false;
    btn.innerHTML = 'Request Exchange';
    return;
  }

  const ref = generateSwiftRef();

  const { error: txError } = await dbInsert('transactions', {
    account_id: currentAccount.id,
    type: 'debit',
    amount: amount,
    currency: currentAccount.currency || 'USD',
    description: `Currency Exchange to ${currency}`,
    status: 'pending',
    ref_no: ref
  });

  if (txError) {
    showToast('Exchange request failed', 'danger');
  } else {
    // Increment Pending Balance
    const newPending = Number(b.pending || 0) + amount;
    await dbUpdate('balances', { pending: newPending }, { account_id: currentAccount.id });

    showToast(`Exchange to ${currency} requested. Pending admin approval.`, 'success');
    document.getElementById('exchange-modal').classList.remove('active');
    document.getElementById('exchange-amount').value = '';
    loadAccountData();
    loadTransactions();
  }

  btn.disabled = false;
  btn.innerHTML = 'Request Exchange';
};

async function initAnnouncements() {
  const { data: notifs } = await dbSelect('notifications', {
    eq: { user_id: currentUser.id, type: 'warning', title: 'System Announcement' },
    order: { column: 'created_at', ascending: false },
    limit: 1
  });

  if (notifs && notifs.length > 0) {
    const announcement = notifs[0];

    // Create Banner
    const banner = document.createElement('div');
    banner.id = 'announcement-banner';
    banner.style = `
      position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
      width: 90%; max-width: 600px; background: linear-gradient(135deg, var(--warning), #d97706);
      color: white; padding: 16px 24px; border-radius: 12px; z-index: 9999;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 16px;
      transition: top 0.5s ease-in-out; border: 1px solid rgba(255,255,255,0.2);
    `;
    banner.innerHTML = `
      <i class="ph-fill ph-megaphone" style="font-size: 1.5rem;"></i>
      <div style="flex: 1;">
        <div style="font-weight: 800; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px; opacity: 0.9;">System Announcement</div>
        <div style="font-weight: 600; font-size: 0.95rem;">${announcement.message}</div>
      </div>
      <i class="ph-bold ph-x" style="cursor: pointer; opacity: 0.7;" onclick="this.parentElement.style.top = '-100px'"></i>
    `;
    document.body.appendChild(banner);

    // Loop: Show for 8s, Hide, Wait 2s (Total 10s cycle)
    const showCycle = () => {
      banner.style.top = '20px';
      setTimeout(() => {
        banner.style.top = '-100px';
      }, 8000);
    };

    showCycle();
    setInterval(showCycle, 10000);
  }
}
