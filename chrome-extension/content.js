// TruthEngine Ultimate - Content Script

const CONFIG = { OBSERVE_INTERVAL: 1500, DEBOUNCE_DELAY: 500, MIN_TEXT_LENGTH: 20 };
let observer = null, processingElements = new Set();

function init() { console.log('[TruthEngine] Content script initialized'); injectStyles(); observeDOM(); processExistingMessages(); }

function injectStyles() {
  const styles = `
    @keyframes truthEngineFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .truth-engine-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; animation: truthEngineFadeIn 0.3s ease; margin-left: 8px; }
    .truth-engine-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.4); }
    .truth-engine-btn.loading { opacity: 0.7; cursor: wait; pointer-events: none; }
    .truth-engine-btn.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .truth-engine-btn.error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .truth-engine-icon { width: 16px; height: 16px; }
    .truth-engine-highlight { display: inline; padding: 2px 4px; margin: 0 2px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; position: relative; }
    .truth-engine-highlight:hover { filter: brightness(0.95); transform: translateY(-1px); }
    .truth-engine-verified { background-color: rgba(16,185,129,0.15); border-bottom: 2px solid rgba(16,185,129,0.6); }
    .truth-engine-suspicious { background-color: rgba(245,158,11,0.15); border-bottom: 2px solid rgba(245,158,11,0.6); }
    .truth-engine-false { background-color: rgba(239,68,68,0.15); border-bottom: 2px solid rgba(239,68,68,0.6); }
    .truth-engine-tooltip { position: absolute; background: #1f2937; color: white; padding: 8px 12px; border-radius: 8px; font-size: 12px; z-index: 10001; max-width: 300px; white-space: normal; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .truth-engine-notification { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; z-index: 10000; animation: truthEngineFadeIn 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .truth-engine-notification.success { background: #10b981; color: white; }
    .truth-engine-notification.error { background: #ef4444; color: white; }
    .truth-engine-notification.warning { background: #f59e0b; color: white; }
    .truth-engine-score-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 8px; }
    .truth-engine-score-high { background: rgba(16,185,129,0.2); color: #10b981; }
    .truth-engine-score-medium { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .truth-engine-score-low { background: rgba(239,68,68,0.2); color: #ef4444; }
  `;
  const styleSheet = document.createElement('style'); styleSheet.textContent = styles; document.head.appendChild(styleSheet);
}

function observeDOM() {
  observer = new MutationObserver(() => processNewMessages());
  observer.observe(document.body, { childList: true, subtree: true });
  processNewMessages();
}

function processExistingMessages() { document.querySelectorAll('[data-message-author-role="assistant"], .markdown.prose, .claude-message, .gemini-response').forEach(msg => { if (!msg.hasAttribute('data-truth-engine-processed')) processMessage(msg); }); }
function processNewMessages() { processExistingMessages(); }

function processMessage(messageElement) {
  if (messageElement.querySelector('.truth-engine-btn')) return;
  const textContainer = findTextContainer(messageElement);
  if (!textContainer) return;
  const text = extractText(textContainer);
  if (!text || text.length < CONFIG.MIN_TEXT_LENGTH) return;
  const button = createVerifyButton();
  const buttonContainer = document.createElement('div'); buttonContainer.className = 'truth-engine-button-container'; buttonContainer.style.display = 'inline-flex'; buttonContainer.style.alignItems = 'center';
  buttonContainer.appendChild(button);
  const actionBar = findActionBar(messageElement);
  if (actionBar) actionBar.appendChild(buttonContainer); else messageElement.appendChild(buttonContainer);
  button.addEventListener('click', async () => await handleVerification(textContainer, text, button));
  messageElement.setAttribute('data-truth-engine-processed', 'true');
}

function findTextContainer(messageElement) {
  const selectors = ['.markdown', '.prose', '.whitespace-pre-wrap', '.message-content', '.text-token-text-primary'];
  for (const selector of selectors) { const container = messageElement.querySelector(selector); if (container && container.innerText.trim().length > 0) return container; }
  return messageElement.innerText?.trim().length > 0 ? messageElement : null;
}

function extractText(container) {
  const clone = container.cloneNode(true);
  clone.querySelectorAll('.truth-engine-highlight').forEach(h => { const textNode = document.createTextNode(h.textContent); h.parentNode.replaceChild(textNode, h); });
  return clone.innerText.trim();
}

function findActionBar(messageElement) {
  const selectors = ['.flex.justify-between', '.mt-2.flex', '.gap-1', '.items-center.gap-2', '.flex.flex-row.gap-1'];
  for (const selector of selectors) { const bar = messageElement.querySelector(selector); if (bar && bar.children.length > 0) return bar; }
  return null;
}

function createVerifyButton() {
  const btn = document.createElement('button'); btn.className = 'truth-engine-btn';
  btn.innerHTML = `<svg class="truth-engine-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.306 0 3 3 0 00-3.75 3.75 3 3 0 000 5.306 3 3 0 003.75 3.751 3 3 0 005.306 0 3 3 0 003.75-3.75zM10 12a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg><span>Verify Truth</span>`;
  return btn;
}

async function handleVerification(container, text, button) {
  if (processingElements.has(container)) { showNotification('Verification already in progress...', 'info'); return; }
  processingElements.add(container);
  setButtonLoading(button, true);
  const originalContent = button.innerHTML;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'VERIFY_TEXT', text, options: { engine_mode: 'standard', threshold: 0.75 } });
    if (!response.success) throw new Error(response.error);
    const result = response.data;
    updateUIWithResults(container, result, button);
    setButtonSuccess(button, result.overall_score);
    if (result.overall_score < 60) showNotification(`Low truth score: ${Math.round(result.overall_score)}% - Content may contain misinformation`, 'warning');
  } catch (error) {
    console.error('[TruthEngine] Verification failed:', error);
    setButtonError(button);
    if (error.message.includes('401') || error.message.includes('403')) showNotification('Please sign in to continue using TruthEngine', 'error');
    else if (error.message.includes('429')) showNotification('Rate limit exceeded. Please wait a moment.', 'warning');
    else showNotification('Verification failed. Please try again.', 'error');
    setTimeout(() => { button.innerHTML = originalContent; setButtonLoading(button, false); }, 3000);
  } finally { processingElements.delete(container); }
}

function updateUIWithResults(container, result, button) {
  if (!result.claims?.length) { showNotification('No verifiable claims found.', 'info'); return; }
  const originalText = container.innerText;
  let highlightedHtml = '', lastIndex = 0;
  const sortedClaims = [...result.claims].sort((a,b) => originalText.indexOf(a.claim) - originalText.indexOf(b.claim));
  for (const claim of sortedClaims) {
    const index = originalText.indexOf(claim.claim, lastIndex);
    if (index !== -1) {
      if (index > lastIndex) highlightedHtml += escapeHtml(originalText.substring(lastIndex, index));
      const colorClass = claim.color === 'green' ? 'truth-engine-verified' : claim.color === 'yellow' ? 'truth-engine-suspicious' : 'truth-engine-false';
      const tooltip = `Confidence: ${Math.round(claim.confidence*100)}%\n${claim.verdict === 'TRUE' ? '✓ Verified' : claim.verdict === 'SUSPICIOUS' ? '⚠️ Suspicious' : '✗ Potentially false'}\nClick to view source`;
      highlightedHtml += `<span class="truth-engine-highlight ${colorClass}" data-tooltip="${escapeHtml(tooltip)}" data-url="${claim.sources?.[0]?.url || ''}" data-confidence="${claim.confidence}">${escapeHtml(claim.claim)}</span>`;
      lastIndex = index + claim.claim.length;
    }
  }
  if (lastIndex < originalText.length) highlightedHtml += escapeHtml(originalText.substring(lastIndex));
  container.innerHTML = highlightedHtml;
  container.querySelectorAll('.truth-engine-highlight').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); const url = el.getAttribute('data-url'); if (url && url !== '#') window.open(url, '_blank'); else showTooltip(el, el.getAttribute('data-tooltip') || 'No source available'); });
  });
  addScoreBadge(button, result.overall_score);
}

function addScoreBadge(button, score) {
  const existingBadge = button.parentElement.querySelector('.truth-engine-score-badge');
  if (existingBadge) existingBadge.remove();
  const badge = document.createElement('span'); badge.className = 'truth-engine-score-badge';
  const roundedScore = Math.round(score);
  badge.classList.add(roundedScore >= 70 ? 'truth-engine-score-high' : roundedScore >= 40 ? 'truth-engine-score-medium' : 'truth-engine-score-low');
  badge.innerHTML = `📊 ${roundedScore}%`;
  button.parentElement.appendChild(badge);
  setTimeout(() => badge.remove(), 5000);
}

function setButtonLoading(btn, isLoading) { if (isLoading) { btn.classList.add('loading'); btn.disabled = true; btn.querySelector('span').textContent = 'Analyzing...'; } else { btn.classList.remove('loading'); btn.disabled = false; btn.querySelector('span').textContent = 'Verify Truth'; } }
function setButtonSuccess(btn, score) { btn.classList.add('success'); btn.querySelector('span').textContent = `Score: ${Math.round(score)}%`; setTimeout(() => { btn.classList.remove('success'); btn.querySelector('span').textContent = 'Verify Truth'; }, 3000); }
function setButtonError(btn) { btn.classList.add('error'); btn.querySelector('span').textContent = 'Retry'; setTimeout(() => { btn.classList.remove('error'); btn.querySelector('span').textContent = 'Verify Truth'; }, 3000); }
function showNotification(message, type) { const n = document.createElement('div'); n.className = `truth-engine-notification ${type}`; n.textContent = message; document.body.appendChild(n); setTimeout(() => n.remove(), 4000); }
function showTooltip(element, text) { const tooltip = document.createElement('div'); tooltip.className = 'truth-engine-tooltip'; tooltip.textContent = text; const rect = element.getBoundingClientRect(); tooltip.style.left = `${rect.left + window.scrollX}px`; tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`; document.body.appendChild(tooltip); setTimeout(() => tooltip.remove(), 3000); }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
