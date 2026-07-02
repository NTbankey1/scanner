import { describe, it, expect, vi } from 'vitest';
import { StopCrawlUseCase } from '../../../src/application/use-cases/StopCrawlUseCase';
import { CrawlJob } from '../../../src/domain/entities/CrawlJob';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { CrawlJobState, DomainScope } from '../../../src/shared/types';
import type { IJobRepository, IUrlFrontierRepository } from '../../../src/application/interfaces';

function mockFrontierRepo(): IUrlFrontierRepository {
  return { save: vi.fn(), load: vi.fn(), clear: vi.fn() };
}

describe('StopCrawlUseCase', () => {
  it('should cancel a running job', async () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), {
      maxDepth: 3, maxUrls: 100, domainScope: DomainScope.SameOrigin, extraDomains: [], rateLimitMs: 300, respectRobotsTxt: true,
    });
    job.start();

    const jobRepo: IJobRepository = { save: vi.fn(), load: vi.fn().mockResolvedValue(job), list: vi.fn(), delete: vi.fn() };
    const frontierRepo = mockFrontierRepo();
    const useCase = new StopCrawlUseCase(jobRepo, frontierRepo);

    const result = await useCase.execute({ jobId: 'job-1' });
    expect(result.job.state).toBe(CrawlJobState.Cancelled);
    expect(frontierRepo.clear).toHaveBeenCalled();
  });

  it('should throw for unknown job', async () => {
    const jobRepo: IJobRepository = { save: vi.fn(), load: vi.fn().mockResolvedValue(null), list: vi.fn(), delete: vi.fn() };
    const useCase = new StopCrawlUseCase(jobRepo, mockFrontierRepo());
    await expect(useCase.execute({ jobId: 'nonexistent' })).rejects.toThrow('Job not found');
  });
});
