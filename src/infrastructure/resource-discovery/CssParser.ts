const CSS_URL_PATTERN = /url\((?:['"]?)([^'")\s]+)(?:['"]?)\)/g;
const CSS_IMPORT_PATTERN = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]\s*\)?\s*;/g;

export function extractCssResources(cssText: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (u: string) => {
    const trimmed = u.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      urls.push(trimmed);
    }
  };

  // url() references
  let match: RegExpExecArray | null;
  while ((match = CSS_URL_PATTERN.exec(cssText)) !== null) {
    addUrl(match[1]);
  }

  // @import
  while ((match = CSS_IMPORT_PATTERN.exec(cssText)) !== null) {
    addUrl(match[1]);
  }

  return urls;
}

export function resolveCssUrl(baseUrl: string, relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://') || relativeUrl.startsWith('data:')) {
    return relativeUrl;
  }
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}
