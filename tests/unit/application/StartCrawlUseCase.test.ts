import { describe, it, expect, vi } from 'vitest';
import { StartCrawlUseCase } from '../../../src/application/use-cases/StartCrawlUseCase';
import { CrawlJobState, DomainScope } from '../../../src/shared/types';
import type { IJobRepository, IUrlFrontierRepository } from '../../../src/application/interfaces';

function mockJobRepo(): IJobRepository {
  return { save: vi.fn(), load: vi.fn(), list: vi.fn(), delete: vi.fn() };
}
function mockFrontierRepo(): IUrlFrontierRepository {
  return { save: vi.fn(), load: vi.fn(), clear: vi.fn() };
}

describe('StartCrawlUseCase', () => {
  it('should create and start a crawl job', async () => {
    const useCase = new StartCrawlUseCase(mockJobRepo(), mockFrontierRepo());
    const result = await useCase.execute({
      startUrl: 'https://example.com',
      maxDepth: 3, maxUrls: 100, domainScope: DomainScope.SameOrigin,
    });
    expect(result.job.state).toBe(CrawlJobState.Running);
    expect(result.job.startUrl.toString()).toBe('https://example.com/');
  });

  it('should throw for invalid URL', async () => {
    const useCase = new StartCrawlUseCase(mockJobRepo(), mockFrontierRepo());
    await expect(useCase.execute({ startUrl: 'not-a-url' })).rejects.toThrow();
  });
});
