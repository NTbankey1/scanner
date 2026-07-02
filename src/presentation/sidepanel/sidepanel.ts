// Side Panel — full crawl UI with dashboard, resource explorer, logs, dark mode

let currentJobId: string | null = null;
let discoveredResources: Array<{ id: string; url: string; type: string; depth: number; status: string }> = [];
let port: chrome.runtime.Port | null = null;
// Side Panel UI — relies on global chrome runtime and interval polling

// --- DOM refs ---
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
const filterDepth = $('filterDepth') as HTMLSelectElement;
const filterStatus = $('filterStatus') as HTMLSelectElement;
const resourceList = $('resourceList');
const logPanel = $('logPanel');
const themeToggle = $('themeToggle') as HTMLElement;
const exportButtons = document.querySelectorAll('[data-export]');

// --- Theme ---
function initTheme(): void {
  const saved = localStorage.getItem('dss-theme') || 'light';
  document.body.setAttribute('data-theme', saved);
  themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('dss-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
});

// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panelId = `panel-${(tab as HTMLElement).dataset.tab}`;
    $(panelId).classList.add('active');
  });
});

// --- Start URL from active tab ---
async function initUrl(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url && tabs[0].url.startsWith('http')) {
      urlInput.value = tabs[0].url;
    }
  } catch {}
}

// --- Poll status ---
async function pollStatus(): Promise<void> {
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'get-status' });
    if (resp?.job) {
      const j = resp.job;
      updateUI(j.state, j.stats || {}, j.id);
    } else {
      updateUI('IDLE', {});
    }
  } catch {}
}

function updateUI(state: string, stats: any, _jobId?: string): void {
  statState.textContent = state;
  statState.className = `status-badge badge-${state.toLowerCase()}`;
  statScanned.textContent = String(stats.urlsScanned || 0);
  statFound.textContent = String(stats.urlsFound || 0);
  statFailed.textContent = String(stats.urlsFailed || 0);

  const total = (stats.urlsScanned || 0) + (stats.urlsFound || 0);
  const pct = Math.min(100, Math.round((total / 2000) * 100));
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = state === 'RUNNING' ? 'Scanning...' : state === 'IDLE' ? 'Ready' : state;

  startBtn.disabled = state === 'RUNNING';
  stopBtn.disabled = state !== 'RUNNING' && state !== 'PAUSED';
}

// --- Logging ---
function addLog(message: string): void {
  const empty = logPanel.querySelector('.empty-state');
  if (empty) empty.remove();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function addResourcesToSidebar(resources: Array<{ url: string; type: string }>, _jobId: string): void {
  for (const r of resources) {
    discoveredResources.push({
      id: crypto.randomUUID(),
      url: r.url,
      type: r.type,
      depth: 0,
      status: 'DISCOVERED',
    });
  }
  renderResources();
}

// --- Resource rendering ---
function renderResources(): void {
  const query = searchInput.value.toLowerCase();
  const typeFilter = filterType.value;
  const depthFilter = filterDepth.value;
  const statusFilter = filterStatus.value;

  let filtered = discoveredResources;

  if (query) filtered = filtered.filter(r => r.url.toLowerCase().includes(query));
  if (typeFilter) filtered = filtered.filter(r => r.type === typeFilter);
  if (depthFilter) filtered = filtered.filter(r => r.depth === parseInt(depthFilter));
  if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter);

  if (filtered.length === 0) {
    resourceList.innerHTML = '<div class="empty-state"><p>No resources match your filters</p></div>';
    return;
  }

  resourceList.innerHTML = filtered.map(r => `
    <div class="resource-item">
      <span class="resource-type type-${r.type}">${r.type.slice(0, 4)}</span>
      <span class="resource-url" title="${r.url}">${r.url}</span>
    </div>
  `).join('');
}

searchInput.addEventListener('input', renderResources);
filterType.addEventListener('change', renderResources);
filterDepth.addEventListener('change', renderResources);
filterStatus.addEventListener('change', renderResources);

// --- Export ---
exportButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!currentJobId) return;
    const format = (btn as HTMLElement).dataset.export;
    addLog(`Exporting ${format}...`);
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'export-results',
        jobId: currentJobId,
        format,
      });
      if (resp?.success) {
        addLog(`Exported: ${resp.filename}`);
      } else {
        addLog(`Export failed: ${resp?.error || 'unknown'}`);
      }
    } catch (err) {
      addLog(`Export error: ${String(err)}`);
    }
  });
});

// --- Long-lived port ---
function connectPort(): void {
  try {
    port = chrome.runtime.connect({ name: 'sidepanel' });
    port.onMessage.addListener((event) => {
      if (event.type === 'URL_DISCOVERED') {
        const urls = event.payload?.found ? [{ url: event.payload.url, type: 'HTML' }] : [];
        if (urls.length > 0) addResourcesToSidebar(urls, event.jobId);
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connectPort, 2000);
    });
  } catch {}
}

// --- Start crawl ---
startBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url || !url.startsWith('http')) {
    addLog('Enter a valid URL starting with http:// or https://');
    return;
  }

  const jobId = crypto.randomUUID();
  currentJobId = jobId;
  discoveredResources = [];

  try {
    const resp = await chrome.runtime.sendMessage({
      action: 'start-crawl',
      jobId,
      config: { startUrl: url, maxDepth: 3, domainScope: 'SAME_ORIGIN' },
    });

    if (resp?.error) {
      addLog(`Error: ${resp.error}`);
      return;
    }

    addLog(`Started: ${url}`);
    updateUI('RUNNING', {});
  } catch (err) {
    addLog(`Error: ${String(err)}`);
  }
});

// --- Stop crawl ---
stopBtn.addEventListener('click', async () => {
  if (!currentJobId) return;
  try {
    await chrome.runtime.sendMessage({ action: 'cancel-crawl', jobId: currentJobId });
    addLog('Crawl stopped');
    startBtn.disabled = false;
    stopBtn.disabled = true;
  } catch (err) {
    addLog(`Error: ${String(err)}`);
  }
});

// --- Init ---
initTheme();
initUrl();
connectPort();
addLog('Side panel ready. Enter a URL to start scanning.');

// Poll for status updates
setInterval(pollStatus, 2000);
pollStatus();
export {};
