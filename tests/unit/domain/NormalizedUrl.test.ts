import { describe, it, expect } from 'vitest';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('NormalizedUrl', () => {
  it('should lowercase scheme and host', () => {
    const url = new NormalizedUrl('HTTPS://EXAMPLE.COM/Path');
    expect(url.toString()).toBe('https://example.com/Path');
  });

  it('should strip fragment', () => {
    const url = new NormalizedUrl('https://example.com/page#section');
    expect(url.toString()).toBe('https://example.com/page');
  });

  it('should strip trailing slash except root', () => {
    const withSlash = new NormalizedUrl('https://example.com/page/');
    expect(withSlash.toString()).toBe('https://example.com/page');
    const root = new NormalizedUrl('https://example.com/');
    expect(root.toString()).toBe('https://example.com/');
  });

  it('should remove default ports', () => {
    const http = new NormalizedUrl('https://example.com:443/page');
    expect(http.toString()).toBe('https://example.com/page');
    const nonDefault = new NormalizedUrl('https://example.com:8080/page');
    expect(nonDefault.toString()).toBe('https://example.com:8080/page');
  });

  it('should sort and strip tracking params', () => {
    const url = new NormalizedUrl('https://example.com/page?a=1&utm_source=twitter&b=2');
    expect(url.toString()).toBe('https://example.com/page?a=1&b=2');
  });

  it('should treat same URL as equal', () => {
    const a = new NormalizedUrl('https://Example.COM/Path/');
    const b = new NormalizedUrl('https://example.com/Path');
    expect(a.equals(b)).toBe(true);
  });

  it('should return origin', () => {
    const url = new NormalizedUrl('https://example.com/page');
    expect(url.origin).toBe('https://example.com');
  });

  it('should return hostname', () => {
    const url = new NormalizedUrl('https://blog.example.com/page');
    expect(url.hostname).toBe('blog.example.com');
  });

  it('should throw for invalid URL', () => {
    expect(() => new NormalizedUrl('not-a-url')).toThrow();
  });
});
