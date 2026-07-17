// ── ADMIN APP LOGIC ──
import { requireAdminAuth, logout } from './auth.js';
import { dbSelect, subscribeToTable } from './firebase.js';
import { formatCurrency, formatDate, initSidebar } from './utils.js';

let currentAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentAdmin = await requireAdminAuth(['super_admin', 'admin', 'support']);
  if (!currentAdmin) return;

  initAdminUI();
  await loadDashboardStats();
  await loadActivityFeed();
  initVolumeChart();
});

function initAdminUI() {
  document.getElementById('admin-name').textContent = currentAdmin.full_name;
  document.getElementById('admin-role').textContent = currentAdmin.role;
  document.getElementById('admin-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAdmin.full_name)}&background=ef4444&color=fff`;

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.stopPropagation(); logout(true);
  });
}

async function loadDashboardStats() {
  // Stats fetching simulated for speed, in reality uses dbSelect count endpoints
  const { data: users } = await dbSelect('users');
  const { data: transfers } = await dbSelect('transfers', { eq: { status: 'pending' } });
  const { data: kyc } = await dbSelect('kyc_documents', { eq: { status: 'pending' } });
  const { data: balances } = await dbSelect('balances');

  let totalBal = 0;
  if (balances) balances.forEach(b => totalBal += Number(b.available));

  const uCount = users ? users.length : 0;
  const tCount = transfers ? transfers.length : 0;
  const kCount = kyc ? kyc.length : 0;

  document.getElementById('stat-total-users').textContent = uCount;
  document.getElementById('stat-pending-transfers').textContent = tCount;
  document.getElementById('stat-pending-kyc').textContent = kCount;
  document.getElementById('stat-total-balance').textContent = formatCurrency(totalBal);
  
  if (document.getElementById('pending-transfer-count')) document.getElementById('pending-transfer-count').textContent = tCount;
  if (document.getElementById('pending-kyc-count')) document.getElementById('pending-kyc-count').textContent = kCount;

  // Realtime
  subscribeToTable('transfers', () => loadDashboardStats());
}

async function loadActivityFeed() {
  const { data: logs } = await dbSelect('admin_logs', { order: { column: 'timestamp', ascending: false }, limit: 5 });
  const feed = document.getElementById('audit-feed');
  if (!feed) return;
  feed.innerHTML = '';

  if (!logs || logs.length === 0) {
    feed.innerHTML = `<div class="text-center text-muted text-sm py-16">No recent activity</div>`;
    return;
  }

  logs.forEach((log, index) => {
    const isLast = index === logs.length - 1;
    let dotClass = 'info';
    if (log.action.includes('approve')) dotClass = 'create';
    if (log.action.includes('reject')) dotClass = 'delete';
    if (log.action.includes('update')) dotClass = 'update';

    feed.innerHTML += `
      <div class="audit-item">
        <div class="audit-dot-col">
          <div class="audit-dot ${dotClass}"></div>
          ${!isLast ? '<div class="audit-line"></div>' : ''}
        </div>
        <div class="audit-content">
          <div class="audit-action">${log.action} on ${log.entity_type}</div>
          <div class="audit-meta">
            <span><i class="ph-bold ph-clock"></i> ${formatDate(log.timestamp)}</span>
            <span class="audit-ip">${log.ip_address || '127.0.0.1'}</span>
          </div>
        </div>
      </div>
    `;
  });
}

function initVolumeChart() {
  const ctx = document.getElementById('volumeChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['6 days ago', '5 days ago', '4 days ago', '3 days ago', '2 days ago', 'Yesterday', 'Today'],
      datasets: [{
        label: 'Transfer Volume ($)',
        data: [15000, 22000, 18000, 31000, 28000, 42000, 19000],
        backgroundColor: 'rgba(26,86,219,0.8)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
      }
    }
  });
}
