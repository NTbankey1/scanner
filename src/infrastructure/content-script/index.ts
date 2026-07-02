import { logger } from '../../shared/logger';
import { DomScanner } from './DomScanner';
import { SpaDetector } from './SpaDetector';
import { NetworkInterceptor } from './NetworkInterceptor';
import { BATCH_SIZE } from '../../shared/constants';

const EXTENSION_ID = chrome.runtime.id;

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

function init(): void {
  const params = new URLSearchParams(location.search);
  const jobId = params.get('jobId') || '';
  if (!jobId) {
    logger.debug('ContentScript', 'No jobId, skipping');
    return;
  }

  logger.debug('ContentScript', `Initialized for job ${jobId} on ${location.href}`);

  // Create utility instances
  const scanner = new DomScanner((batch) => sendResources(jobId, batch));
  const spaDetector = new SpaDetector(location.href);
  const netInterceptor = new NetworkInterceptor();

  // Re-scan on SPA route changes
  spaDetector.onRouteChange((newUrl) => {
    logger.debug('ContentScript', `SPA route change: ${newUrl}`);
    // Wait for the SPA to render, then scan
    setTimeout(() => {
      const batch = scanner.scanDocument();
      if (batch.length > 0) sendResources(jobId, batch);
      signalScanComplete(jobId);
    }, 1000);
  });

  // Capture network requests as resources
  netInterceptor.onRequest((requests) => {
    sendNetworkRequests(jobId, requests);
  });

  // Activate monitoring
  netInterceptor.activate();
  spaDetector.activate();

  // Initial scan
  function performInitialScan(): void {
    const batch = scanner.scanDocument();
    if (batch.length > 0) sendResources(jobId, batch);
    signalScanComplete(jobId);
  }

  if (document.readyState === 'complete') {
    setTimeout(performInitialScan, 500);
  } else {
    window.addEventListener('load', () => {
      setTimeout(performInitialScan, 500);
    });
  }
}

init();
