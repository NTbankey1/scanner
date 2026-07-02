import { describe, it, expect } from 'vitest';
import { LoopDetector } from '../../../src/domain/services/LoopDetector';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('LoopDetector', () => {
  it('should not flag normal URLs', () => {
    const ld = new LoopDetector();
    expect(ld.hasPathLoop(new NormalizedUrl('https://example.com/page/about'))).toBe(false);
  });

  it('should detect repeated page segments', () => {
    const ld = new LoopDetector();
    expect(ld.hasPathLoop(new NormalizedUrl('https://example.com/page/page/page'))).toBe(true);
  });

  it('should detect repeated category segments', () => {
    const ld = new LoopDetector();
    expect(ld.hasPathLoop(new NormalizedUrl('https://example.com/category/category/category/item'))).toBe(true);
  });

  it('should detect query parameter explosion', () => {
    const ld = new LoopDetector();
    const url = new NormalizedUrl('https://example.com/search?a=1&b=2&c=3&d=4&e=5&f=6');
    expect(ld.hasQueryParamExplosion(url)).toBe(true);
  });

  it('should not flag normal query params', () => {
    const ld = new LoopDetector();
    const url = new NormalizedUrl('https://example.com/search?q=hello&page=1');
    expect(ld.hasQueryParamExplosion(url)).toBe(false);
  });

  it('should detect infinite pattern with numeric segments', () => {
    const ld = new LoopDetector();
    expect(ld.hasInfinitePattern(new NormalizedUrl('https://example.com/2024/01/02/post'))).toBe(true);
  });

  it('should not flag simple numeric paths', () => {
    const ld = new LoopDetector();
    expect(ld.hasInfinitePattern(new NormalizedUrl('https://example.com/post/123'))).toBe(false);
  });

  it('should track visit count', () => {
    const ld = new LoopDetector();
    const url = new NormalizedUrl('https://example.com/page');
    expect(ld.trackVisit(url)).toBe(true); // 1st visit
    expect(ld.trackVisit(url)).toBe(true); // 2nd
    expect(ld.trackVisit(url)).toBe(true); // 3rd
    expect(ld.trackVisit(url)).toBe(false); // 4th — too many
  });
});
