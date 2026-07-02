import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import { ResourceType } from '../../shared/types';
import { getPriorityMultiplier } from '../value-objects/ResourceType';

export class PriorityCalculator {
  static calculate(
    url: NormalizedUrl,
    depth: number,
    resourceType: ResourceType,
    startUrl: NormalizedUrl | null,
  ): number {
    const depthScore = 1 / (depth + 1);
    const domainScore = (startUrl && url.hostname.endsWith(startUrl.hostname)) ? 1 : 0;
    const typeMultiplier = getPriorityMultiplier(resourceType);
    return 0.4 * depthScore + 0.3 * domainScore + 0.3 * typeMultiplier;
  }
}
