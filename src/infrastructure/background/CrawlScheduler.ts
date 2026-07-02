import { CrawlJob } from '../../domain/entities/CrawlJob';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { EventBus } from '../messaging/EventBus';
import { logger } from '../../shared/logger';
import type { IJobRepository, IUrlFrontierRepository } from '../../application/interfaces';
import type { CrawlCommand } from '../../shared/types';

export class CrawlScheduler {
  private currentJob: CrawlJob | null = null;
  private frontier: UrlFrontier | null = null;

  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
    private eventBus: EventBus,
  ) {}

  async handleCommand(command: CrawlCommand): Promise<void> {
    logger.debug('CrawlScheduler', `Handling command: ${command.type}`);
    switch (command.type) {
      case 'START':
        await this.resume(command.jobId);
        break;
      case 'PAUSE':
        if (this.currentJob) {
          this.currentJob.pause();
          await this.persistState();
          this.eventBus.emit({
            type: 'CRAWL_PAUSED', jobId: this.currentJob.id,
            payload: {}, timestamp: Date.now(),
          });
        }
        break;
      case 'RESUME':
        await this.resume(command.jobId);
        break;
      case 'CANCEL':
        if (this.currentJob) {
          this.currentJob.cancel();
          await this.persistState();
          await this.frontierRepo.clear();
          this.frontier = null;
          this.eventBus.emit({
            type: 'CRAWL_FAILED', jobId: this.currentJob.id,
            payload: { error: 'Cancelled by user' }, timestamp: Date.now(),
          });
        }
        break;
    }
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
    return true;
  }

  private async resume(jobId: string): Promise<void> {
    if (!this.currentJob || this.currentJob.id !== jobId) {
      const job = await this.jobRepo.load(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      this.currentJob = job;
    }
    if (this.currentJob.state === 'RUNNING') return;
    this.currentJob.resume();
    await this.persistState();
  }

  private async persistState(): Promise<void> {
    if (!this.currentJob) return;
    await this.jobRepo.save(this.currentJob);
    if (this.frontier) await this.frontierRepo.save(this.frontier);
  }

  getCurrentJob(): CrawlJob | null { return this.currentJob; }
  getFrontier(): UrlFrontier | null { return this.frontier; }
}
