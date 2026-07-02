import { describe, it, expect } from 'vitest';
import { ResourceNode } from '../../../src/domain/entities/ResourceNode';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { CrawlDepth } from '../../../src/domain/value-objects/CrawlDepth';
import { ResourceType, ResourceStatus } from '../../../src/shared/types';

describe('ResourceNode', () => {
  it('should create with default status DISCOVERED', () => {
    const node = new ResourceNode('r1', new NormalizedUrl('https://example.com/page'), ResourceType.HTML, new CrawlDepth(0));
    expect(node.status).toBe(ResourceStatus.Discovered);
    expect(node.children).toEqual([]);
  });

  it('should add children', () => {
    const parent = new ResourceNode('p1', new NormalizedUrl('https://example.com'), ResourceType.HTML, new CrawlDepth(0));
    const child = new ResourceNode('c1', new NormalizedUrl('https://example.com/style.css'), ResourceType.CSS, new CrawlDepth(1), 'p1');
    parent.addChild(child);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].id).toBe('c1');
  });

  it('should update status', () => {
    const node = new ResourceNode('r1', new NormalizedUrl('https://example.com/page'), ResourceType.HTML, new CrawlDepth(0));
    node.updateStatus(ResourceStatus.Fetched);
    expect(node.status).toBe(ResourceStatus.Fetched);
  });
});
