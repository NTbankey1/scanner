import { describe, it, expect } from 'vitest';
import { extractJsResources, containsCdnUrl, guessFrameworkFromJs } from '../../../src/infrastructure/resource-discovery/JavaScriptAnalyzer';

describe('JavaScriptAnalyzer', () => {
  it('should extract direct URL strings', () => {
    const js = `const api = "https://api.example.com/v1/users";`;
    const urls = extractJsResources(js, 'https://example.com');
    expect(urls.length).toBeGreaterThan(0);
  });

  it('should extract import paths', () => {
    const js = `import { getData } from '/api/data.js';`;
    const urls = extractJsResources(js, 'https://example.com');
    expect(urls).toContain('https://example.com/api/data.js');
  });

  it('should extract require paths', () => {
    const js = `const x = require('https://cdn.example.com/lib.js');`;
    const urls = extractJsResources(js, 'https://example.com');
    expect(urls).toContain('https://cdn.example.com/lib.js');
  });

  it('should resolve relative paths', () => {
    const js = `import('./components/Button.js');`;
    const urls = extractJsResources(js, 'https://example.com/app/');
    expect(urls.length).toBeGreaterThan(0);
  });

  it('should detect CDN URLs', () => {
    expect(containsCdnUrl('https://cdn.example.com/lib.js')).toBe(true);
    expect(containsCdnUrl('https://unpkg.com/react')).toBe(true);
    expect(containsCdnUrl('https://myownserver.com/file.js')).toBe(false);
  });

  it('should guess frameworks', () => {
    expect(guessFrameworkFromJs('var __NEXT_DATA__ = {}')).toContain('Next.js');
    expect(guessFrameworkFromJs('import { createApp } from "vue"')).toContain('Vue');
    expect(guessFrameworkFromJs('var $ = require("jquery")')).toContain('jQuery');
    expect(guessFrameworkFromJs('const a = 1')).toEqual([]);
  });
});
