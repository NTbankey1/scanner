import { logger } from '../../shared/logger';
import { DomScanner } from './DomScanner';
import { SpaDetector } from './SpaDetector';
import { NetworkInterceptor } from './NetworkInterceptor';
import { BATCH_SIZE } from '../../shared/constants';

const EXTENSION_ID = chrome.runtime.id;
let currentJobId: string | null = null;
let scanner: DomScanner | null = null;
let spaDetector: SpaDetector | null = null;
let netInterceptor: NetworkInterceptor | null = null;

function sendResources(jobId: string, resources: Array<{ url: string; type: string }>): void {
  for (let i = 0; i < resources.length; i += BATCH_SIZE) {
    const chunk = resources.slice(i, i + BATCH_SIZE);
    chrome.runtime.sendMessage(EXTENSION_ID, {
      action: 'resources-discovered',
      jobId,
      resources: chunk,
    });
  }
}

function sendNetworkRequests(jobId: string, requests: Array<{ url: string; method: string; type: string }>): void {
  const resources = requests.map(r => ({ url: r.url, type: r.type }));
  sendResources(jobId, resources);
}

function signalScanComplete(jobId: string): void {
  chrome.runtime.sendMessage(EXTENSION_ID, {
    action: 'scan-complete',
    jobId,
    url: location.href,
  });
}

function startScan(jobId: string): void {
  currentJobId = jobId;
  logger.debug('ContentScript', `Starting scan for job ${jobId} on ${location.href}`);

  // Create utilities if not yet created
  if (!scanner) {
    scanner = new DomScanner((batch) => {
      if (currentJobId) sendResources(currentJobId, batch);
    });
  }
  if (!spaDetector) {
    spaDetector = new SpaDetector(location.href);
    spaDetector.onRouteChange((newUrl) => {
      logger.debug('ContentScript', `SPA route change: ${newUrl}`);
      if (!currentJobId) return;
      setTimeout(() => {
        const batch = scanner!.scanDocument();
        if (batch.length > 0) sendResources(currentJobId!, batch);
        signalScanComplete(currentJobId!);
      }, 1000);
    });
  }
  if (!netInterceptor) {
    netInterceptor = new NetworkInterceptor();
    netInterceptor.onRequest((requests) => {
      if (currentJobId) sendNetworkRequests(currentJobId, requests);
    });
  }

  netInterceptor.activate();
  spaDetector.activate();

  // Scan current page
  function performScan(): void {
    if (!currentJobId) return;
    const batch = scanner!.scanDocument();
    if (batch.length > 0) sendResources(currentJobId, batch);
    signalScanComplete(currentJobId);
  }

  if (document.readyState === 'complete') {
    setTimeout(performScan, 500);
  } else {
    window.addEventListener('load', () => setTimeout(performScan, 500));
  }
}

// Listen for commands from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'start-scan') {
    startScan(message.jobId);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === 'stop-scan') {
    currentJobId = null;
    if (spaDetector) spaDetector.deactivate();
    if (netInterceptor) netInterceptor.deactivate();
    sendResponse({ success: true });
    return true;
  }
});

// Auto-start from URL param (injected via scripting API)
const params = new URLSearchParams(location.search);
const autoJobId = params.get('dssJobId');
if (autoJobId) {
  startScan(autoJobId);
}

logger.debug('ContentScript', 'Ready (message-driven mode)');
