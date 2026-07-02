export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export function parseSitemapXml(xmlText: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Check if sitemap index
  if (/<sitemap>/i.test(xmlText)) {
    const locPattern = /<loc[^>]*>([^<]+)<\/loc>/gi;
    let match: RegExpExecArray | null;
    while ((match = locPattern.exec(xmlText)) !== null) {
      entries.push({ loc: match[1].trim() });
    }
    return entries;
  }

  // Parse each <url> block
  const urlBlockPattern = /<url>([\s\S]*?)<\/url>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = urlBlockPattern.exec(xmlText)) !== null) {
    const block = blockMatch[1];
    const entry: SitemapEntry = { loc: '' };

    const locMatch = /<loc[^>]*>([^<]+)<\/loc>/i.exec(block);
    if (locMatch) entry.loc = locMatch[1].trim();

    const lastmodMatch = /<lastmod[^>]*>([^<]+)<\/lastmod>/i.exec(block);
    if (lastmodMatch) entry.lastmod = lastmodMatch[1].trim();

    const changefreqMatch = /<changefreq[^>]*>([^<]+)<\/changefreq>/i.exec(block);
    if (changefreqMatch) entry.changefreq = changefreqMatch[1].trim();

    const priorityMatch = /<priority[^>]*>([^<]+)<\/priority>/i.exec(block);
    if (priorityMatch) {
      const p = parseFloat(priorityMatch[1].trim());
      entry.priority = isNaN(p) ? undefined : p;
    }

    if (entry.loc) entries.push(entry);
  }

  return entries;
}

export function findSitemapUrls(robotsTxt: string): string[] {
  const urls: string[] = [];
  const pattern = /Sitemap:\s*(.+)$/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(robotsTxt)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

export function guessSitemapUrl(baseUrl: string): string[] {
  const url = new URL(baseUrl);
  const origin = url.origin;
  return [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap/`,
    `${origin}/sitemap/index.xml`,
  ];
}
