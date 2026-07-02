import { CrawlJob } from '../../domain/entities/CrawlJob';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { EventBus } from '../messaging/EventBus';
import { logger } from '../../shared/logger';
import { UrlProcessorService } from '../../application/services/UrlProcessorService';
import { DedupPolicy } from '../../domain/services/DedupPolicy';
import { DomainScopePolicy } from '../../domain/services/DomainScopePolicy';
import { UrlFilterChain } from '../../domain/services/UrlFilterChain';
import { CrawlDepth } from '../../domain/value-objects/CrawlDepth';
import { DomainScope } from '../../shared/types';
import { DEFAULT_MAX_DEPTH, MAX_TABS_CONCURRENT } from '../../shared/constants';
import type { IJobRepository, IUrlFrontierRepository, IResourceRepository } from '../../application/interfaces';
import type { CrawlCommand } from '../../shared/types';

export class CrawlScheduler {
  private currentJob: CrawlJob | null = null;
  private frontier: UrlFrontier | null = null;
  private dedupPolicy = new DedupPolicy();
  private activeTabs = 0;
  private pendingUrls = new Map<string, { depth: number; parentId: string | null }>();
  private pendingResources = new Map<string, Array<{ url: string; type: string }>>();
  private scanComplete = new Map<string, boolean>();
  private isProcessing = false;

  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
    private resourceRepo: IResourceRepository,
    private eventBus: EventBus,
  ) {}

  async handleCommand(command: CrawlCommand): Promise<void> {
    logger.debug('CrawlScheduler', `Handling command: ${command.type}`);
    switch (command.type) {
      case 'START':
        await this.startWithJob(command.jobId);
        break;
      case 'PAUSE':
        if (this.currentJob) {
          this.currentJob.pause();
          await this.persistState();
          this.eventBus.emit({ type: 'CRAWL_PAUSED', jobId: this.currentJob.id, payload: {}, timestamp: Date.now() });
        }
        break;
      case 'RESUME':
        await this.startWithJob(command.jobId);
        break;
      case 'CANCEL':
        if (this.currentJob) {
          this.currentJob.cancel();
          await this.cleanupTabs();
          await this.persistState();
          await this.frontierRepo.clear();
          this.frontier = null;
          this.dedupPolicy = new DedupPolicy();
          this.eventBus.emit({ type: 'CRAWL_FAILED', jobId: this.currentJob.id, payload: { error: 'Cancelled by user' }, timestamp: Date.now() });
        }
        break;
    }
  }

  async handleResourcesDiscovered(_jobId: string, url: string, resources: Array<{ url: string; type: string }>): Promise<void> {
    const pending = this.pendingResources.get(url) || [];
    pending.push(...resources);
    this.pendingResources.set(url, pending);
  }

  async handleScanComplete(jobId: string, url: string): Promise<void> {
    this.scanComplete.set(url, true);
    const resources = this.pendingResources.get(url) || [];
    const info = this.pendingUrls.get(url);
    this.pendingUrls.delete(url);
    this.pendingResources.delete(url);
    this.scanComplete.delete(url);
    this.activeTabs = Math.max(0, this.activeTabs - 1);

    if (!this.currentJob || this.currentJob.id !== jobId) return;
    if (this.currentJob.state !== 'RUNNING') return;

    if (resources.length === 0) {
      logger.debug('CrawlScheduler', `No resources found at ${url}`);
      await this.processNextUrl();
      return;
    }

    const depth = info?.depth ?? 0;
    const parentId = info?.parentId ?? undefined;
    const startUrl = this.currentJob.startUrl;

    const processor = new UrlProcessorService(
      this.dedupPolicy,
      new DomainScopePolicy(
        (this.currentJob.config.domainScope as DomainScope) || DomainScope.SameOrigin,
        this.currentJob.config.extraDomains || [],
      ),
      new UrlFilterChain(),
      startUrl,
      new CrawlDepth(depth),
      this.currentJob.config.maxDepth || DEFAULT_MAX_DEPTH,
    );

    const { accepted, rejected } = processor.processRawUrls(resources);

    // Create and store resource nodes
    const nodes = processor.createResourceNodes(
      parentId || crypto.randomUUID(),
      accepted,
    );

    // Save resources in batch
    if (accepted.length > 0) {
      await this.resourceRepo.saveBatch(nodes);
    }

    // Enqueue new URLs to frontier
    if (this.frontier && accepted.length > 0) {
      processor.enqueueResults(this.frontier, accepted);
    }

    this.currentJob.incrementScanned();
    this.currentJob.stats.urlsFound += accepted.length;
    this.currentJob.stats.urlsFailed += rejected.length;

    // Emit progress
    this.eventBus.emit({
      type: 'URL_DISCOVERED', jobId,
      payload: { url, found: accepted.length, rejected: rejected.length, total: this.currentJob.stats.urlsFound },
      timestamp: Date.now(),
    });
    this.eventBus.emit({
      type: 'CRAWL_PROGRESS', jobId,
      payload: { scanned: this.currentJob.stats.urlsScanned, found: this.currentJob.stats.urlsFound },
      timestamp: Date.now(),
    });

    await this.persistState();
    await this.processNextUrl();
  }

  private async startWithJob(jobId: string): Promise<void> {
    if (!this.currentJob || this.currentJob.id !== jobId) {
      const job = await this.jobRepo.load(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      this.currentJob = job;
    }
    if (this.currentJob.state === 'RUNNING') return;
    this.currentJob.resume();
    await this.persistState();
    await this.processNextUrl();
  }

  async processNextUrl(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      if (!this.currentJob || this.currentJob.state !== 'RUNNING') return;
      if (!this.frontier || this.frontier.isEmpty()) {
        this.currentJob.complete();
        await this.persistState();
        this.eventBus.emit({ type: 'CRAWL_COMPLETED', jobId: this.currentJob.id, payload: {}, timestamp: Date.now() });
        return;
      }

      if (this.activeTabs >= MAX_TABS_CONCURRENT) return;
      if (this.currentJob.stats.urlsScanned >= this.currentJob.config.maxUrls) {
        this.currentJob.complete();
        await this.persistState();
        return;
      }

      // Ensure frontier is loaded
      if (!this.frontier) {
        this.frontier = await this.frontierRepo.load();
      }
      if (!this.frontier || this.frontier.isEmpty()) {
        if (this.currentJob) {
          this.currentJob.complete();
          await this.persistState();
          this.eventBus.emit({ type: 'CRAWL_COMPLETED', jobId: this.currentJob.id, payload: {}, timestamp: Date.now() });
        }
        return;
      }

      const nextUrl = this.frontier.dequeue();
      if (!nextUrl) {
        this.currentJob.complete();
        await this.persistState();
        return;
      }

      const depth = nextUrl.normalized === this.currentJob.startUrl.normalized ? 0 : 1; // simplified; real depth tracking in M2
      this.activeTabs++;

      // Track this URL
      const urlStr = nextUrl.toString();
      this.pendingUrls.set(urlStr, { depth, parentId: null });
      this.pendingResources.set(urlStr, []);

      // Navigate tab to this URL for scanning
      try {
        const tab = await chrome.tabs.create({
          url: urlStr,
          active: false,
        });

        // Wait for scan-complete message or timeout
        const timeout = setTimeout(async () => {
          logger.warn('CrawlScheduler', `Timeout scanning ${urlStr}`);
          this.handleScanComplete(this.currentJob!.id, urlStr);
        }, 15000); // 15s timeout per page

        // Store tab ID for cleanup
        (tab as any)._dssTimeout = timeout;
      } catch (err) {
        logger.error('CrawlScheduler', `Failed to create tab for ${urlStr}`, { error: String(err) });
        this.activeTabs = Math.max(0, this.activeTabs - 1);
        this.pendingUrls.delete(urlStr);
        this.pendingResources.delete(urlStr);
        this.currentJob.incrementFailed();
        await this.persistState();
        await this.processNextUrl();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async cleanupTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url?.startsWith('http') && !tab.active) {
          // Close tabs we opened for scanning (simple heuristic)
          try { await chrome.tabs.remove(tab.id!); } catch {}
        }
      }
    } catch {}
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
    if (this.currentJob.resume) this.currentJob.resume();
    logger.info('CrawlScheduler', `Rehydrated job ${activeJob.id} with ${frontier.size()} URLs`);
    await this.processNextUrl();
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
  getDedupPolicy(): DedupPolicy { return this.dedupPolicy; }
}
