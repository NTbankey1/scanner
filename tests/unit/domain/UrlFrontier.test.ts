import { describe, it, expect } from 'vitest';
import { UrlFrontier } from '../../../src/domain/entities/UrlFrontier';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('UrlFrontier', () => {
  it('should be empty initially', () => {
    const f = new UrlFrontier();
    expect(f.isEmpty()).toBe(true);
    expect(f.size()).toBe(0);
  });

  it('should dequeue highest priority first', () => {
    const f = new UrlFrontier();
    f.enqueue(new NormalizedUrl('https://example.com/low'), 1);
    f.enqueue(new NormalizedUrl('https://example.com/high'), 10);
    f.enqueue(new NormalizedUrl('https://example.com/med'), 5);
    expect(f.dequeue()?.normalized).toBe('https://example.com/high');
    expect(f.dequeue()?.normalized).toBe('https://example.com/med');
    expect(f.dequeue()?.normalized).toBe('https://example.com/low');
  });

  it('should return null when empty', () => {
    const f = new UrlFrontier();
    expect(f.dequeue()).toBeNull();
  });

  it('should peek without removing', () => {
    const f = new UrlFrontier();
    f.enqueue(new NormalizedUrl('https://example.com/a'), 5);
    f.enqueue(new NormalizedUrl('https://example.com/b'), 10);
    expect(f.peek()?.normalized).toBe('https://example.com/b');
    expect(f.size()).toBe(2);
  });

  it('should remove by value', () => {
    const f = new UrlFrontier();
    const target = new NormalizedUrl('https://example.com/target');
    f.enqueue(new NormalizedUrl('https://example.com/a'), 1);
    f.enqueue(target, 5);
    f.enqueue(new NormalizedUrl('https://example.com/b'), 3);
    expect(f.remove(target)).toBe(true);
    expect(f.size()).toBe(2);
  });

  it('should serialize and deserialize', () => {
    const f = new UrlFrontier();
    f.enqueue(new NormalizedUrl('https://example.com/a'), 5);
    f.enqueue(new NormalizedUrl('https://example.com/b'), 3);
    const json = f.toJSON();
    const restored = UrlFrontier.fromJSON(json);
    expect(restored.size()).toBe(2);
    expect(restored.dequeue()?.normalized).toBe('https://example.com/a');
  });
});
