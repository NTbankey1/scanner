import { describe, it, expect } from 'vitest';
import { parseSitemapXml, findSitemapUrls, guessSitemapUrl } from '../../../src/infrastructure/resource-discovery/SitemapParser';

describe('SitemapParser', () => {
  it('should parse standard sitemap', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc><priority>1.0</priority></url>
        <url><loc>https://example.com/about</loc><lastmod>2024-01-01</lastmod></url>
      </urlset>`;
    const entries = parseSitemapXml(xml);
    expect(entries.length).toBe(2);
    expect(entries[0].loc).toBe('https://example.com/');
    expect(entries[0].priority).toBe(1.0);
    expect(entries[1].lastmod).toBe('2024-01-01');
  });

  it('should parse sitemap index', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
      </sitemapindex>`;
    const entries = parseSitemapXml(xml);
    expect(entries.length).toBe(2);
    expect(entries[0].loc).toBe('https://example.com/sitemap-posts.xml');
  });

  it('should return empty for invalid XML', () => {
    const entries = parseSitemapXml('not xml');
    expect(entries.length).toBe(0);
  });

  it('should extract sitemap URLs from robots.txt', () => {
    const robots = `
      User-agent: *
      Disallow: /admin
      Sitemap: https://example.com/sitemap.xml
    `;
    const urls = findSitemapUrls(robots);
    expect(urls).toContain('https://example.com/sitemap.xml');
  });

  it('should generate sitemap URL guesses', () => {
    const guesses = guessSitemapUrl('https://example.com');
    expect(guesses).toContain('https://example.com/sitemap.xml');
    expect(guesses).toContain('https://example.com/sitemap_index.xml');
  });
});
