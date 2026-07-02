import { CrawlScheduler } from './CrawlScheduler';
import { MessageRouter } from './MessageRouter';
import { EventBus } from '../messaging/EventBus';
import { PortManager } from '../messaging/PortManager';
import { ChromeStorageSessionRepository } from '../storage/ChromeStorageSessionRepository';
import { ChromeStorageLocalRepository } from '../storage/ChromeStorageLocalRepository';
import { logger } from '../../shared/logger';
import { HEARTBEAT_INTERVAL_MS } from '../../shared/constants';

const eventBus = new EventBus();
const portManager = new PortManager();
const frontierRepo = new ChromeStorageSessionRepository();
const jobRepo = new ChromeStorageLocalRepository();
const scheduler = new CrawlScheduler(jobRepo, frontierRepo, eventBus);
const messageRouter = new MessageRouter(scheduler);

chrome.runtime.onInstalled.addListener(async () => {
  logger.info('SW', 'Extension installed');
  await logger.loadLevel();
  chrome.alarms.create('crawl-heartbeat', { periodInMinutes: HEARTBEAT_INTERVAL_MS / 60000 });
  chrome.contextMenus.create({ id: 'scan-page', title: 'Scan this page', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'scan-site', title: 'Scan this site', contexts: ['page'] });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'crawl-heartbeat') return;
  const rehydrated = await scheduler.rehydrate();
  if (rehydrated) logger.info('SW', 'Crawl resumed after rehydration');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageRouter.route(message, sender).then(sendResponse);
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  portManager.register(port);
  port.onMessage.addListener((msg) => {
    if (msg.action === 'subscribe') portManager.subscribe(port.name || '', msg.topic);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.url) return;
  if (info.menuItemId === 'scan-page' || info.menuItemId === 'scan-site') {
    chrome.runtime.sendMessage({
      action: 'start-crawl',
      jobId: crypto.randomUUID(),
      config: { startUrl: tab.url, maxDepth: info.menuItemId === 'scan-page' ? 0 : 5 },
    });
  }
});

logger.info('SW', 'Service worker initialized');
