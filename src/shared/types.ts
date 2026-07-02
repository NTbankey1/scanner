export enum CrawlJobState {
  Idle = 'IDLE',
  Running = 'RUNNING',
  Paused = 'PAUSED',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum ResourceType {
  HTML = 'HTML',
  CSS = 'CSS',
  JavaScript = 'JAVASCRIPT',
  Image = 'IMAGE',
  Font = 'FONT',
  Video = 'VIDEO',
  Audio = 'AUDIO',
  API = 'API',
  GraphQL = 'GRAPHQL',
  WebSocket = 'WEBSOCKET',
  Document = 'DOCUMENT',
  Other = 'OTHER',
}

export enum ResourceStatus {
  Discovered = 'DISCOVERED',
  Pending = 'PENDING',
  Fetched = 'FETCHED',
  Failed = 'FAILED',
  Skipped = 'SKIPPED',
}

export enum DomainScope {
  SameOrigin = 'SAME_ORIGIN',
  SameDomain = 'SAME_DOMAIN',
  SameDomainPlusList = 'SAME_DOMAIN_PLUS_LIST',
  Unrestricted = 'UNRESTRICTED',
}

export interface CrawlConfig {
  maxDepth: number;
  maxUrls: number;
  domainScope: DomainScope;
  extraDomains: string[];
  rateLimitMs: number;
  respectRobotsTxt: boolean;
}

export interface CrawlStats {
  urlsScanned: number;
  urlsFound: number;
  urlsFailed: number;
  startTime: number;
  endTime?: number;
}

export type CrawlEventType =
  | 'URL_DISCOVERED'
  | 'CRAWL_PROGRESS'
  | 'URL_ERROR'
  | 'CRAWL_COMPLETED'
  | 'CRAWL_FAILED'
  | 'CRAWL_STARTED'
  | 'CRAWL_PAUSED';

export interface CrawlEvent {
  type: CrawlEventType;
  jobId: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export type CrawlCommand =
  | { type: 'START'; jobId: string; config?: Record<string, unknown> }
  | { type: 'PAUSE'; jobId: string }
  | { type: 'RESUME'; jobId: string }
  | { type: 'CANCEL'; jobId: string };

export interface SerializedFrontier {
  items: Array<{ url: string; priority: number }>;
}
