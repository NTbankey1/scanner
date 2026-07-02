import { NormalizedUrl } from '../../domain/value-objects/NormalizedUrl';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { DedupPolicy } from '../../domain/services/DedupPolicy';
import { DomainScopePolicy } from '../../domain/services/DomainScopePolicy';
import { UrlFilterChain } from '../../domain/services/UrlFilterChain';
import { PriorityCalculator } from '../../domain/services/PriorityCalculator';
import { ResourceNode } from '../../domain/entities/ResourceNode';
import { ResourceType } from '../../shared/types';
import { detectResourceType } from '../../domain/value-objects/ResourceType';
import { CrawlDepth } from '../../domain/value-objects/CrawlDepth';

export interface ProcessedUrl {
  normalizedUrl: NormalizedUrl;
  resourceType: ResourceType;
  priority: number;
}

export class UrlProcessorService {
  constructor(
    private dedupPolicy: DedupPolicy,
    private domainScope: DomainScopePolicy,
    private filterChain: UrlFilterChain,
    private startUrl: NormalizedUrl,
    private currentDepth: CrawlDepth,
    private maxDepth: number,
  ) {}

  processRawUrls(rawUrls: Array<{ url: string; type: string }>): {
    accepted: ProcessedUrl[];
    rejected: { url: string; reason: string }[];
  } {
    const accepted: ProcessedUrl[] = [];
    const rejected: { url: string; reason: string }[] = [];

    for (const raw of rawUrls) {
      try {
        const normalizedUrl = new NormalizedUrl(raw.url);

        // 1. Domain scope check
        if (!this.domainScope.isAllowed(normalizedUrl, this.startUrl)) {
          rejected.push({ url: raw.url, reason: 'out_of_scope' });
          continue;
        }

        // 2. Dedup check
        if (this.dedupPolicy.isDuplicate(normalizedUrl)) {
          rejected.push({ url: raw.url, reason: 'duplicate' });
          continue;
        }

        // 3. Filter chain
        if (!this.filterChain.shouldCrawl(normalizedUrl)) {
          rejected.push({ url: raw.url, reason: 'filtered' });
          continue;
        }

        // 4. Depth check
        if (this.currentDepth.value >= this.maxDepth) {
          rejected.push({ url: raw.url, reason: 'max_depth' });
          continue;
        }

        const resourceType = detectResourceType(raw.url);
        const priority = PriorityCalculator.calculate(
          normalizedUrl,
          this.currentDepth.value + 1,
          resourceType,
          this.startUrl,
        );

        // 5. Mark as visited
        this.dedupPolicy.markVisited(normalizedUrl);

        accepted.push({ normalizedUrl, resourceType, priority });
      } catch (err) {
        rejected.push({ url: raw.url, reason: `invalid: ${String(err)}` });
      }
    }

    return { accepted, rejected };
  }

  enqueueResults(frontier: UrlFrontier, results: ProcessedUrl[]): void {
    for (const r of results) {
      frontier.enqueue(r.normalizedUrl, r.priority);
    }
  }

  createResourceNodes(
    parentId: string,
    results: ProcessedUrl[],
  ): ResourceNode[] {
    return results.map(r => new ResourceNode(
      crypto.randomUUID(),
      r.normalizedUrl,
      r.resourceType,
      this.currentDepth.next(),
      parentId,
    ));
  }
}
