export const DEFAULT_MAX_DEPTH = 5;
export const DEFAULT_MAX_URLS = 10000;
export const DEFAULT_RATE_LIMIT_MS = 300;
export const MAX_TABS_CONCURRENT = 5;
export const BATCH_SIZE = 50;
export const HEARTBEAT_INTERVAL_MS = 30000;
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;
export const CIRCUIT_BREAKER_THRESHOLD = 10;
export const CIRCUIT_BREAKER_RESET_MS = 300000;
export const FRONTIER_PERSIST_INTERVAL_MS = 5000;
export const DEBOUNCE_MS = 300;

export const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'msclkid', 'twclid',
]);

export const DEFAULT_PORTS: Array<{ scheme: string; port: number }> = [
  { scheme: 'http', port: 80 },
  { scheme: 'https', port: 443 },
];

export const RESOURCE_TYPE_PRIORITY: Record<string, number> = {
  HTML: 1.0,
  API: 0.8,
  CSS: 0.6,
  JAVASCRIPT: 0.6,
  Image: 0.3,
  Font: 0.2,
  Video: 0.2,
  Audio: 0.2,
  Document: 0.4,
  GraphQL: 0.7,
  WebSocket: 0.5,
  Other: 0.1,
};
