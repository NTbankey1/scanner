import { CrawlJob } from '../../domain/entities/CrawlJob';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { EventBus } from '../messaging/EventBus';
import { PortManager } from '../messaging/PortManager';
import { logger } from '../../shared/logger';
import { UrlProcessorService } from '../../application/services/UrlProcessorService';
import { DedupPolicy } from '../../domain/services/DedupPolicy';
import { DomainScopePolicy } from '../../domain/services/DomainScopePolicy';
import { UrlFilterChain } from '../../domain/services/UrlFilterChain';
import { CrawlDepth } from '../../domain/value-objects/CrawlDepth';
import { DomainScope } from '../../shared/types';
import { DEFAULT_MAX_DEPTH } from '../../shared/constants';
import type { IJobRepository, IUrlFrontierRepository, IResourceRepository } from '../../application/interfaces';
import type { CrawlCommand } from '../../shared/types';

export class CrawlScheduler {
  private currentJob: CrawlJob | null = null;
  private frontier: UrlFrontier | null = null;
  private dedupPolicy = new DedupPolicy();
  private crawlTabId: number | null = null;
  private isProcessing = false;
  private paused = false;
  private currentUrl: string | null = null;

  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
    private resourceRepo: IResourceRepository,
    private eventBus: EventBus,
    private portManager: PortManager,
  ) {}

  async handleCommand(command: CrawlCommand): Promise<void> {
    switch (command.type) {
      case 'START':
        await this.startWithJob(command.jobId);
        break;
      case 'PAUSE':
        this.paused = true;
        if (this.currentJob) {
          this.currentJob.pause();
          await this.persistState();
          this.emit('CRAWL_PAUSED', {});
        }
        break;
      case 'RESUME':
        this.paused = false;
        await this.startWithJob(command.jobId);
        break;
      case 'CANCEL':
        this.paused = false;
        this.isProcessing = false;
        if (this.currentJob) {
          this.currentJob.cancel();
          await this.closeCrawlTab();
          await this.persistState();
          await this.frontierRepo.clear();
          this.frontier = null;
          this.dedupPolicy = new DedupPolicy();
          this.emit('CRAWL_FAILED', { error: 'Cancelled by user' });
        }
        break;
    }
  }

  async handleResourcesDiscovered(_jobId: string, url: string, resources: Array<{ url: string; type: string }>): Promise<void> {
    if (!this.currentJob || this.currentJob.state !== 'RUNNING') return;
    if (url !== this.currentUrl) {
      logger.debug('CrawlScheduler', `Ignoring resources from stale URL: ${url}`);
      return;
    }
    await this.processDiscoveredResources(url, resources);
  }

  async handleScanComplete(jobId: string, url: string): Promise<void> {
    if (!this.currentJob || this.currentJob.id !== jobId) return;
    if (url !== this.currentUrl) return;

    logger.debug('CrawlScheduler', `Scan complete for ${url}`);
    this.currentJob.incrementScanned();
    this.emit('CRAWL_PROGRESS', {
      scanned: this.currentJob.stats.urlsScanned,
      found: this.currentJob.stats.urlsFound,
      currentUrl: url,
    });

    await this.persistState();
    await this.processNextUrl();
  }

  private async processDiscoveredResources(url: string, resources: Array<{ url: string; type: string }>): Promise<void> {
    if (!this.currentJob || this.currentJob.state !== 'RUNNING') return;

    const depth = this.currentUrl === this.currentJob.startUrl.normalized ? 0 : 1;

    const processor = new UrlProcessorService(
      this.dedupPolicy,
      new DomainScopePolicy(
        (this.currentJob.config.domainScope as DomainScope) || DomainScope.SameOrigin,
        this.currentJob.config.extraDomains || [],
      ),
      new UrlFilterChain(),
      this.currentJob.startUrl,
      new CrawlDepth(depth),
      this.currentJob.config.maxDepth || DEFAULT_MAX_DEPTH,
    );

    const { accepted, rejected } = processor.processRawUrls(resources);
    const nodes = processor.createResourceNodes(crypto.randomUUID(), accepted);

    if (accepted.length > 0) {
      await this.resourceRepo.saveBatch(nodes);
    }
    if (this.frontier && accepted.length > 0) {
      processor.enqueueResults(this.frontier, accepted);
    }

    this.currentJob.stats.urlsFound += accepted.length;
    this.currentJob.stats.urlsFailed += rejected.length;

    this.emit('URL_DISCOVERED', {
      url,
      found: accepted.length,
      rejected: rejected.length,
      total: this.currentJob.stats.urlsFound,
    });
  }

  private async startWithJob(jobId: string): Promise<void> {
    if (!this.currentJob || this.currentJob.id !== jobId) {
      const job = await this.jobRepo.load(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      this.currentJob = job;
    }
    if (this.currentJob.state === 'RUNNING') return;
    this.currentJob.resume();
    this.paused = false;
    await this.persistState();
    // If we have a crawl tab, use it; otherwise create one
    if (this.crawlTabId) {
      await this.processNextUrl();
    } else {
      await this.createCrawlTab();
    }
  }

  private async createCrawlTab(): Promise<void> {
    try {
      const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
      this.crawlTabId = tab.id!;
      logger.debug('CrawlScheduler', `Created crawl tab: ${this.crawlTabId}`);
      await this.processNextUrl();
    } catch (err) {
      logger.error('CrawlScheduler', 'Failed to create crawl tab', { error: String(err) });
    }
  }

  private async closeCrawlTab(): Promise<void> {
    if (this.crawlTabId) {
      try {
        await chrome.tabs.remove(this.crawlTabId);
      } catch {}
      this.crawlTabId = null;
    }
  }

  async processNextUrl(): Promise<void> {
    if (this.isProcessing || this.paused) return;
    this.isProcessing = true;

    try {
      if (!this.currentJob || this.currentJob.state !== 'RUNNING') return;
      if (!this.crawlTabId) { await this.createCrawlTab(); return; }

      // Load frontier
      if (!this.frontier) this.frontier = await this.frontierRepo.load();
      if (!this.frontier || this.frontier.isEmpty()) {
        await this.finishCrawl();
        return;
      }

      // Check limits
      if (this.currentJob.stats.urlsScanned >= this.currentJob.config.maxUrls) {
        await this.finishCrawl();
        return;
      }

      const nextUrl = this.frontier.dequeue();
      if (!nextUrl) { await this.finishCrawl(); return; }

      this.currentUrl = nextUrl.toString();
      logger.debug('CrawlScheduler', `Navigating to: ${this.currentUrl}`);

      // Navigate the crawl tab
      await chrome.tabs.update(this.crawlTabId, { url: this.currentUrl });

      // Wait for tab to finish loading, then inject scanner
      const tabId = this.crawlTabId;
      const currentJobId = this.currentJob.id;

      const onUpdated = async (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);

        if (this.currentUrl !== nextUrl.toString()) return;

        try {
          // Inject scanner directly via scripting API
          await this.injectScanner(tabId, currentJobId);
        } catch (err: any) {
          // scripting.executeScript often fails on chrome:// pages
          logger.debug('CrawlScheduler', `Inject failed for ${this.currentUrl}: ${err.message}`);
          // Navigate via tab message as fallback
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'start-scan', jobId: currentJobId });
          } catch {
            await this.handleScanComplete(currentJobId, this.currentUrl!);
          }
        }
      };

      chrome.tabs.onUpdated.addListener(onUpdated);

      // Safety timeout
      setTimeout(async () => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        if (this.currentUrl === nextUrl.toString() && this.currentUrl !== null) {
          logger.warn('CrawlScheduler', `Timeout: ${this.currentUrl}`);
          await this.handleScanComplete(currentJobId, this.currentUrl);
        }
      }, 15000);

    } catch (err) {
      logger.error('CrawlScheduler', 'processNextUrl error', { error: String(err) });
      if (this.currentJob) this.currentJob.incrementFailed();
      await this.persistState();
      this.isProcessing = false;
      await this.processNextUrl();
    } finally {
      this.isProcessing = false;
    }
  }

  private async injectScanner(tabId: number, jobId: string): Promise<void> {
    // First inject a lightweight scan that sends results back
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (scanJobId: string) => {
        // This runs in the tab's MAIN world - lightweight DOM scanner
        const resources: Array<{ url: string; type: string }> = [];
        const selectors = ['a[href]', 'img[src]', 'script[src]', 'link[href]',
          'video[src]', 'audio[src]', 'source[src]', 'iframe[src]',
          'link[rel="icon"]', 'meta[content]', 'meta[property="og:image"]'];

        for (const sel of selectors) {
          try {
            const els = document.querySelectorAll(sel);
            els.forEach(el => {
              const tag = el.tagName.toLowerCase();
              let val: string | null = null;
              if (tag === 'a') val = (el as HTMLAnchorElement).href;
              else if (tag === 'img') val = (el as HTMLImageElement).src;
              else if (tag === 'link') val = (el as HTMLLinkElement).href;
              else if (tag === 'meta' && el.getAttribute('property') === 'og:image') val = el.getAttribute('content');
              else if (tag === 'meta' && (el as HTMLMetaElement).name === 'og:image') val = (el as HTMLMetaElement).content;
              else if ('src' in el) val = (el as any).src;
              if (val && val.startsWith('http')) resources.push({ url: val, type: tag });
            });
          } catch {}
        }
        chrome.runtime.sendMessage({
          action: 'resources-discovered',
          jobId: scanJobId,
          resources,
        });
        chrome.runtime.sendMessage({
          action: 'scan-complete',
          jobId: scanJobId,
          url: location.href,
        });
      },
      args: [jobId],
    });
  }

  private async finishCrawl(): Promise<void> {
    if (!this.currentJob) return;
    this.currentJob.complete();
    await this.persistState();
    await this.closeCrawlTab();
    this.emit('CRAWL_COMPLETED', {
      scanned: this.currentJob.stats.urlsScanned,
      found: this.currentJob.stats.urlsFound,
    });
    logger.info('CrawlScheduler', `Crawl completed: ${this.currentJob.stats.urlsScanned} scanned, ${this.currentJob.stats.urlsFound} found`);
  }

  private emit(type: any, payload: Record<string, unknown>): void {
    const jobId = this.currentJob?.id || '';
    const event = { type, jobId, payload, timestamp: Date.now() };
    this.eventBus.emit(event);
    this.portManager.broadcast(event);
  }

  async rehydrate(): Promise<boolean> {
    const frontier = await this.frontierRepo.load();
    if (!frontier || frontier.isEmpty()) return false;

    const rawJobs = await this.jobRepo.list();
    const activeJob = rawJobs.find((j: any) => {
      const s = typeof j.state === 'string' ? j.state : j.state;
      return s === 'RUNNING' || s === 'PAUSED';
    });
    if (!activeJob) return false;

    this.frontier = frontier;
    this.currentJob = activeJob;
    this.paused = this.currentJob.state === 'PAUSED' as any;
    logger.info('CrawlScheduler', `Rehydrated job ${(activeJob as any).id} with ${frontier.size()} URLs`);
    await this.createCrawlTab();
    return true;
  }

  async setJobAndFrontier(job: CrawlJob, frontier: UrlFrontier): Promise<void> {
    this.currentJob = job;
    this.frontier = frontier;
  }

  private async persistState(): Promise<void> {
    if (!this.currentJob) return;
    await this.jobRepo.save(this.currentJob);
    if (this.frontier) await this.frontierRepo.save(this.frontier);
  }

  getCurrentJob(): CrawlJob | null { return this.currentJob; }
  getFrontier(): UrlFrontier | null { return this.frontier; }
}
