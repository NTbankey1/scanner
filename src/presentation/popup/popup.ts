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
let port: chrome.runtime.Port | null = null;

function addLog(msg: string): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span>${msg}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function updateStatus(state: string, scanned = 0, found = 0, failed = 0): void {
  stateDisplay.textContent = state;
  stateDisplay.className = `badge badge-${state.toLowerCase()}`;
  scannedDisplay.textContent = String(scanned);
  foundDisplay.textContent = String(found);
  failedDisplay.textContent = String(failed);
  const pct = Math.min(100, ((scanned + found) / 2000) * 100);
  progressFill.style.width = `${pct}%`;
  startBtn.disabled = state === 'RUNNING';
  stopBtn.disabled = state !== 'RUNNING';
}

function connectPort(): void {
  port = chrome.runtime.connect({ name: 'popup' });
  port.onMessage.addListener((event) => {
    if (event.type === 'CRAWL_PROGRESS' || event.type === 'URL_DISCOVERED') {
      const p = event.payload || {};
      updateStatus('RUNNING', p.scanned || 0, p.found || 0);
    }
    if (event.type === 'CRAWL_COMPLETED') { updateStatus('COMPLETED'); addLog('Crawl completed!'); }
    if (event.type === 'CRAWL_FAILED') { updateStatus('FAILED'); addLog('Crawl stopped.'); }
  });
  port.onDisconnect.addListener(() => { port = null; setTimeout(connectPort, 1000); });
}

// Init
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.startsWith('http')) urlInput.value = tab.url;
  connectPort();
  addLog('Ready.');
})();

startBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url?.startsWith('http')) { addLog('Enter a valid URL starting with http://'); return; }

  const jobId = crypto.randomUUID();
  currentJobId = jobId;
  const resp = await chrome.runtime.sendMessage({
    action: 'start-crawl', jobId,
    config: { startUrl: url, maxDepth: parseInt(depthSelect.value), domainScope: scopeSelect.value },
  });
  if (resp?.error) { addLog(`Error: ${resp.error}`); return; }
  addLog(`Started: ${url}`);
  updateStatus('RUNNING');
});

stopBtn.addEventListener('click', async () => {
  if (!currentJobId) return;
  await chrome.runtime.sendMessage({ action: 'cancel-crawl', jobId: currentJobId });
  addLog('Stopped.');
  updateStatus('CANCELLED');
});

export {};
