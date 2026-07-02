import { describe, it, expect } from 'vitest';
import { PriorityCalculator } from '../../../src/domain/services/PriorityCalculator';
import { ResourceType } from '../../../src/shared/types';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('PriorityCalculator', () => {
  it('should give higher priority to shallower depth', () => {
    const url = new NormalizedUrl('https://example.com/page');
    const p0 = PriorityCalculator.calculate(url, 0, ResourceType.HTML, null);
    const p3 = PriorityCalculator.calculate(url, 3, ResourceType.HTML, null);
    expect(p0).toBeGreaterThan(p3);
  });

  it('should give bonus for same domain', () => {
    const start = new NormalizedUrl('https://example.com');
    const same = PriorityCalculator.calculate(new NormalizedUrl('https://blog.example.com/page'), 1, ResourceType.HTML, start);
    const diff = PriorityCalculator.calculate(new NormalizedUrl('https://other.com/page'), 1, ResourceType.HTML, start);
    expect(same).toBeGreaterThan(diff);
  });

  it('should give higher priority for HTML over image', () => {
    const url = new NormalizedUrl('https://example.com/page');
    const html = PriorityCalculator.calculate(url, 1, ResourceType.HTML, null);
    const img = PriorityCalculator.calculate(url, 1, ResourceType.Image, null);
    expect(html).toBeGreaterThan(img);
  });
});
