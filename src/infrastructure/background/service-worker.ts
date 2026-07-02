import { CrawlScheduler } from './CrawlScheduler';
import { MessageRouter } from './MessageRouter';
import { EventBus } from '../messaging/EventBus';
import { PortManager } from '../messaging/PortManager';
import { ChromeStorageSessionRepository } from '../storage/ChromeStorageSessionRepository';
import { ChromeStorageLocalRepository } from '../storage/ChromeStorageLocalRepository';
import { InMemoryResourceRepository } from '../storage/InMemoryResourceRepository';
import { StartCrawlUseCase } from '../../application/use-cases/StartCrawlUseCase';
import { logger } from '../../shared/logger';
import { isTrustedSender } from '../../shared/security';

const eventBus = new EventBus();
const portManager = new PortManager();
const frontierRepo = new ChromeStorageSessionRepository();
const jobRepo = new ChromeStorageLocalRepository();
const resourceRepo = new InMemoryResourceRepository();
const scheduler = new CrawlScheduler(jobRepo, frontierRepo, resourceRepo, eventBus, portManager);
const messageRouter = new MessageRouter(scheduler);

// Subscribe EventBus → broadcast to all ports
eventBus.subscribe('URL_DISCOVERED', (ev) => portManager.broadcast(ev));
eventBus.subscribe('CRAWL_PROGRESS', (ev) => portManager.broadcast(ev));
eventBus.subscribe('CRAWL_COMPLETED', (ev) => portManager.broadcast(ev));
eventBus.subscribe('CRAWL_FAILED', (ev) => portManager.broadcast(ev));
eventBus.subscribe('CRAWL_PAUSED', (ev) => portManager.broadcast(ev));

chrome.runtime.onInstalled.addListener(async () => {
  logger.info('SW', 'Extension installed');
  chrome.alarms.create('crawl-heartbeat', { periodInMinutes: 1 });
  chrome.contextMenus.create({ id: 'scan-page', title: 'Scan this page', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'scan-site', title: 'Scan this site', contexts: ['page'] });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'crawl-heartbeat') return;
  await scheduler.rehydrate();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'get-status' && !isTrustedSender(sender)) {
    sendResponse({ error: 'Untrusted sender' });
    return false;
  }
  if (message.action === 'start-crawl' && message.config?.startUrl) {
    new StartCrawlUseCase(jobRepo, frontierRepo).execute({
      startUrl: message.config.startUrl,
      maxDepth: message.config.maxDepth ?? 3,
      domainScope: message.config.domainScope,
    }).then(async (result) => {
      await scheduler.setJobAndFrontier(result.job, result.frontier);
      await scheduler.processNextUrl();
      sendResponse({ success: true });
    }).catch(err => sendResponse({ error: String(err) }));
    return true;
  }
  messageRouter.route(message, sender).then(sendResponse);
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  portManager.register(port);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.url) return;
  const maxDepth = info.menuItemId === 'scan-page' ? 0 : 3;
  chrome.runtime.sendMessage({
    action: 'start-crawl',
    jobId: crypto.randomUUID(),
    config: { startUrl: tab.url, maxDepth, domainScope: 'SAME_ORIGIN' },
  });
});

logger.info('SW', 'Service worker initialized');
