import { CrawlJob } from '../../domain/entities/CrawlJob';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { NormalizedUrl } from '../../domain/value-objects/NormalizedUrl';
import { ResourceType } from '../../shared/types';
import { PriorityCalculator } from '../../domain/services/PriorityCalculator';
import type { IJobRepository, IUrlFrontierRepository } from '../interfaces';

export interface StartCrawlInput {
  startUrl: string;
  maxDepth?: number;
  maxUrls?: number;
  domainScope?: string;
  extraDomains?: string[];
  rateLimitMs?: number;
  respectRobotsTxt?: boolean;
}

export interface StartCrawlResult { job: CrawlJob; frontier: UrlFrontier; }

export class StartCrawlUseCase {
  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
  ) {}

  async execute(input: StartCrawlInput): Promise<StartCrawlResult> {
    const normalizedUrl = new NormalizedUrl(input.startUrl);
    const jobId = crypto.randomUUID();
    const job = new CrawlJob(jobId, normalizedUrl, {
      maxDepth: input.maxDepth ?? 5,
      maxUrls: input.maxUrls ?? 10000,
      domainScope: (input.domainScope ?? 'SAME_ORIGIN') as any,
      extraDomains: input.extraDomains ?? [],
      rateLimitMs: input.rateLimitMs ?? 300,
      respectRobotsTxt: input.respectRobotsTxt ?? true,
    });
    job.start();

    const frontier = new UrlFrontier();
    const priority = PriorityCalculator.calculate(normalizedUrl, 0, ResourceType.HTML, normalizedUrl);
    frontier.enqueue(normalizedUrl, priority);

    await this.jobRepo.save(job);
    await this.frontierRepo.save(frontier);
    return { job, frontier };
  }
}
