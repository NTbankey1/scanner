import { describe, it, expect } from 'vitest';
import { CrawlJob } from '../../../src/domain/entities/CrawlJob';
import { CrawlJobState, DomainScope } from '../../../src/shared/types';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

function makeConfig(overrides: Partial<Record<string, unknown>> = {}) {
  return { maxDepth: 3, maxUrls: 100, domainScope: DomainScope.SameOrigin, extraDomains: [], rateLimitMs: 300, respectRobotsTxt: true, ...overrides };
}

describe('CrawlJob', () => {
  it('should create in Idle state', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    expect(job.state).toBe(CrawlJobState.Idle);
    expect(job.stats.urlsScanned).toBe(0);
  });

  it('should start: Idle → Running', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    expect(job.state).toBe(CrawlJobState.Running);
    expect(job.stats.startTime).toBeGreaterThan(0);
  });

  it('should throw start() if not Idle', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    expect(() => job.start()).toThrow();
  });

  it('should pause: Running → Paused', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.pause();
    expect(job.state).toBe(CrawlJobState.Paused);
  });

  it('should resume: Paused → Running', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.pause();
    job.resume();
    expect(job.state).toBe(CrawlJobState.Running);
  });

  it('should complete', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.complete();
    expect(job.state).toBe(CrawlJobState.Completed);
    expect(job.stats.endTime).toBeDefined();
  });

  it('should fail', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.fail();
    expect(job.state).toBe(CrawlJobState.Failed);
  });

  it('should cancel from Running', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.cancel();
    expect(job.state).toBe(CrawlJobState.Cancelled);
  });

  it('should detect active state', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    expect(job.isActive()).toBe(false);
    job.start();
    expect(job.isActive()).toBe(true);
    job.cancel();
    expect(job.isActive()).toBe(false);
  });

  it('should increment stats', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.incrementScanned();
    job.incrementFound();
    job.incrementFailed();
    expect(job.stats.urlsScanned).toBe(1);
    expect(job.stats.urlsFound).toBe(1);
    expect(job.stats.urlsFailed).toBe(1);
  });
});
