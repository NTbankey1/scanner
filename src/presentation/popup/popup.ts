const urlInput = document.getElementById('urlInput') as HTMLInputElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
const depthSelect = document.getElementById('depthSelect') as HTMLSelectElement;
const scopeSelect = document.getElementById('scopeSelect') as HTMLSelectElement;
const stateDisplay = document.getElementById('stateDisplay')!;
const scannedDisplay = document.getElementById('scannedDisplay')!;
const foundDisplay = document.getElementById('foundDisplay')!;
const failedDisplay = document.getElementById('failedDisplay')!;
const progressFill = document.getElementById('progressFill') as HTMLElement;
const logPanel = document.getElementById('logPanel')!;

let currentJobId: string | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let port: chrome.runtime.Port | null = null;

// Get current tab URL on open
async function initUrl(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url) {
    urlInput.value = tabs[0].url;
  }
}

function addLog(message: string): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function updateStatus(state: string, scanned: number, found: number, failed: number): void {
  stateDisplay.textContent = state;
  stateDisplay.className = `badge badge-${state.toLowerCase()}`;
  scannedDisplay.textContent = String(scanned);
  foundDisplay.textContent = String(found);
  failedDisplay.textContent = String(failed);

  // Estimate progress (assume max 1000 URLs for bar)
  const total = scanned + found;
  const pct = Math.min(100, (total / 1000) * 100);
  progressFill.style.width = `${pct}%`;

  if (state === 'RUNNING') {
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else if (state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED') {
    startBtn.disabled = false;
    stopBtn.disabled = true;
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

async function pollStatus(): Promise<void> {
  const resp = await chrome.runtime.sendMessage({ action: 'get-status' });
  if (resp?.job) {
    const j = resp.job;
    currentJobId = j.id;
    updateStatus(j.state, j.stats?.urlsScanned || 0, j.stats?.urlsFound || 0, j.stats?.urlsFailed || 0);
  } else {
    updateStatus('Idle', 0, 0, 0);
  }
}

// Start crawl
startBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    addLog('Invalid URL — must start with http:// or https://');
    return;
  }

  const jobId = crypto.randomUUID();
  currentJobId = jobId;

  try {
    const resp = await chrome.runtime.sendMessage({
      action: 'start-crawl',
      jobId,
      config: {
        startUrl: url,
        maxDepth: parseInt(depthSelect.value),
        domainScope: scopeSelect.value,
      },
    });

    if (resp?.error) {
      addLog(`Error: ${resp.error}`);
      return;
    }

    addLog(`Started crawl: ${url}`);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    updateStatus('RUNNING', 0, 0, 0);
  } catch (err) {
    addLog(`Error: ${String(err)}`);
  }
});

// Stop crawl
stopBtn.addEventListener('click', async () => {
  if (!currentJobId) return;
  try {
    await chrome.runtime.sendMessage({ action: 'cancel-crawl', jobId: currentJobId });
    addLog('Crawl stopped');
    startBtn.disabled = false;
    stopBtn.disabled = true;
  } catch (err) {
    addLog(`Error stopping: ${String(err)}`);
  }
});

// Listen for real-time events via long-lived port
function connectPort(): void {
  port = chrome.runtime.connect({ name: 'popup' });
  port.onMessage.addListener((event) => {
    if (event.type === 'CRAWL_PROGRESS' || event.type === 'URL_DISCOVERED') {
      const scanned = event.payload?.scanned || 0;
      const found = event.payload?.found || 0;
      updateStatus('RUNNING', scanned, found, 0);
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connectPort, 1000);
  });
}

// Poll for status updates when no port
_pollInterval = setInterval(pollStatus, 2000);

initUrl();
connectPort();
addLog('Ready. Enter a URL to start scanning.');
