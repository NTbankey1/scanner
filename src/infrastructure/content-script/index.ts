import { logger } from '../../shared/logger';
import { DomScanner } from './DomScanner';
import { BATCH_SIZE } from '../../shared/constants';

const EXTENSION_ID = chrome.runtime.id;

function sendResources(jobId: string, resources: Array<{ url: string; type: string }>): void {
  chrome.runtime.sendMessage(EXTENSION_ID, {
    action: 'resources-discovered',
    jobId,
    resources,
  });
}

function init(): void {
  const params = new URLSearchParams(location.search);
  const jobId = params.get('jobId') || '';
  if (!jobId) {
    logger.debug('ContentScript', 'No jobId in URL, skipping scan');
    return;
  }

  logger.debug('ContentScript', `Initialized for job ${jobId}`);

  const scanner = new DomScanner(
    (batch) => sendResources(jobId, batch),
  );

  // Wait for document idle, then scan
  if (document.readyState === 'complete') {
    scanAndReport();
  } else {
    window.addEventListener('load', () => {
      setTimeout(scanAndReport, 500);
    });
  }

  function scanAndReport(): void {
    const batch = scanner.scanDocument();
    // Send even small batches — background batches on its side
    if (batch.length > 0) {
      // Split into chunks to avoid message size limits
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const chunk = batch.slice(i, i + BATCH_SIZE);
        sendResources(jobId, chunk);
      }
    }
    // Signal that initial scan is done
    chrome.runtime.sendMessage(EXTENSION_ID, {
      action: 'scan-complete',
      jobId,
      url: location.href,
    });
  }
}

init();
