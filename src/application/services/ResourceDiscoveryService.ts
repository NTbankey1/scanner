import { ResourceType } from '../../shared/types';
import { extractCssResources, resolveCssUrl } from '../../infrastructure/resource-discovery/CssParser';
import { extractJsResources, guessFrameworkFromJs } from '../../infrastructure/resource-discovery/JavaScriptAnalyzer';
import { parseRobotsTxt } from '../../infrastructure/resource-discovery/RobotsTxtParser';
import { parseSitemapXml, guessSitemapUrl } from '../../infrastructure/resource-discovery/SitemapParser';
import { extractJsonLdFromHtml, extractUrlsFromJsonLd } from '../../infrastructure/resource-discovery/JsonLdExtractor';
import { logger } from '../../shared/logger';

export interface DiscoveredResource {
  url: string;
  sourceUrl: string;
  resourceType: ResourceType;
  discoveryMethod: 'html' | 'css' | 'js' | 'sitemap' | 'robots' | 'jsonld' | 'fetch' | 'websocket';
  metadata?: Record<string, unknown>;
}

export class ResourceDiscoveryService {
  async discoverFromCss(cssText: string, cssUrl: string): Promise<DiscoveredResource[]> {
    const rawUrls = extractCssResources(cssText);
    return rawUrls.map(url => ({
      url: resolveCssUrl(cssUrl, url),
      sourceUrl: cssUrl,
      resourceType: ResourceType.CSS,
      discoveryMethod: 'css' as const,
    }));
  }

  async discoverFromJavaScript(jsText: string, jsUrl: string): Promise<DiscoveredResource[]> {
    const rawUrls = extractJsResources(jsText, jsUrl);
    const discovered: DiscoveredResource[] = rawUrls.map(url => ({
      url,
      sourceUrl: jsUrl,
      resourceType: ResourceType.JavaScript,
      discoveryMethod: 'js' as const,
    }));

    // Framework hints
    const frameworks = guessFrameworkFromJs(jsText);
    if (frameworks.length > 0) {
      logger.debug('ResourceDiscovery', `Frameworks detected: ${frameworks.join(', ')}`);
    }

    return discovered;
  }

  async discoverFromRobotsTxt(robotsTxt: string, baseUrl: string): Promise<DiscoveredResource[]> {
    const rules = parseRobotsTxt(robotsTxt);
    const discovered: DiscoveredResource[] = [];

    // Sitemaps from robots.txt
    for (const sitemapUrl of rules.sitemaps) {
      discovered.push({
        url: sitemapUrl,
        sourceUrl: `${baseUrl}/robots.txt`,
        resourceType: ResourceType.Document,
        discoveryMethod: 'robots' as const,
        metadata: { type: 'sitemap' },
      });
    }

    return discovered;
  }

  async discoverFromSitemap(sitemapXml: string, sitemapUrl: string): Promise<DiscoveredResource[]> {
    const entries = parseSitemapXml(sitemapXml);
    return entries.map(entry => ({
      url: entry.loc,
      sourceUrl: sitemapUrl,
      resourceType: ResourceType.HTML,
      discoveryMethod: 'sitemap' as const,
      metadata: {
        lastmod: entry.lastmod,
        changefreq: entry.changefreq,
        priority: entry.priority,
      },
    }));
  }

  async discoverFromJsonLd(html: string, pageUrl: string): Promise<DiscoveredResource[]> {
    const entities = extractJsonLdFromHtml(html);
    if (entities.length === 0) return [];

    const rawUrls = extractUrlsFromJsonLd(entities);

    return rawUrls.map(url => {
      // Resolve relative URLs
      const resolved = url.startsWith('/') ? (() => {
        try { return new URL(url, pageUrl).href; } catch { return url; }
      })() : url;

      return {
        url: resolved,
        sourceUrl: pageUrl,
        resourceType: ResourceType.Document,
        discoveryMethod: 'jsonld' as const,
        metadata: { entityTypes: entities.map(e => e['@type']) },
      };
    });
  }

  async discoverSitemapGuesses(baseUrl: string): Promise<DiscoveredResource[]> {
    const guesses = guessSitemapUrl(baseUrl);
    return guesses.map(url => ({
      url,
      sourceUrl: baseUrl,
      resourceType: ResourceType.Document,
      discoveryMethod: 'sitemap' as const,
      metadata: { guessed: true },
    }));
  }

  async fetchAndParse(url: string): Promise<{ text: string; contentType: string } | null> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return null;

      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      return { text, contentType };
    } catch (err) {
      logger.debug('ResourceDiscovery', `Failed to fetch ${url}: ${String(err)}`);
      return null;
    }
  }
}
