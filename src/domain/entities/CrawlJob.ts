import { CrawlJobState, CrawlConfig, CrawlStats } from '../../shared/types';
import { NormalizedUrl } from '../value-objects/NormalizedUrl';

const TRANSITIONS: Record<CrawlJobState, CrawlJobState[]> = {
  [CrawlJobState.Idle]: [CrawlJobState.Running],
  [CrawlJobState.Running]: [CrawlJobState.Paused, CrawlJobState.Completed, CrawlJobState.Failed, CrawlJobState.Cancelled],
  [CrawlJobState.Paused]: [CrawlJobState.Running, CrawlJobState.Cancelled],
  [CrawlJobState.Completed]: [],
  [CrawlJobState.Failed]: [],
  [CrawlJobState.Cancelled]: [],
};

export class CrawlJob {
  readonly id: string;
  readonly startUrl: NormalizedUrl;
  readonly config: CrawlConfig;
  state: CrawlJobState;
  stats: CrawlStats;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(id: string, startUrl: NormalizedUrl, config: CrawlConfig) {
    this.id = id;
    this.startUrl = startUrl;
    this.config = config;
    this.state = CrawlJobState.Idle;
    this.stats = { urlsScanned: 0, urlsFound: 0, urlsFailed: 0, startTime: 0 };
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  private transition(to: CrawlJobState): void {
    const allowed = TRANSITIONS[this.state];
    if (!allowed.includes(to)) {
      throw new Error(`Cannot transition job from ${this.state} to ${to}`);
    }
    this.state = to;
    this.updatedAt = new Date();
  }

  start(): void { this.transition(CrawlJobState.Running); this.stats.startTime = Date.now(); }
  pause(): void { this.transition(CrawlJobState.Paused); }
  resume(): void { this.transition(CrawlJobState.Running); }
  complete(): void { this.transition(CrawlJobState.Completed); this.stats.endTime = Date.now(); }
  fail(): void { this.transition(CrawlJobState.Failed); this.stats.endTime = Date.now(); }
  cancel(): void { this.transition(CrawlJobState.Cancelled); this.stats.endTime = Date.now(); }

  incrementScanned(): void { this.stats.urlsScanned++; }
  incrementFound(): void { this.stats.urlsFound++; }
  incrementFailed(): void { this.stats.urlsFailed++; }

  isActive(): boolean {
    return this.state === CrawlJobState.Running || this.state === CrawlJobState.Paused;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      startUrl: this.startUrl.toString(),
      state: this.state,
      config: this.config,
      stats: this.stats,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
