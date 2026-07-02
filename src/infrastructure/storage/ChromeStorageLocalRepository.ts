import type { IJobRepository } from '../../application/interfaces';
import { CrawlJob } from '../../domain/entities/CrawlJob';

const JOBS_KEY = 'dss:jobs';

export class ChromeStorageLocalRepository implements IJobRepository {
  async save(job: CrawlJob): Promise<void> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, unknown> = result[JOBS_KEY] || {};
    jobs[job.id] = job.toJSON();
    await chrome.storage.local.set({ [JOBS_KEY]: jobs });
  }

  async load(jobId: string): Promise<CrawlJob | null> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, any> = result[JOBS_KEY] || {};
    return jobs[jobId] ?? null;
  }

  async list(): Promise<CrawlJob[]> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, any> = result[JOBS_KEY] || {};
    return Object.values(jobs);
  }

  async delete(jobId: string): Promise<void> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, any> = result[JOBS_KEY] || {};
    delete jobs[jobId];
    await chrome.storage.local.set({ [JOBS_KEY]: jobs });
  }
}
