document.addEventListener('DOMContentLoaded', async () => {
  await loadUserData(); await loadStats(); checkApiStatus();
});

async function loadUserData() {
  const storage = await chrome.storage.local.get(['userId', 'totalVerifications']);
  if (storage.userId) { document.getElementById('userId').textContent = `ID: ${storage.userId.substring(0, 8)}...`; document.getElementById('totalVerified').textContent = storage.totalVerifications || 0; }
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_REMAINING_CREDITS' });
    document.getElementById('creditsRemaining').textContent = response?.credits || '100';
  } catch { document.getElementById('creditsRemaining').textContent = '—'; }
}

async function loadStats() {
  const storage = await chrome.storage.local.get(['dailyStats']);
  const dailyStats = storage.dailyStats || {};
  document.getElementById('todayCount').textContent = dailyStats[new Date().toDateString()] || 0;
}

async function checkApiStatus() {
  try { const response = await fetch('https://api.truthengine.ai/v1/health'); if (response.ok) { document.getElementById('status').className = 'status online'; document.getElementById('status').innerHTML = '<span>✅ System Online</span>'; } else throw new Error(); } 
  catch { document.getElementById('status').className = 'status offline'; document.getElementById('status').innerHTML = '<span>⚠️ Offline - Check Connection</span>'; }
}

document.getElementById('verifyPageBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com') || tab.url.includes('claude.ai') || tab.url.includes('gemini.google.com')) {
    const btn = document.getElementById('verifyPageBtn'); btn.innerHTML = '⏳ Processing... <span class="loading"></span>'; btn.disabled = true;
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_VERIFICATION' }, () => { btn.innerHTML = '🔍 Verify Current Page'; btn.disabled = false; if (chrome.runtime.lastError) showToast('Please refresh the page'); else showToast('Verification started!'); });
  } else showToast('Please navigate to ChatGPT, Claude, or Gemini first');
});

document.getElementById('openDashboardBtn').addEventListener('click', () => chrome.tabs.create({ url: 'https://truthengine.ai/dashboard' }));
document.getElementById('upgradeBtn').addEventListener('click', () => chrome.tabs.create({ url: 'https://truthengine.ai/pricing' }));

function showToast(message) {
  const toast = document.createElement('div'); toast.textContent = message; toast.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:rgba(0,0,0,0.8);color:white;padding:10px;border-radius:8px;text-align:center;font-size:12px;z-index:1000;animation:fadeIn 0.3s ease'; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000);
}
