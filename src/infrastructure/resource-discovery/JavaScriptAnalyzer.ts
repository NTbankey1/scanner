// Patterns commonly found in JS that reference URLs
const URL_PATTERNS = [
  /['"`](https?:\/\/[^'"`\s?#]+(?:\.(?:js|json|css|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|mp4|webm|wasm))[^'"`\s]*)['"`]/gi,
  /['"`](https?:\/\/[^'"`\s]+\/(?:api|graphql)[^'"`\s]*)['"`]/gi,
  /['"`](https?:\/\/[^'"`\s]+\/v[0-9]+\/[^'"`\s]*)['"`]/gi,
  /['"`](https?:\/\/[a-z0-9][^'"`\s]*)['"`]/gi,
  /['"`](\/[^'"`\s]+\.(?:js|json|css|png|jpg|svg|woff2?|ttf|eot|wasm))['"`]/gi,
  /['"`](\/[^'"`\s]+\/(?:api|graphql)[^'"`\s]*)['"`]/gi,
];

const IMPORT_PATTERNS = [
  /import\s+['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\/\/\s*<reference\s+path\s*=\s*['"]([^'"]+)['"]/g,
];

// Known CDN host patterns
const CDN_PATTERNS = [
  /cdn\./i, /cloudfront\.net/i, /cloudflare\.com/i,
  /akamai/i, /fastly/i, /jsdelivr\.net/i, /unpkg\.com/i,
  /cdnjs\.cloudflare\.com/i, /stackpathcdn\.com/i,
];

export function extractJsResources(jsText: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (rawUrl: string) => {
    try {
      const resolved = rawUrl.startsWith('/')
        ? new URL(rawUrl, pageUrl).href
        : rawUrl.startsWith('http')
          ? rawUrl
          : rawUrl.startsWith('./') || rawUrl.startsWith('../')
            ? new URL(rawUrl, pageUrl).href
            : rawUrl;

      if (!seen.has(resolved)) {
        seen.add(resolved);
        urls.push(resolved);
      }
    } catch {
      // skip invalid URLs
    }
  };

  // Find URL patterns
  for (const pattern of URL_PATTERNS) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(jsText)) !== null) {
      addUrl(match[1]);
    }
  }

  // Find import/require paths
  for (const pattern of IMPORT_PATTERNS) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(jsText)) !== null) {
      const path = match[1];
      if (path.startsWith('http') || path.startsWith('/') || path.startsWith('.')) {
        addUrl(path);
      }
    }
  }

  return urls;
}

export function containsCdnUrl(url: string): boolean {
  return CDN_PATTERNS.some(p => p.test(url));
}

export function guessFrameworkFromJs(jsText: string): string[] {
  const hints: string[] = [];
  if (/__NEXT_DATA__|next\./.test(jsText)) hints.push('Next.js');
  if (/__NUXT__|nuxt\./.test(jsText)) hints.push('Nuxt.js');
  if (/__REACT_DEVTOOLS|React\.createElement|ReactDOM/.test(jsText)) hints.push('React');
  if (/Vue\.component|createApp/.test(jsText)) hints.push('Vue');
  if (/angular\.|ng-app/.test(jsText)) hints.push('Angular');
  if (/\$\(|\.ajax|jQuery|jquery/.test(jsText)) hints.push('jQuery');
  return hints;
}
