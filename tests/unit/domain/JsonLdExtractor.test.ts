import { describe, it, expect } from 'vitest';
import { extractJsonLdFromHtml, extractUrlsFromJsonLd } from '../../../src/infrastructure/resource-discovery/JsonLdExtractor';

describe('JsonLdExtractor', () => {
  it('should extract JSON-LD entities from HTML', () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@context": "https://schema.org", "@type": "WebSite", "url": "https://example.com/"}
      </script>
    </head></html>`;
    const entities = extractJsonLdFromHtml(html);
    expect(entities.length).toBe(1);
    expect(entities[0]['@type']).toBe('WebSite');
  });

  it('should handle multiple JSON-LD blocks', () => {
    const html = `<html>
      <script type="application/ld+json">{"@type": "WebPage", "url": "/page1"}</script>
      <script type="application/ld+json">{"@type": "Article", "url": "/article1"}</script>
    </html>`;
    const entities = extractJsonLdFromHtml(html);
    expect(entities.length).toBe(2);
  });

  it('should handle JSON-LD arrays', () => {
    const html = `<script type="application/ld+json">[{"@type": "A"}, {"@type": "B"}]</script>`;
    const entities = extractJsonLdFromHtml(html);
    expect(entities.length).toBe(2);
  });

  it('should extract URLs from entities', () => {
    const entities = [
      {
        '@type': 'WebSite',
        url: 'https://example.com/',
        sameAs: ['https://facebook.com/example', 'https://twitter.com/example'],
        image: 'https://example.com/logo.png',
      },
    ];
    const urls = extractUrlsFromJsonLd(entities);
    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/logo.png');
    expect(urls).toContain('https://facebook.com/example');
  });

  it('should skip invalid JSON gracefully', () => {
    const html = `<script type="application/ld+json">{invalid}</script>`;
    const entities = extractJsonLdFromHtml(html);
    expect(entities.length).toBe(0);
  });
});
