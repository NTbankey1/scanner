import type { IJobRepository, IUrlFrontierRepository } from '../interfaces';

export interface StopCrawlInput { jobId: string; }
export interface StopCrawlResult { job: any; }

export class StopCrawlUseCase {
  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
  ) {}

  async execute(input: StopCrawlInput): Promise<StopCrawlResult> {
    const job = await this.jobRepo.load(input.jobId);
    if (!job) throw new Error(`Job not found: ${input.jobId}`);
    job.cancel();
    await this.jobRepo.save(job);
    await this.frontierRepo.clear();
    return { job: job.toJSON() };
  }
}
