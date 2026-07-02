import { describe, it, expect } from 'vitest';
import { UrlProcessorService } from '../../../src/application/services/UrlProcessorService';
import { DedupPolicy } from '../../../src/domain/services/DedupPolicy';
import { DomainScopePolicy } from '../../../src/domain/services/DomainScopePolicy';
import { UrlFilterChain } from '../../../src/domain/services/UrlFilterChain';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { CrawlDepth } from '../../../src/domain/value-objects/CrawlDepth';
import { DomainScope } from '../../../src/shared/types';

describe('UrlProcessorService', () => {
  const startUrl = new NormalizedUrl('https://example.com');

  function makeProcessor(depth = 0, maxDepth = 3) {
    return new UrlProcessorService(
      new DedupPolicy(),
      new DomainScopePolicy(DomainScope.SameOrigin, []),
      new UrlFilterChain(),
      startUrl,
      new CrawlDepth(depth),
      maxDepth,
    );
  }

  it('should accept valid same-origin URLs', () => {
    const processor = makeProcessor();
    const { accepted, rejected } = processor.processRawUrls([
      { url: 'https://example.com/page', type: 'a' },
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.length).toBe(0);
    expect(accepted[0].normalizedUrl.toString()).toBe('https://example.com/page');
  });

  it('should reject out-of-scope URLs', () => {
    const processor = makeProcessor();
    const { accepted, rejected } = processor.processRawUrls([
      { url: 'https://other.com/page', type: 'a' },
    ]);
    expect(accepted.length).toBe(0);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason).toBe('out_of_scope');
  });

  it('should reject duplicate URLs', () => {
    const processor = makeProcessor();
    processor.processRawUrls([{ url: 'https://example.com/page', type: 'a' }]);
    const { accepted, rejected } = processor.processRawUrls([
      { url: 'https://example.com/page', type: 'a' },
    ]);
    expect(accepted.length).toBe(0);
    expect(rejected[0].reason).toBe('duplicate');
  });

  it('should reject URLs at max depth', () => {
    const processor = makeProcessor(2, 2);
    const { rejected } = processor.processRawUrls([
      { url: 'https://example.com/child', type: 'a' },
    ]);
    expect(rejected[0].reason).toBe('max_depth');
  });

  it('should handle invalid URLs gracefully', () => {
    const processor = makeProcessor();
    const { rejected } = processor.processRawUrls([
      { url: 'not-a-url', type: 'a' },
    ]);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason).toContain('invalid');
  });
});
