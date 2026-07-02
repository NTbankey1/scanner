let currentJobId: string | null = null;
let discoveredResources: Array<{ id: string; url: string; type: string; depth: number; status: string }> = [];
let port: chrome.runtime.Port | null = null;

const $ = (id: string) => document.getElementById(id)!;
const urlInput = $('urlInput') as HTMLInputElement;
const startBtn = $('startBtn') as HTMLButtonElement;
const stopBtn = $('stopBtn') as HTMLButtonElement;
const statState = $('statState');
const statScanned = $('statScanned');
const statFound = $('statFound');
const statFailed = $('statFailed');
const progressFill = $('progressFill') as HTMLElement;
const progressLabel = $('progressLabel');
const searchInput = $('searchInput') as HTMLInputElement;
const filterType = $('filterType') as HTMLSelectElement;
const resourceList = $('resourceList');
const logPanel = $('logPanel');
const themeToggle = $('themeToggle') as HTMLElement;

function initTheme(): void {
  const saved = localStorage.getItem('dss-theme') || 'light';
  document.body.setAttribute('data-theme', saved);
  themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('dss-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`panel-${(tab as HTMLElement).dataset.tab}`).classList.add('active');
  });
});

function updateUI(state: string, stats: any): void {
  statState.textContent = state;
  statState.className = `status-badge badge-${state.toLowerCase()}`;
  statScanned.textContent = String(stats.urlsScanned || 0);
  statFound.textContent = String(stats.urlsFound || 0);
  statFailed.textContent = String(stats.urlsFailed || 0);
  const total = (stats.urlsScanned || 0) + (stats.urlsFound || 0);
  progressFill.style.width = `${Math.min(100, Math.round((total / 2000) * 100))}%`;
  progressLabel.textContent = state === 'RUNNING' ? `Scanning... ${stats.currentUrl || ''}` : state;
  startBtn.disabled = state === 'RUNNING';
  stopBtn.disabled = state !== 'RUNNING';
}

function addLog(msg: string): void {
  const empty = logPanel.querySelector('.empty-state');
  if (empty) empty.remove();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span>${msg}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function addResources(resources: Array<{ url: string; type: string }>): void {
  for (const r of resources) {
    discoveredResources.push({ id: crypto.randomUUID(), url: r.url, type: r.type, depth: 0, status: 'DISCOVERED' });
  }
  renderResources();
}

function renderResources(): void {
  const query = searchInput.value.toLowerCase();
  const typeFilter = filterType.value;
  let filtered = discoveredResources;
  if (query) filtered = filtered.filter(r => r.url.toLowerCase().includes(query));
  if (typeFilter) filtered = filtered.filter(r => r.type === typeFilter);
  resourceList.innerHTML = filtered.length === 0
    ? '<div class="empty-state"><p>No resources</p></div>'
    : filtered.map(r => `<div class="resource-item"><span class="resource-type type-${r.type}">${r.type.slice(0,4)}</span><span class="resource-url" title="${r.url}">${r.url}</span></div>`).join('');
}

searchInput.addEventListener('input', renderResources);
filterType.addEventListener('change', renderResources);

function connectPort(): void {
  try {
    port = chrome.runtime.connect({ name: 'sidepanel' });
    port.onMessage.addListener((event) => {
      if (event.type === 'CRAWL_PROGRESS') {
        updateUI('RUNNING', event.payload);
      }
      if (event.type === 'URL_DISCOVERED') {
        const urls = event.payload?.url ? [{ url: event.payload.url, type: 'HTML' }] : [];
        addResources(urls);
      }
      if (event.type === 'CRAWL_COMPLETED') { updateUI('COMPLETED', event.payload); addLog('Done!'); }
      if (event.type === 'CRAWL_FAILED') { updateUI('FAILED', event.payload); addLog('Failed.'); }
    });
    port.onDisconnect.addListener(() => { port = null; setTimeout(connectPort, 2000); });
  } catch {}
}

// Init
initTheme();
connectPort();
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.startsWith('http')) urlInput.value = tab.url;
})();
addLog('Ready.');

startBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url?.startsWith('http')) { addLog('Invalid URL'); return; }
  currentJobId = crypto.randomUUID();
  discoveredResources = [];
  const resp = await chrome.runtime.sendMessage({
    action: 'start-crawl', jobId: currentJobId,
    config: { startUrl: url, maxDepth: 3, domainScope: 'SAME_ORIGIN' },
  });
  if (resp?.error) { addLog(`Error: ${resp.error}`); return; }
  addLog(`Started: ${url}`);
  updateUI('RUNNING', {});
});

stopBtn.addEventListener('click', async () => {
  if (!currentJobId) return;
  await chrome.runtime.sendMessage({ action: 'cancel-crawl', jobId: currentJobId });
});

export {};
