import { describe, it, expect, beforeEach } from 'vitest';
import { DedupPolicy } from '../../../src/domain/services/DedupPolicy';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('DedupPolicy', () => {
  let policy: DedupPolicy;
  beforeEach(() => { policy = new DedupPolicy(); });

  it('should return false for unseen URL', () => {
    expect(policy.isDuplicate(new NormalizedUrl('https://example.com/page'))).toBe(false);
  });

  it('should return true for visited URL', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/page'));
    expect(policy.isDuplicate(new NormalizedUrl('https://example.com/page'))).toBe(true);
  });

  it('should normalize before check', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/page/'));
    expect(policy.isDuplicate(new NormalizedUrl('HTTPS://EXAMPLE.COM/page'))).toBe(true);
  });

  it('should track visited count', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/a'));
    policy.markVisited(new NormalizedUrl('https://example.com/b'));
    expect(policy.visitedCount).toBe(2);
  });

  it('should serialize and deserialize', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/a'));
    const json = policy.toJSON();
    const restored = DedupPolicy.fromJSON(json);
    expect(restored.isDuplicate(new NormalizedUrl('https://example.com/a'))).toBe(true);
  });
});
