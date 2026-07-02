import { describe, it, expect } from 'vitest';
import { CrawlDepth } from '../../../src/domain/value-objects/CrawlDepth';

describe('CrawlDepth', () => {
  it('should create from valid number', () => {
    const depth = new CrawlDepth(3);
    expect(depth.value).toBe(3);
  });

  it('should create depth 0', () => {
    const depth = new CrawlDepth(0);
    expect(depth.value).toBe(0);
  });

  it('should throw for negative depth', () => {
    expect(() => new CrawlDepth(-1)).toThrow('CrawlDepth cannot be negative');
  });

  it('should create next depth', () => {
    const depth = new CrawlDepth(2);
    const next = depth.next();
    expect(next.value).toBe(3);
  });

  it('should throw on next() if at max', () => {
    const depth = new CrawlDepth(CrawlDepth.MAX);
    expect(() => depth.next()).toThrow('Max crawl depth reached');
  });

  it('should equal same depth', () => {
    const a = new CrawlDepth(5);
    const b = new CrawlDepth(5);
    expect(a.equals(b)).toBe(true);
  });
});
