// TruthEngine Ultimate - Background Service Worker

const CONFIG = {
  API_URL: 'https://api.truthengine.ai/v1',
  CACHE_DURATION: 3600000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};

let userData = null;
let verificationCache = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[TruthEngine] Extension installed');
  await initializeUser();
  setupAlarms();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'VERIFY_TEXT':
      handleVerification(message.text, message.options)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    case 'GET_USER_DATA':
      sendResponse({ success: true, data: userData });
      return true;
    case 'OPEN_OPTIONS':
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return true;
    case 'CLEAR_CACHE':
      verificationCache.clear();
      sendResponse({ success: true });
      return true;
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

async function initializeUser() {
  const stored = await chrome.storage.local.get(['userId', 'apiKey', 'preferences']);
  if (!stored.userId) {
    userData = {
      userId: crypto.randomUUID(),
      createdAt: Date.now(),
      preferences: { autoVerify: true, highlightColors: true, showSources: true, theme: 'light' }
    };
    await chrome.storage.local.set({ userId: userData.userId, preferences: userData.preferences });
  } else {
    userData = { userId: stored.userId, apiKey: stored.apiKey, preferences: stored.preferences || {} };
  }
}

function setupAlarms() {
  chrome.alarms.create('clearCache', { periodInMinutes: 60 });
  chrome.alarms.create('syncUsage', { periodInMinutes: 1440 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'clearCache') { verificationCache.clear(); console.log('[TruthEngine] Cache cleared'); }
    else if (alarm.name === 'syncUsage') await syncUsageData();
  });
}

async function handleVerification(text, options = {}) {
  const cacheKey = `${text.substring(0, 200)}:${options.engine_mode || 'standard'}`;
  if (verificationCache.has(cacheKey)) {
    const cached = verificationCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) return cached.result;
  }
  
  let lastError = null;
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${CONFIG.API_URL}/verify/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userData.userId, 'X-API-Key': userData.apiKey || '' },
        body: JSON.stringify({ text, engine_mode: options.engine_mode || 'standard', threshold: 0.75, include_sources: true })
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error?.message || `HTTP ${response.status}`); }
      const result = await response.json();
      verificationCache.set(cacheKey, { result: result.data, timestamp: Date.now() });
      await updateUsageStats(result.data.credits_used || 0);
      if (result.data.summary?.risk_level === 'HIGH' || result.data.summary?.risk_level === 'CRITICAL') {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'TruthEngine Alert', message: `High risk content detected! ${result.data.summary.false_count} false claims.`, priority: 2 });
      }
      return result.data;
    } catch (error) { lastError = error; if (attempt < CONFIG.MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt)); }
  }
  throw lastError || new Error('Verification failed');
}

async function updateUsageStats(creditsUsed) {
  const stats = await chrome.storage.local.get(['totalVerifications', 'totalCreditsUsed']);
  await chrome.storage.local.set({ totalVerifications: (stats.totalVerifications || 0) + 1, totalCreditsUsed: (stats.totalCreditsUsed || 0) + creditsUsed, lastUsed: Date.now() });
}

async function syncUsageData() {
  if (!userData.userId) return;
  const stats = await chrome.storage.local.get(['totalVerifications', 'totalCreditsUsed']);
  try { await fetch(`${CONFIG.API_URL}/stats/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': userData.userId }, body: JSON.stringify({ verifications: stats.totalVerifications || 0, credits: stats.totalCreditsUsed || 0, period: 'daily' }) }); } 
  catch (error) { console.error('[TruthEngine] Failed to sync usage:', error); }
}
