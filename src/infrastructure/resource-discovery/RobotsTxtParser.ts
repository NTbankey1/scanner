export interface RobotsTxtRules {
  sitemaps: string[];
  disallowedPaths: string[];
  allowedPaths: string[];
  crawlDelay: number;
  userAgentRules: Map<string, { disallow: string[]; allow: string[] }>;
}

const DEFAULT_USER_AGENT = '*';

export function parseRobotsTxt(text: string): RobotsTxtRules {
  const rules: RobotsTxtRules = {
    sitemaps: [],
    disallowedPaths: [],
    allowedPaths: [],
    crawlDelay: 0,
    userAgentRules: new Map(),
  };

  let currentAgent = DEFAULT_USER_AGENT;
  const lines = text.split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const field = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    switch (field) {
      case 'user-agent':
        currentAgent = value.toLowerCase();
        if (!rules.userAgentRules.has(currentAgent)) {
          rules.userAgentRules.set(currentAgent, { disallow: [], allow: [] });
        }
        break;
      case 'disallow':
        if (!rules.userAgentRules.has(currentAgent)) {
          rules.userAgentRules.set(currentAgent, { disallow: [], allow: [] });
        }
        rules.userAgentRules.get(currentAgent)!.disallow.push(value);
        if (currentAgent === DEFAULT_USER_AGENT) {
          rules.disallowedPaths.push(value);
        }
        break;
      case 'allow':
        if (!rules.userAgentRules.has(currentAgent)) {
          rules.userAgentRules.set(currentAgent, { disallow: [], allow: [] });
        }
        rules.userAgentRules.get(currentAgent)!.allow.push(value);
        if (currentAgent === DEFAULT_USER_AGENT) {
          rules.allowedPaths.push(value);
        }
        break;
      case 'sitemap':
        rules.sitemaps.push(value);
        break;
      case 'crawl-delay':
        const delay = parseInt(value, 10);
        if (!isNaN(delay)) {
          if (currentAgent === DEFAULT_USER_AGENT) {
            rules.crawlDelay = delay;
          }
        }
        break;
    }
  }

  return rules;
}

export function isPathDisallowed(path: string, rules: RobotsTxtRules, userAgent = '*'): boolean {
  const agentRules = rules.userAgentRules.get(userAgent) || rules.userAgentRules.get(DEFAULT_USER_AGENT);
  if (!agentRules) return false;

  // Allow takes precedence over disallow
  for (const allow of agentRules.allow) {
    if (path.startsWith(allow)) return false;
  }

  for (const disallow of agentRules.disallow) {
    if (disallow === '') return false; // Empty = allow all
    if (disallow === '/') return true;  // Disallow all
    if (path.startsWith(disallow)) return true;
  }

  return false;
}
