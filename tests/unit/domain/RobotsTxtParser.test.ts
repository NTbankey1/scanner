import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, isPathDisallowed } from '../../../src/infrastructure/resource-discovery/RobotsTxtParser';

describe('RobotsTxtParser', () => {
  it('should parse basic rules', () => {
    const text = `User-agent: *
      Disallow: /admin
      Disallow: /private
      Allow: /public
      Sitemap: https://example.com/sitemap.xml
      Crawl-delay: 5`;
    const rules = parseRobotsTxt(text);
    expect(rules.sitemaps).toContain('https://example.com/sitemap.xml');
    expect(rules.crawlDelay).toBe(5);
  });

  it('should detect disallowed paths', () => {
    const text = `User-agent: *
      Disallow: /admin`;
    const rules = parseRobotsTxt(text);
    expect(isPathDisallowed('/admin', rules)).toBe(true);
    expect(isPathDisallowed('/public', rules)).toBe(false);
  });

  it('should respect allow over disallow', () => {
    const text = `User-agent: *
      Disallow: /admin
      Allow: /admin/public`;
    const rules = parseRobotsTxt(text);
    expect(isPathDisallowed('/admin/public', rules)).toBe(false);
    expect(isPathDisallowed('/admin/private', rules)).toBe(true);
  });

  it('should handle allow all', () => {
    const text = `User-agent: *
      Disallow:`;
    const rules = parseRobotsTxt(text);
    expect(isPathDisallowed('/anything', rules)).toBe(false);
  });

  it('should handle disallow all', () => {
    const text = `User-agent: *
      Disallow: /`;
    const rules = parseRobotsTxt(text);
    expect(isPathDisallowed('/anything', rules)).toBe(true);
  });

  it('should parse per-agent rules', () => {
    const text = `
      User-agent: Googlebot
      Disallow: /private

      User-agent: *
      Allow: /`;
    const rules = parseRobotsTxt(text);
    expect(rules.userAgentRules.has('googlebot')).toBe(true);
    expect(rules.userAgentRules.has('*')).toBe(true);
  });
});
