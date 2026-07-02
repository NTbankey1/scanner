import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import { CrawlDepth } from '../value-objects/CrawlDepth';
import { ResourceType, ResourceStatus } from '../../shared/types';

export class ResourceNode {
  readonly id: string;
  readonly url: NormalizedUrl;
  readonly resourceType: ResourceType;
  readonly depth: CrawlDepth;
  readonly parentId: string | null;
  status: ResourceStatus;
  children: ResourceNode[];
  contentType?: string;
  contentSize?: number;
  readonly discoveredAt: number;

  constructor(
    id: string,
    url: NormalizedUrl,
    resourceType: ResourceType,
    depth: CrawlDepth,
    parentId: string | null = null,
  ) {
    this.id = id;
    this.url = url;
    this.resourceType = resourceType;
    this.depth = depth;
    this.parentId = parentId;
    this.status = ResourceStatus.Discovered;
    this.children = [];
    this.discoveredAt = Date.now();
  }

  addChild(child: ResourceNode): void {
    this.children.push(child);
  }

  updateStatus(status: ResourceStatus): void {
    this.status = status;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      url: this.url.toString(),
      resourceType: this.resourceType,
      depth: this.depth.toString(),
      parentId: this.parentId,
      status: this.status,
      children: this.children.map(c => c.toJSON()),
      contentType: this.contentType,
      contentSize: this.contentSize,
      discoveredAt: this.discoveredAt,
    };
  }
}
