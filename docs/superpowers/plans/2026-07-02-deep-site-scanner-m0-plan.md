# Deep Site Scanner M0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish project skeleton, domain layer, storage abstraction, messaging infrastructure, and service worker lifecycle.

**Architecture:** 4-layer Clean Architecture with strict dependency rule — Domain never imports chrome.\* APIs. Infrastructure is the only layer that calls chrome.\* / DOM / fetch APIs. Application use cases orchestrate domain objects via repository interfaces.

**Tech Stack:** TypeScript 5.x, Vite 6.x (multi-entry), Vitest, Chrome Extension Manifest V3

**Build entries:** background service worker, content script, offscreen document, popup HTML, sidepanel HTML.

---

## File Structure

```
deep-site-scanner/
├── manifest.json                          # MV3 manifest
├── package.json                           # Dependencies + scripts
├── tsconfig.json                          # TypeScript config
├── vite.config.ts                         # Multi-entry Vite build
├── vitest.config.ts                       # Test config
├── .gitignore
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── CrawlJob.ts                # State machine
│   │   │   ├── ResourceNode.ts            # Composite
│   │   │   └── UrlFrontier.ts             # Binary heap priority queue
│   │   ├── value-objects/
│   │   │   ├── NormalizedUrl.ts           # URL normalization
│   │   │   ├── ResourceType.ts            # Enum + helpers
│   │   │   └── CrawlDepth.ts              # Value object
│   │   └── services/
│   │       ├── DedupPolicy.ts             # URL dedup
│   │       ├── DomainScopePolicy.ts       # Scope restriction
│   │       ├── UrlFilterChain.ts          # Chain of Responsibility
│   │       └── PriorityCalculator.ts      # Priority formula
│   ├── application/
│   │   ├── interfaces.ts                  # Repository interfaces
│   │   └── use-cases/
│   │       ├── StartCrawlUseCase.ts
│   │       └── StopCrawlUseCase.ts
│   ├── infrastructure/
│   │   ├── background/
│   │   │   ├── service-worker.ts          # Entry point
│   │   │   ├── CrawlScheduler.ts          # Orchestrator
│   │   │   └── MessageRouter.ts           # Mediator
│   │   ├── messaging/
│   │   │   ├── EventBus.ts                # Observer pattern
│   │   │   └── PortManager.ts             # Long-lived ports
│   │   ├── storage/
│   │   │   ├── ChromeStorageSessionRepository.ts
│   │   │   ├── ChromeStorageLocalRepository.ts
│   │   │   └── IndexedDbRepository.ts
│   │   ├── content-script/
│   │   │   └── index.ts                   # Stub
│   │   └── offscreen/
│   │       └── index.ts                   # Stub
│   └── shared/
│       ├── types.ts
│       ├── constants.ts
│       └── logger.ts
├── tests/
│   ├── unit/
│   │   ├── domain/
│   │   │   ├── CrawlJob.test.ts
│   │   │   ├── NormalizedUrl.test.ts
│   │   │   ├── UrlFrontier.test.ts
│   │   │   ├── ResourceNode.test.ts
│   │   │   ├── CrawlDepth.test.ts
│   │   │   ├── PriorityCalculator.test.ts
│   │   │   ├── DedupPolicy.test.ts
│   │   │   ├── DomainScopePolicy.test.ts
│   │   │   └── UrlFilterChain.test.ts
│   │   └── application/
│   │       ├── StartCrawlUseCase.test.ts
│   │       └── StopCrawlUseCase.test.ts
│   └── integration/
│       └── storage/
│           └── ChromeStorageRepository.test.ts
└── docs/
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `manifest.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: build pipeline for all subsequent tasks

- [ ] **Step 1: Create package.json**

```json
{
  "name": "deep-site-scanner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0",
    "@crxjs/vite-plugin": "^2.0.0",
    "@types/chrome": "^0.0.270"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["chrome"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: 'src/infrastructure/background/service-worker.ts',
        'content-script': 'src/infrastructure/content-script/index.ts',
        offscreen: 'src/infrastructure/offscreen/index.ts',
      },
    },
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Deep Site Scanner",
  "version": "0.1.0",
  "description": "Professional deep site scanner — crawl, discover resources, export results",
  "permissions": [
    "storage",
    "scripting",
    "tabs",
    "webNavigation",
    "downloads",
    "offscreen",
    "alarms",
    "contextMenus",
    "sidePanel",
    "notifications"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/infrastructure/background/service-worker.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/presentation/popup/index.html"
  },
  "options_page": "src/presentation/options/index.html",
  "side_panel": {
    "default_path": "src/presentation/sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/infrastructure/content-script/index.ts"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ]
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
*.local.json
.DS_Store
```

- [ ] **Step 7: Install and verify**

```bash
npm install
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts manifest.json .gitignore
git commit -m "chore: scaffold project with Vite + TypeScript + MV3 manifest"
```

---

### Task 2: Shared Types, Constants, Logger

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`
- Create: `src/shared/logger.ts`

**Interfaces:**
- Consumes: nothing
- Produces: types/enums used by ALL subsequent tasks

- [ ] **Step 1: Create types.ts**

```typescript
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
```

- [ ] **Step 2: Create constants.ts**

```typescript
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
```

- [ ] **Step 3: Create logger.ts**

```typescript
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

const LOG_LEVEL_KEY = 'dss:loglevel';

class Logger {
  private level: LogLevel = LogLevel.Info;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Debug) {
      console.debug(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  info(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Info) {
      console.info(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  warn(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Warn) {
      console.warn(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  error(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Error) {
      console.error(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  async persistLevel(): Promise<void> {
    try {
      await chrome.storage.local.set({ [LOG_LEVEL_KEY]: this.level });
    } catch {
      // Storage not available in test environment
    }
  }

  async loadLevel(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(LOG_LEVEL_KEY);
      if (result[LOG_LEVEL_KEY] !== undefined) {
        this.level = result[LOG_LEVEL_KEY] as LogLevel;
      }
    } catch {
      // Storage not available in test environment
    }
  }
}

export const logger = new Logger();
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types, constants, and logger"
```

---

### Task 3: Domain Value Objects

**Files:**
- Create: `src/domain/value-objects/CrawlDepth.ts`
- Create: `src/domain/value-objects/NormalizedUrl.ts`
- Create: `src/domain/value-objects/ResourceType.ts`
- Test: `tests/unit/domain/CrawlDepth.test.ts`
- Test: `tests/unit/domain/NormalizedUrl.test.ts`

**Interfaces:**
- Consumes: `src/shared/types.ts`, `src/shared/constants.ts`
- Produces: NormalizedUrl, CrawlDepth, ResourceType utilities used by all entities and services

- [ ] **Step 1: Write CrawlDepth test**

```typescript
// tests/unit/domain/CrawlDepth.test.ts
import { describe, it, expect } from 'vitest';
import { CrawlDepth } from '../../../src/domain/value-objects/CrawlDepth';

describe('CrawlDepth', () => {
  it('should create from valid number', () => {
    const depth = new CrawlDepth(3);
    expect(depth.value).toBe(3);
  });

  it('should create depth 0', () => {
    const depth = new CrawlDepth(0);
    expect(depth.value).toBe(0);
  });

  it('should throw for negative depth', () => {
    expect(() => new CrawlDepth(-1)).toThrow('CrawlDepth cannot be negative');
  });

  it('should create next depth', () => {
    const depth = new CrawlDepth(2);
    const next = depth.next();
    expect(next.value).toBe(3);
  });

  it('should throw on next() if at max', () => {
    const depth = new CrawlDepth(CrawlDepth.MAX);
    expect(() => depth.next()).toThrow('Max crawl depth reached');
  });

  it('should equal same depth', () => {
    const a = new CrawlDepth(5);
    const b = new CrawlDepth(5);
    expect(a.equals(b)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement CrawlDepth**

```typescript
// src/domain/value-objects/CrawlDepth.ts
export class CrawlDepth {
  static readonly MAX = 255;

  constructor(readonly value: number) {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error('CrawlDepth cannot be negative and must be an integer');
    }
  }

  next(): CrawlDepth {
    if (this.value >= CrawlDepth.MAX) {
      throw new Error('Max crawl depth reached');
    }
    return new CrawlDepth(this.value + 1);
  }

  equals(other: CrawlDepth): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
```

- [ ] **Step 3: Write NormalizedUrl test**

```typescript
// tests/unit/domain/NormalizedUrl.test.ts
import { describe, it, expect } from 'vitest';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('NormalizedUrl', () => {
  it('should lowercase scheme and host', () => {
    const url = new NormalizedUrl('HTTPS://EXAMPLE.COM/Path');
    expect(url.toString()).toBe('https://example.com/Path');
  });

  it('should strip fragment', () => {
    const url = new NormalizedUrl('https://example.com/page#section');
    expect(url.toString()).toBe('https://example.com/page');
  });

  it('should strip trailing slash except root', () => {
    const withSlash = new NormalizedUrl('https://example.com/page/');
    expect(withSlash.toString()).toBe('https://example.com/page');
    const root = new NormalizedUrl('https://example.com/');
    expect(root.toString()).toBe('https://example.com/');
  });

  it('should remove default ports', () => {
    const http = new NormalizedUrl('https://example.com:443/page');
    expect(http.toString()).toBe('https://example.com/page');
    const nonDefault = new NormalizedUrl('https://example.com:8080/page');
    expect(nonDefault.toString()).toBe('https://example.com:8080/page');
  });

  it('should sort and strip tracking params', () => {
    const url = new NormalizedUrl('https://example.com/page?a=1&utm_source=twitter&b=2');
    expect(url.toString()).toBe('https://example.com/page?a=1&b=2');
  });

  it('should treat same URL as equal', () => {
    const a = new NormalizedUrl('https://Example.COM/Path/');
    const b = new NormalizedUrl('https://example.com/Path');
    expect(a.equals(b)).toBe(true);
  });

  it('should return origin', () => {
    const url = new NormalizedUrl('https://example.com/page');
    expect(url.origin).toBe('https://example.com');
  });

  it('should return hostname', () => {
    const url = new NormalizedUrl('https://blog.example.com/page');
    expect(url.hostname).toBe('blog.example.com');
  });

  it('should throw for invalid URL', () => {
    expect(() => new NormalizedUrl('not-a-url')).toThrow();
  });
});
```

- [ ] **Step 4: Implement NormalizedUrl**

```typescript
// src/domain/value-objects/NormalizedUrl.ts
import { TRACKING_PARAMS, DEFAULT_PORTS } from '../../shared/constants';

export class NormalizedUrl {
  readonly normalized: string;
  readonly origin: string;
  readonly hostname: string;
  private readonly _url: URL;

  constructor(raw: string) {
    this._url = new URL(raw);
    this.hostname = this._url.hostname.toLowerCase();
    const portStr = this._url.port ? `:${this._url.port}` : '';
    this.origin = `${this._url.protocol}//${this.hostname}${portStr}`;
    this.normalized = this.normalize();
  }

  private normalize(): string {
    const url = this._url;
    let result = `${url.protocol}//${url.hostname.toLowerCase()}`;

    const hasDefaultPort = DEFAULT_PORTS.some(
      dp => dp.scheme === url.protocol.replace(':', '') && dp.port === Number(url.port)
    );
    if (url.port && !hasDefaultPort) {
      result += `:${url.port}`;
    }

    const path = url.pathname;
    result += path.length > 1 ? path.replace(/\/$/, '') : (path || '/');

    const params = new URLSearchParams(url.search);
    const cleanParams: string[] = [];
    for (const [key, val] of params.entries()) {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        cleanParams.push(`${key}=${val}`);
      }
    }
    cleanParams.sort();
    if (cleanParams.length > 0) {
      result += '?' + cleanParams.join('&');
    }

    return result;
  }

  equals(other: NormalizedUrl): boolean {
    return this.normalized === other.normalized;
  }

  toString(): string {
    return this.normalized;
  }

  toJSON(): string {
    return this.normalized;
  }
}
```

- [ ] **Step 5: Create ResourceType helpers**

```typescript
// src/domain/value-objects/ResourceType.ts
import { ResourceType } from '../../shared/types';
import { RESOURCE_TYPE_PRIORITY } from '../../shared/constants';

const EXTENSION_MAP: Record<string, ResourceType> = {
  '.html': ResourceType.HTML,
  '.htm': ResourceType.HTML,
  '.css': ResourceType.CSS,
  '.js': ResourceType.JavaScript,
  '.mjs': ResourceType.JavaScript,
  '.jpg': ResourceType.Image,
  '.jpeg': ResourceType.Image,
  '.png': ResourceType.Image,
  '.gif': ResourceType.Image,
  '.svg': ResourceType.Image,
  '.webp': ResourceType.Image,
  '.ico': ResourceType.Image,
  '.woff': ResourceType.Font,
  '.woff2': ResourceType.Font,
  '.ttf': ResourceType.Font,
  '.eot': ResourceType.Font,
  '.mp4': ResourceType.Video,
  '.webm': ResourceType.Video,
  '.mp3': ResourceType.Audio,
  '.wav': ResourceType.Audio,
  '.ogg': ResourceType.Audio,
  '.pdf': ResourceType.Document,
  '.xml': ResourceType.Document,
  '.json': ResourceType.API,
};

export function detectResourceType(url: string): ResourceType {
  const lower = url.toLowerCase();
  for (const [ext, type] of Object.entries(EXTENSION_MAP)) {
    if (lower.includes(ext)) return type;
  }
  if (url.includes('/graphql') || url.includes('/api/')) return ResourceType.API;
  if (url.startsWith('ws://') || url.startsWith('wss://')) return ResourceType.WebSocket;
  return ResourceType.Other;
}

export function getPriorityMultiplier(type: ResourceType): number {
  return RESOURCE_TYPE_PRIORITY[type] ?? 0.1;
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run tests/unit/domain/CrawlDepth.test.ts tests/unit/domain/NormalizedUrl.test.ts
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/domain/value-objects/ tests/unit/domain/CrawlDepth.test.ts tests/unit/domain/NormalizedUrl.test.ts
git commit -m "feat: add domain value objects — NormalizedUrl, CrawlDepth, ResourceType"
```

---

### Task 4: Domain Entity — CrawlJob (State Machine)

**Files:**
- Create: `src/domain/entities/CrawlJob.ts`
- Test: `tests/unit/domain/CrawlJob.test.ts`

**Interfaces:**
- Consumes: `CrawlConfig`, `CrawlStats`, `CrawlJobState` from shared/types, `NormalizedUrl`
- Produces: `CrawlJob` class used by use cases and scheduler

- [ ] **Step 1: Write CrawlJob test**

```typescript
// tests/unit/domain/CrawlJob.test.ts
import { describe, it, expect } from 'vitest';
import { CrawlJob } from '../../../src/domain/entities/CrawlJob';
import { CrawlJobState, DomainScope } from '../../../src/shared/types';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

function makeConfig(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    maxDepth: 3,
    maxUrls: 100,
    domainScope: DomainScope.SameOrigin,
    extraDomains: [],
    rateLimitMs: 300,
    respectRobotsTxt: true,
    ...overrides,
  };
}

describe('CrawlJob', () => {
  it('should create in Idle state', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    expect(job.state).toBe(CrawlJobState.Idle);
    expect(job.stats.urlsScanned).toBe(0);
  });

  it('should start: Idle → Running', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    expect(job.state).toBe(CrawlJobState.Running);
    expect(job.stats.startTime).toBeGreaterThan(0);
  });

  it('should throw start() if not Idle', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    expect(() => job.start()).toThrow('Cannot transition job from RUNNING to RUNNING');
  });

  it('should pause: Running → Paused', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.pause();
    expect(job.state).toBe(CrawlJobState.Paused);
  });

  it('should resume: Paused → Running', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.pause();
    job.resume();
    expect(job.state).toBe(CrawlJobState.Running);
  });

  it('should complete: Running → Completed', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.complete();
    expect(job.state).toBe(CrawlJobState.Completed);
    expect(job.stats.endTime).toBeDefined();
  });

  it('should fail: Running → Failed', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.fail();
    expect(job.state).toBe(CrawlJobState.Failed);
  });

  it('should cancel from Running', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.cancel();
    expect(job.state).toBe(CrawlJobState.Cancelled);
  });

  it('should cancel from Paused', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    job.start();
    job.pause();
    job.cancel();
    expect(job.state).toBe(CrawlJobState.Cancelled);
  });

  it('should detect active state', () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), makeConfig());
    expect(job.isActive()).toBe(false);
    job.start();
    expect(job.isActive()).toBe(true);
    job.pause();
    expect(job.isActive()).toBe(true);
    job.complete();
    expect(job.isActive()).toBe(false);
  });
});
```

- [ ] **Step 2: Implement CrawlJob**

```typescript
// src/domain/entities/CrawlJob.ts
import { CrawlJobState, CrawlConfig, CrawlStats } from '../../shared/types';
import { NormalizedUrl } from '../value-objects/NormalizedUrl';

const TRANSITIONS: Record<CrawlJobState, CrawlJobState[]> = {
  [CrawlJobState.Idle]: [CrawlJobState.Running],
  [CrawlJobState.Running]: [CrawlJobState.Paused, CrawlJobState.Completed, CrawlJobState.Failed, CrawlJobState.Cancelled],
  [CrawlJobState.Paused]: [CrawlJobState.Running, CrawlJobState.Cancelled],
  [CrawlJobState.Completed]: [],
  [CrawlJobState.Failed]: [],
  [CrawlJobState.Cancelled]: [],
};

export class CrawlJob {
  readonly id: string;
  readonly startUrl: NormalizedUrl;
  readonly config: CrawlConfig;
  state: CrawlJobState;
  stats: CrawlStats;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(id: string, startUrl: NormalizedUrl, config: CrawlConfig) {
    this.id = id;
    this.startUrl = startUrl;
    this.config = config;
    this.state = CrawlJobState.Idle;
    this.stats = { urlsScanned: 0, urlsFound: 0, urlsFailed: 0, startTime: 0 };
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  private transition(to: CrawlJobState): void {
    const allowed = TRANSITIONS[this.state];
    if (!allowed.includes(to)) {
      throw new Error(`Cannot transition job from ${this.state} to ${to}`);
    }
    this.state = to;
    this.updatedAt = new Date();
  }

  start(): void { this.transition(CrawlJobState.Running); this.stats.startTime = Date.now(); }
  pause(): void { this.transition(CrawlJobState.Paused); }
  resume(): void { this.transition(CrawlJobState.Running); }
  complete(): void { this.transition(CrawlJobState.Completed); this.stats.endTime = Date.now(); }
  fail(): void { this.transition(CrawlJobState.Failed); this.stats.endTime = Date.now(); }
  cancel(): void { this.transition(CrawlJobState.Cancelled); this.stats.endTime = Date.now(); }

  incrementScanned(): void { this.stats.urlsScanned++; }
  incrementFound(): void { this.stats.urlsFound++; }
  incrementFailed(): void { this.stats.urlsFailed++; }

  isActive(): boolean {
    return this.state === CrawlJobState.Running || this.state === CrawlJobState.Paused;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      startUrl: this.startUrl.toString(),
      state: this.state,
      config: this.config,
      stats: this.stats,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/domain/CrawlJob.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/entities/CrawlJob.ts tests/unit/domain/CrawlJob.test.ts
git commit -m "feat: add CrawlJob entity with state machine"
```

---

### Task 5: Domain Entity — UrlFrontier (Binary Heap Priority Queue)

**Files:**
- Create: `src/domain/entities/UrlFrontier.ts`
- Test: `tests/unit/domain/UrlFrontier.test.ts`

**Interfaces:**
- Consumes: `NormalizedUrl`, `SerializedFrontier` from shared/types
- Produces: `UrlFrontier` — priority queue used by crawl scheduler

- [ ] **Step 1: Write UrlFrontier test**

```typescript
// tests/unit/domain/UrlFrontier.test.ts
import { describe, it, expect } from 'vitest';
import { UrlFrontier } from '../../../src/domain/entities/UrlFrontier';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('UrlFrontier', () => {
  it('should be empty initially', () => {
    const f = new UrlFrontier();
    expect(f.isEmpty()).toBe(true);
    expect(f.size()).toBe(0);
  });

  it('should dequeue highest priority first', () => {
    const f = new UrlFrontier();
    f.enqueue(new NormalizedUrl('https://example.com/low'), 1);
    f.enqueue(new NormalizedUrl('https://example.com/high'), 10);
    f.enqueue(new NormalizedUrl('https://example.com/med'), 5);
    expect(f.dequeue()?.normalized).toBe('https://example.com/high');
    expect(f.dequeue()?.normalized).toBe('https://example.com/med');
    expect(f.dequeue()?.normalized).toBe('https://example.com/low');
  });

  it('should return null when empty', () => {
    const f = new UrlFrontier();
    expect(f.dequeue()).toBeNull();
  });

  it('should peek without removing', () => {
    const f = new UrlFrontier();
    f.enqueue(new NormalizedUrl('https://example.com/a'), 5);
    f.enqueue(new NormalizedUrl('https://example.com/b'), 10);
    expect(f.peek()?.normalized).toBe('https://example.com/b');
    expect(f.size()).toBe(2);
  });

  it('should remove by value', () => {
    const f = new UrlFrontier();
    const target = new NormalizedUrl('https://example.com/target');
    f.enqueue(new NormalizedUrl('https://example.com/a'), 1);
    f.enqueue(target, 5);
    f.enqueue(new NormalizedUrl('https://example.com/b'), 3);
    expect(f.remove(target)).toBe(true);
    expect(f.size()).toBe(2);
    expect(f.remove(new NormalizedUrl('https://example.com/nonexistent'))).toBe(false);
  });

  it('should serialize and deserialize', () => {
    const f = new UrlFrontier();
    f.enqueue(new NormalizedUrl('https://example.com/a'), 5);
    f.enqueue(new NormalizedUrl('https://example.com/b'), 3);
    const json = f.toJSON();
    const restored = UrlFrontier.fromJSON(json);
    expect(restored.size()).toBe(2);
    expect(restored.dequeue()?.normalized).toBe('https://example.com/a');
  });
});
```

- [ ] **Step 2: Implement UrlFrontier**

```typescript
// src/domain/entities/UrlFrontier.ts
import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import type { SerializedFrontier } from '../../shared/types';

interface FrontierEntry {
  url: NormalizedUrl;
  priority: number;
}

export class UrlFrontier {
  private heap: FrontierEntry[] = [];

  enqueue(url: NormalizedUrl, priority: number): void {
    this.heap.push({ url, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): NormalizedUrl | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top.url;
  }

  peek(): NormalizedUrl | null {
    return this.heap.length > 0 ? this.heap[0].url : null;
  }

  size(): number { return this.heap.length; }
  isEmpty(): boolean { return this.heap.length === 0; }

  remove(url: NormalizedUrl): boolean {
    const idx = this.heap.findIndex(e => e.url.equals(url));
    if (idx === -1) return false;
    const last = this.heap.pop()!;
    if (idx < this.heap.length) {
      this.heap[idx] = last;
      this.sinkDown(idx);
      this.bubbleUp(idx);
    }
    return true;
  }

  toJSON(): SerializedFrontier {
    return { items: this.heap.map(e => ({ url: e.url.toString(), priority: e.priority })) };
  }

  static fromJSON(data: SerializedFrontier): UrlFrontier {
    const f = new UrlFrontier();
    for (const item of data.items) {
      f.enqueue(new NormalizedUrl(item.url), item.priority);
    }
    return f;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[parent].priority >= this.heap[idx].priority) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      let largest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.heap[left].priority > this.heap[largest].priority) largest = left;
      if (right < length && this.heap[right].priority > this.heap[largest].priority) largest = right;
      if (largest === idx) break;
      [this.heap[idx], this.heap[largest]] = [this.heap[largest], this.heap[idx]];
      idx = largest;
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/domain/UrlFrontier.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/entities/UrlFrontier.ts tests/unit/domain/UrlFrontier.test.ts
git commit -m "feat: add UrlFrontier with binary heap priority queue"
```

---

### Task 6: Domain Entity — ResourceNode (Composite)

**Files:**
- Create: `src/domain/entities/ResourceNode.ts`
- Test: `tests/unit/domain/ResourceNode.test.ts`

**Interfaces:**
- Consumes: NormalizedUrl, CrawlDepth, ResourceType, ResourceStatus
- Produces: ResourceNode — used by use cases and storage

- [ ] **Step 1: Write ResourceNode test**

```typescript
// tests/unit/domain/ResourceNode.test.ts
import { describe, it, expect } from 'vitest';
import { ResourceNode } from '../../../src/domain/entities/ResourceNode';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { CrawlDepth } from '../../../src/domain/value-objects/CrawlDepth';
import { ResourceType, ResourceStatus } from '../../../src/shared/types';

describe('ResourceNode', () => {
  it('should create with default status DISCOVERED', () => {
    const node = new ResourceNode('r1', new NormalizedUrl('https://example.com/page'), ResourceType.HTML, new CrawlDepth(0));
    expect(node.status).toBe(ResourceStatus.Discovered);
    expect(node.children).toEqual([]);
  });

  it('should add children', () => {
    const parent = new ResourceNode('p1', new NormalizedUrl('https://example.com'), ResourceType.HTML, new CrawlDepth(0));
    const child = new ResourceNode('c1', new NormalizedUrl('https://example.com/style.css'), ResourceType.CSS, new CrawlDepth(1), 'p1');
    parent.addChild(child);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].id).toBe('c1');
  });

  it('should update status', () => {
    const node = new ResourceNode('r1', new NormalizedUrl('https://example.com/page'), ResourceType.HTML, new CrawlDepth(0));
    node.updateStatus(ResourceStatus.Fetched);
    expect(node.status).toBe(ResourceStatus.Fetched);
  });
});
```

- [ ] **Step 2: Implement ResourceNode**

```typescript
// src/domain/entities/ResourceNode.ts
import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import { CrawlDepth } from '../value-objects/CrawlDepth';
import { ResourceType, ResourceStatus } from '../../shared/types';

export class ResourceNode {
  readonly id: string;
  readonly url: NormalizedUrl;
  readonly resourceType: ResourceType;
  readonly depth: CrawlDepth;
  readonly parentId: string | null;
  status: ResourceStatus;
  children: ResourceNode[];
  contentType?: string;
  contentSize?: number;
  readonly discoveredAt: number;

  constructor(
    id: string,
    url: NormalizedUrl,
    resourceType: ResourceType,
    depth: CrawlDepth,
    parentId: string | null = null,
  ) {
    this.id = id;
    this.url = url;
    this.resourceType = resourceType;
    this.depth = depth;
    this.parentId = parentId;
    this.status = ResourceStatus.Discovered;
    this.children = [];
    this.discoveredAt = Date.now();
  }

  addChild(child: ResourceNode): void {
    this.children.push(child);
  }

  updateStatus(status: ResourceStatus): void {
    this.status = status;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      url: this.url.toString(),
      resourceType: this.resourceType,
      depth: this.depth.toString(),
      parentId: this.parentId,
      status: this.status,
      children: this.children.map(c => c.toJSON()),
      contentType: this.contentType,
      contentSize: this.contentSize,
      discoveredAt: this.discoveredAt,
    };
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/domain/ResourceNode.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/entities/ResourceNode.ts tests/unit/domain/ResourceNode.test.ts
git commit -m "feat: add ResourceNode entity with composite pattern"
```

---

### Task 7: Domain Services

**Files:**
- Create: `src/domain/services/DedupPolicy.ts`
- Create: `src/domain/services/PriorityCalculator.ts`
- Create: `src/domain/services/DomainScopePolicy.ts`
- Create: `src/domain/services/UrlFilterChain.ts`
- Test: `tests/unit/domain/DedupPolicy.test.ts`
- Test: `tests/unit/domain/PriorityCalculator.test.ts`
- Test: `tests/unit/domain/DomainScopePolicy.test.ts`
- Test: `tests/unit/domain/UrlFilterChain.test.ts`

**Interfaces:**
- Consumes: NormalizedUrl, CrawlDepth, shared types
- Produces: Services used by use cases and scheduler

- [ ] **Step 1: Write DedupPolicy test**

```typescript
// tests/unit/domain/DedupPolicy.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DedupPolicy } from '../../../src/domain/services/DedupPolicy';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('DedupPolicy', () => {
  let policy: DedupPolicy;
  beforeEach(() => { policy = new DedupPolicy(); });

  it('should return false for unseen URL', () => {
    expect(policy.isDuplicate(new NormalizedUrl('https://example.com/page'))).toBe(false);
  });

  it('should return true for visited URL', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/page'));
    expect(policy.isDuplicate(new NormalizedUrl('https://example.com/page'))).toBe(true);
  });

  it('should normalize before check', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/page/'));
    expect(policy.isDuplicate(new NormalizedUrl('HTTPS://EXAMPLE.COM/page'))).toBe(true);
  });

  it('should track visited count', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/a'));
    policy.markVisited(new NormalizedUrl('https://example.com/b'));
    expect(policy.visitedCount).toBe(2);
  });

  it('should serialize and deserialize', () => {
    policy.markVisited(new NormalizedUrl('https://example.com/a'));
    const json = policy.toJSON();
    const restored = DedupPolicy.fromJSON(json);
    expect(restored.isDuplicate(new NormalizedUrl('https://example.com/a'))).toBe(true);
  });
});
```

- [ ] **Step 2: Implement DedupPolicy**

```typescript
// src/domain/services/DedupPolicy.ts
import { NormalizedUrl } from '../value-objects/NormalizedUrl';

export class DedupPolicy {
  private visited = new Set<string>();

  isDuplicate(url: NormalizedUrl): boolean {
    return this.visited.has(url.normalized);
  }

  markVisited(url: NormalizedUrl): void {
    this.visited.add(url.normalized);
  }

  get visitedCount(): number { return this.visited.size; }

  toJSON(): string[] {
    return Array.from(this.visited);
  }

  static fromJSON(data: string[]): DedupPolicy {
    const policy = new DedupPolicy();
    for (const url of data) {
      policy.visited.add(url);
    }
    return policy;
  }
}
```

- [ ] **Step 3: Write PriorityCalculator test**

```typescript
// tests/unit/domain/PriorityCalculator.test.ts
import { describe, it, expect } from 'vitest';
import { PriorityCalculator } from '../../../src/domain/services/PriorityCalculator';
import { ResourceType } from '../../../src/shared/types';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('PriorityCalculator', () => {
  it('should give higher priority to shallower depth', () => {
    const url = new NormalizedUrl('https://example.com/page');
    const p0 = PriorityCalculator.calculate(url, 0, ResourceType.HTML, null);
    const p3 = PriorityCalculator.calculate(url, 3, ResourceType.HTML, null);
    expect(p0).toBeGreaterThan(p3);
  });

  it('should give bonus for same domain', () => {
    const start = new NormalizedUrl('https://example.com');
    const same = PriorityCalculator.calculate(new NormalizedUrl('https://blog.example.com/page'), 1, ResourceType.HTML, start);
    const diff = PriorityCalculator.calculate(new NormalizedUrl('https://other.com/page'), 1, ResourceType.HTML, start);
    expect(same).toBeGreaterThan(diff);
  });

  it('should give higher priority for HTML over image', () => {
    const url = new NormalizedUrl('https://example.com/page');
    const html = PriorityCalculator.calculate(url, 1, ResourceType.HTML, null);
    const img = PriorityCalculator.calculate(url, 1, ResourceType.Image, null);
    expect(html).toBeGreaterThan(img);
  });
});
```

- [ ] **Step 4: Implement PriorityCalculator**

```typescript
// src/domain/services/PriorityCalculator.ts
import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import { ResourceType } from '../../shared/types';
import { getPriorityMultiplier } from '../value-objects/ResourceType';

export class PriorityCalculator {
  static calculate(
    url: NormalizedUrl,
    depth: number,
    resourceType: ResourceType,
    startUrl: NormalizedUrl | null,
  ): number {
    const depthScore = 1 / (depth + 1);
    const domainScore = (startUrl && url.hostname.endsWith(startUrl.hostname)) ? 1 : 0;
    const typeMultiplier = getPriorityMultiplier(resourceType);
    return 0.4 * depthScore + 0.3 * domainScore + 0.3 * typeMultiplier;
  }
}
```

- [ ] **Step 5: Write DomainScopePolicy test**

```typescript
// tests/unit/domain/DomainScopePolicy.test.ts
import { describe, it, expect } from 'vitest';
import { DomainScopePolicy } from '../../../src/domain/services/DomainScopePolicy';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { DomainScope } from '../../../src/shared/types';

describe('DomainScopePolicy', () => {
  const base = new NormalizedUrl('https://example.com/page');

  it('SAME_ORIGIN: allow same host', () => {
    const policy = new DomainScopePolicy(DomainScope.SameOrigin, []);
    expect(policy.isAllowed(new NormalizedUrl('https://example.com/other'), base)).toBe(true);
  });

  it('SAME_ORIGIN: reject different subdomain', () => {
    const policy = new DomainScopePolicy(DomainScope.SameOrigin, []);
    expect(policy.isAllowed(new NormalizedUrl('https://blog.example.com/page'), base)).toBe(false);
  });

  it('SAME_DOMAIN: allow subdomain', () => {
    const policy = new DomainScopePolicy(DomainScope.SameDomain, []);
    expect(policy.isAllowed(new NormalizedUrl('https://blog.example.com/page'), base)).toBe(true);
  });

  it('SAME_DOMAIN: reject different domain', () => {
    const policy = new DomainScopePolicy(DomainScope.SameDomain, []);
    expect(policy.isAllowed(new NormalizedUrl('https://other.com/page'), base)).toBe(false);
  });

  it('SAME_DOMAIN_PLUS_LIST: allow whitelisted', () => {
    const policy = new DomainScopePolicy(DomainScope.SameDomainPlusList, ['cdn.example.com']);
    expect(policy.isAllowed(new NormalizedUrl('https://cdn.example.com/resource'), base)).toBe(true);
  });

  it('UNRESTRICTED: allow everything', () => {
    const policy = new DomainScopePolicy(DomainScope.Unrestricted, []);
    expect(policy.isAllowed(new NormalizedUrl('https://anywhere.com'), base)).toBe(true);
  });
});
```

- [ ] **Step 6: Implement DomainScopePolicy**

```typescript
// src/domain/services/DomainScopePolicy.ts
import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import { DomainScope } from '../../shared/types';

export class DomainScopePolicy {
  constructor(
    private scope: DomainScope,
    private extraDomains: string[],
  ) {}

  isAllowed(url: NormalizedUrl, startUrl: NormalizedUrl): boolean {
    switch (this.scope) {
      case DomainScope.SameOrigin:
        return url.origin === startUrl.origin;
      case DomainScope.SameDomain:
        return url.hostname.endsWith(startUrl.hostname);
      case DomainScope.SameDomainPlusList:
        return url.hostname.endsWith(startUrl.hostname) ||
          this.extraDomains.some(d => url.hostname.endsWith(d));
      case DomainScope.Unrestricted:
        return true;
    }
  }
}
```

- [ ] **Step 7: Write UrlFilterChain test**

```typescript
// tests/unit/domain/UrlFilterChain.test.ts
import { describe, it, expect } from 'vitest';
import { UrlFilterChain } from '../../../src/domain/services/UrlFilterChain';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';

describe('UrlFilterChain', () => {
  it('should pass URL with no filters', () => {
    const chain = new UrlFilterChain();
    expect(chain.shouldCrawl(new NormalizedUrl('https://example.com/page'))).toBe(true);
  });

  it('should block blacklisted patterns', () => {
    const chain = new UrlFilterChain();
    chain.addBlacklistPattern('.pdf');
    expect(chain.shouldCrawl(new NormalizedUrl('https://example.com/doc.pdf'))).toBe(false);
    expect(chain.shouldCrawl(new NormalizedUrl('https://example.com/page.html'))).toBe(true);
  });

  it('should chain multiple blacklist patterns', () => {
    const chain = new UrlFilterChain();
    chain.addBlacklistPattern('.exe');
    chain.addBlacklistPattern('.zip');
    expect(chain.shouldCrawl(new NormalizedUrl('https://example.com/file.exe'))).toBe(false);
    expect(chain.shouldCrawl(new NormalizedUrl('https://example.com/file.zip'))).toBe(false);
    expect(chain.shouldCrawl(new NormalizedUrl('https://example.com/file.html'))).toBe(true);
  });
});
```

- [ ] **Step 8: Implement UrlFilterChain**

```typescript
// src/domain/services/UrlFilterChain.ts
import { NormalizedUrl } from '../value-objects/NormalizedUrl';

type UrlFilter = (url: NormalizedUrl) => boolean;

export class UrlFilterChain {
  private filters: UrlFilter[] = [];

  addFilter(filter: UrlFilter): void {
    this.filters.push(filter);
  }

  addBlacklistPattern(pattern: string): void {
    this.filters.push((url: NormalizedUrl) => !url.toString().toLowerCase().includes(pattern.toLowerCase()));
  }

  shouldCrawl(url: NormalizedUrl): boolean {
    for (const filter of this.filters) {
      if (!filter(url)) return false;
    }
    return true;
  }
}
```

- [ ] **Step 9: Run all domain service tests**

```bash
npx vitest run tests/unit/domain/DedupPolicy.test.ts tests/unit/domain/PriorityCalculator.test.ts tests/unit/domain/DomainScopePolicy.test.ts tests/unit/domain/UrlFilterChain.test.ts
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/domain/services/ tests/unit/domain/DedupPolicy.test.ts tests/unit/domain/PriorityCalculator.test.ts tests/unit/domain/DomainScopePolicy.test.ts tests/unit/domain/UrlFilterChain.test.ts
git commit -m "feat: add domain services — DedupPolicy, PriorityCalculator, DomainScopePolicy, UrlFilterChain"
```

---

### Task 8: Application Layer Interfaces

**Files:**
- Create: `src/application/interfaces.ts`

**Interfaces:**
- Consumes: domain entities
- Produces: interfaces used by use cases and infrastructure implementations

- [ ] **Step 1: Create interfaces.ts**

```typescript
// src/application/interfaces.ts
import { CrawlJob } from '../domain/entities/CrawlJob';
import { UrlFrontier } from '../domain/entities/UrlFrontier';
import { ResourceNode } from '../domain/entities/ResourceNode';

export interface IJobRepository {
  save(job: CrawlJob): Promise<void>;
  load(jobId: string): Promise<CrawlJob | null>;
  list(): Promise<CrawlJob[]>;
  delete(jobId: string): Promise<void>;
}

export interface IUrlFrontierRepository {
  save(frontier: UrlFrontier): Promise<void>;
  load(): Promise<UrlFrontier | null>;
  clear(): Promise<void>;
}

export interface IResourceRepository {
  save(node: ResourceNode): Promise<void>;
  saveBatch(nodes: ResourceNode[]): Promise<void>;
  load(id: string): Promise<ResourceNode | null>;
  listByJob(jobId: string): Promise<ResourceNode[]>;
  deleteByJob(jobId: string): Promise<void>;
}

export interface ICrawlEventBus {
  emit(eventType: string, jobId: string, payload: Record<string, unknown>): void;
  subscribe(eventType: string, handler: (payload: { jobId: string; data: Record<string, unknown> }) => void): void;
  unsubscribe(eventType: string, handler: Function): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/application/interfaces.ts
git commit -m "feat: add application layer repository interfaces"
```

---

### Task 9: Application Use Cases

**Files:**
- Create: `src/application/use-cases/StartCrawlUseCase.ts`
- Create: `src/application/use-cases/StopCrawlUseCase.ts`
- Test: `tests/unit/application/StartCrawlUseCase.test.ts`
- Test: `tests/unit/application/StopCrawlUseCase.test.ts`

**Interfaces:**
- Consumes: domain entities/services, application interfaces
- Produces: use case classes

- [ ] **Step 1: Write StartCrawlUseCase test**

```typescript
// tests/unit/application/StartCrawlUseCase.test.ts
import { describe, it, expect, vi } from 'vitest';
import { StartCrawlUseCase } from '../../../src/application/use-cases/StartCrawlUseCase';
import { CrawlJobState, DomainScope } from '../../../src/shared/types';
import type { IJobRepository, IUrlFrontierRepository } from '../../../src/application/interfaces';

function mockJobRepo(): IJobRepository {
  return { save: vi.fn(), load: vi.fn(), list: vi.fn(), delete: vi.fn() };
}
function mockFrontierRepo(): IUrlFrontierRepository {
  return { save: vi.fn(), load: vi.fn(), clear: vi.fn() };
}

describe('StartCrawlUseCase', () => {
  it('should create and start a crawl job', async () => {
    const useCase = new StartCrawlUseCase(mockJobRepo(), mockFrontierRepo());
    const result = await useCase.execute({
      startUrl: 'https://example.com',
      maxDepth: 3, maxUrls: 100, domainScope: DomainScope.SameOrigin,
    });
    expect(result.job.state).toBe(CrawlJobState.Running);
    expect(result.job.startUrl.toString()).toBe('https://example.com');
  });

  it('should throw for invalid URL', async () => {
    const useCase = new StartCrawlUseCase(mockJobRepo(), mockFrontierRepo());
    await expect(useCase.execute({ startUrl: 'not-a-url' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Implement StartCrawlUseCase**

```typescript
// src/application/use-cases/StartCrawlUseCase.ts
import { CrawlJob } from '../../domain/entities/CrawlJob';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { NormalizedUrl } from '../../domain/value-objects/NormalizedUrl';
import { ResourceType } from '../../shared/types';
import { PriorityCalculator } from '../../domain/services/PriorityCalculator';
import type { IJobRepository, IUrlFrontierRepository } from '../interfaces';

export interface StartCrawlInput {
  startUrl: string;
  maxDepth?: number;
  maxUrls?: number;
  domainScope?: string;
  extraDomains?: string[];
  rateLimitMs?: number;
  respectRobotsTxt?: boolean;
}

export interface StartCrawlResult { job: CrawlJob; }

export class StartCrawlUseCase {
  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
  ) {}

  async execute(input: StartCrawlInput): Promise<StartCrawlResult> {
    const normalizedUrl = new NormalizedUrl(input.startUrl);
    const jobId = crypto.randomUUID();
    const job = new CrawlJob(jobId, normalizedUrl, {
      maxDepth: input.maxDepth ?? 5,
      maxUrls: input.maxUrls ?? 10000,
      domainScope: (input.domainScope ?? 'SAME_ORIGIN') as any,
      extraDomains: input.extraDomains ?? [],
      rateLimitMs: input.rateLimitMs ?? 300,
      respectRobotsTxt: input.respectRobotsTxt ?? true,
    });
    job.start();

    const frontier = new UrlFrontier();
    const priority = PriorityCalculator.calculate(normalizedUrl, 0, ResourceType.HTML, normalizedUrl);
    frontier.enqueue(normalizedUrl, priority);

    await this.jobRepo.save(job);
    await this.frontierRepo.save(frontier);
    return { job };
  }
}
```

- [ ] **Step 3: Write StopCrawlUseCase test**

```typescript
// tests/unit/application/StopCrawlUseCase.test.ts
import { describe, it, expect, vi } from 'vitest';
import { StopCrawlUseCase } from '../../../src/application/use-cases/StopCrawlUseCase';
import { CrawlJob } from '../../../src/domain/entities/CrawlJob';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { CrawlJobState, DomainScope } from '../../../src/shared/types';
import type { IJobRepository, IUrlFrontierRepository } from '../../../src/application/interfaces';

describe('StopCrawlUseCase', () => {
  it('should cancel a running job', async () => {
    const job = new CrawlJob('job-1', new NormalizedUrl('https://example.com'), {
      maxDepth: 3, maxUrls: 100, domainScope: DomainScope.SameOrigin, extraDomains: [], rateLimitMs: 300, respectRobotsTxt: true,
    });
    job.start();

    const jobRepo: IJobRepository = { save: vi.fn(), load: vi.fn().mockResolvedValue(job), list: vi.fn(), delete: vi.fn() };
    const frontierRepo: IUrlFrontierRepository = { save: vi.fn(), load: vi.fn(), clear: vi.fn() };
    const useCase = new StopCrawlUseCase(jobRepo, frontierRepo);

    const result = await useCase.execute({ jobId: 'job-1' });
    expect(result.job.state).toBe(CrawlJobState.Cancelled);
    expect(frontierRepo.clear).toHaveBeenCalled();
  });

  it('should throw for unknown job', async () => {
    const jobRepo: IJobRepository = { save: vi.fn(), load: vi.fn().mockResolvedValue(null), list: vi.fn(), delete: vi.fn() };
    const useCase = new StopCrawlUseCase(jobRepo, mockFrontierRepo());
    await expect(useCase.execute({ jobId: 'nonexistent' })).rejects.toThrow('Job not found');
  });
});

function mockFrontierRepo(): IUrlFrontierRepository {
  return { save: vi.fn(), load: vi.fn(), clear: vi.fn() };
}
```

- [ ] **Step 4: Implement StopCrawlUseCase**

```typescript
// src/application/use-cases/StopCrawlUseCase.ts
import type { IJobRepository, IUrlFrontierRepository } from '../interfaces';
import { CrawlJob } from '../../domain/entities/CrawlJob';

export interface StopCrawlInput { jobId: string; }
export interface StopCrawlResult { job: CrawlJob; }

export class StopCrawlUseCase {
  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
  ) {}

  async execute(input: StopCrawlInput): Promise<StopCrawlResult> {
    const job = await this.jobRepo.load(input.jobId);
    if (!job) throw new Error(`Job not found: ${input.jobId}`);
    job.cancel();
    await this.jobRepo.save(job);
    await this.frontierRepo.clear();
    return { job };
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/unit/application/
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/application/ tests/unit/application/
git commit -m "feat: add application use cases — StartCrawl, StopCrawl"
```

---

### Task 10: Infrastructure — EventBus + PortManager

**Files:**
- Create: `src/infrastructure/messaging/EventBus.ts`
- Create: `src/infrastructure/messaging/PortManager.ts`

**Interfaces:**
- Consumes: `CrawlEvent`, `CrawlEventType` from shared types
- Produces: Communication layer used by scheduler and UI

- [ ] **Step 1: Implement EventBus**

```typescript
// src/infrastructure/messaging/EventBus.ts
import type { CrawlEvent, CrawlEventType } from '../../shared/types';
import { logger } from '../../shared/logger';

type EventHandler = (event: CrawlEvent) => void;

export class EventBus {
  private subscribers = new Map<CrawlEventType, Set<EventHandler>>();

  subscribe(eventType: CrawlEventType, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
    return () => this.subscribers.get(eventType)?.delete(handler);
  }

  unsubscribe(eventType: CrawlEventType, handler: EventHandler): void {
    this.subscribers.get(eventType)?.delete(handler);
  }

  emit(event: CrawlEvent): void {
    logger.debug('EventBus', `Emitting ${event.type}`, { jobId: event.jobId });
    const handlers = this.subscribers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(event); } catch (err) {
          logger.error('EventBus', `Handler error for ${event.type}`, { error: String(err) });
        }
      }
    }
  }

  clear(): void { this.subscribers.clear(); }
}
```

- [ ] **Step 2: Implement PortManager**

```typescript
// src/infrastructure/messaging/PortManager.ts
import { logger } from '../../shared/logger';
import type { CrawlEvent } from '../../shared/types';

interface PortEntry {
  port: chrome.runtime.Port;
  topics: Set<string>;
}

export class PortManager {
  private ports = new Map<string, PortEntry>();

  register(port: chrome.runtime.Port): void {
    const name = port.name || `port-${Date.now()}`;
    this.ports.set(name, { port, topics: new Set() });
    port.onDisconnect.addListener(() => {
      this.ports.delete(name);
      logger.debug('PortManager', `Port disconnected: ${name}`);
    });
  }

  subscribe(portName: string, topic: string): void {
    this.ports.get(portName)?.topics.add(topic);
  }

  unsubscribe(portName: string, topic: string): void {
    this.ports.get(portName)?.topics.delete(topic);
  }

  broadcast(event: CrawlEvent): void {
    for (const [, entry] of this.ports) {
      if (entry.topics.has(event.type) || entry.topics.size === 0) {
        try { entry.port.postMessage(event); } catch (err) {
          logger.error('PortManager', 'Failed to send message', { error: String(err) });
        }
      }
    }
  }

  get connectedCount(): number { return this.ports.size; }

  disconnectAll(): void {
    for (const [, entry] of this.ports) entry.port.disconnect();
    this.ports.clear();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/messaging/
git commit -m "feat: add EventBus and PortManager for inter-component communication"
```

---

### Task 11: Infrastructure — Storage Repositories

**Files:**
- Create: `src/infrastructure/storage/ChromeStorageSessionRepository.ts`
- Create: `src/infrastructure/storage/ChromeStorageLocalRepository.ts`
- Create: `src/infrastructure/storage/IndexedDbRepository.ts`

**Interfaces:**
- Consumes: IJobRepository, IUrlFrontierRepository, IResourceRepository
- Produces: Storage layer used by use cases

- [ ] **Step 1: Implement ChromeStorageSessionRepository**

```typescript
// src/infrastructure/storage/ChromeStorageSessionRepository.ts
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import type { IUrlFrontierRepository } from '../../application/interfaces';

const FRONTIER_KEY = 'dss:frontier';

export class ChromeStorageSessionRepository implements IUrlFrontierRepository {
  async save(frontier: UrlFrontier): Promise<void> {
    await chrome.storage.session.set({ [FRONTIER_KEY]: frontier.toJSON() });
  }

  async load(): Promise<UrlFrontier | null> {
    const result = await chrome.storage.session.get(FRONTIER_KEY);
    const data = result[FRONTIER_KEY];
    if (!data) return null;
    return UrlFrontier.fromJSON(data);
  }

  async clear(): Promise<void> {
    await chrome.storage.session.remove(FRONTIER_KEY);
  }
}
```

- [ ] **Step 2: Implement ChromeStorageLocalRepository**

```typescript
// src/infrastructure/storage/ChromeStorageLocalRepository.ts
import { CrawlJob } from '../../domain/entities/CrawlJob';
import type { IJobRepository } from '../../application/interfaces';

const JOBS_KEY = 'dss:jobs';

export class ChromeStorageLocalRepository implements IJobRepository {
  async save(job: CrawlJob): Promise<void> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, unknown> = result[JOBS_KEY] || {};
    jobs[job.id] = job.toJSON();
    await chrome.storage.local.set({ [JOBS_KEY]: jobs });
  }

  async load(jobId: string): Promise<CrawlJob | null> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, any> = result[JOBS_KEY] || {};
    return jobs[jobId] ?? null;
  }

  async list(): Promise<CrawlJob[]> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, any> = result[JOBS_KEY] || {};
    return Object.values(jobs);
  }

  async delete(jobId: string): Promise<void> {
    const result = await chrome.storage.local.get(JOBS_KEY);
    const jobs: Record<string, any> = result[JOBS_KEY] || {};
    delete jobs[jobId];
    await chrome.storage.local.set({ [JOBS_KEY]: jobs });
  }
}
```

- [ ] **Step 3: Implement IndexedDbRepository (stub)**

```typescript
// src/infrastructure/storage/IndexedDbRepository.ts
import { ResourceNode } from '../../domain/entities/ResourceNode';
import type { IResourceRepository } from '../../application/interfaces';

const DB_NAME = 'DeepSiteScanner';
const DB_VERSION = 1;

export class IndexedDbRepository implements IResourceRepository {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('resources')) {
          const store = db.createObjectStore('resources', { keyPath: 'id' });
          store.createIndex('jobId', 'jobId', { unique: false });
          store.createIndex('type', 'resourceType', { unique: false });
          store.createIndex('discoveredAt', 'discoveredAt', { unique: false });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  async save(node: ResourceNode): Promise<void> { /* Stub for M2 */ }
  async saveBatch(nodes: ResourceNode[]): Promise<void> { /* Stub for M2 */ }
  async load(id: string): Promise<ResourceNode | null> { return null; }
  async listByJob(jobId: string): Promise<ResourceNode[]> { return []; }
  async deleteByJob(jobId: string): Promise<void> { /* Stub */ }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/storage/
git commit -m "feat: add storage repositories — ChromeStorageSession, ChromeStorageLocal, IndexedDB stub"
```

---

### Task 12: Infrastructure — CrawlScheduler + MessageRouter

**Files:**
- Create: `src/infrastructure/background/CrawlScheduler.ts`
- Create: `src/infrastructure/background/MessageRouter.ts`

**Interfaces:**
- Consumes: EventBus, storage repositories, domain types
- Produces: Orchestrator for the crawl lifecycle

- [ ] **Step 1: Implement CrawlScheduler**

```typescript
// src/infrastructure/background/CrawlScheduler.ts
import { CrawlJob } from '../../domain/entities/CrawlJob';
import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import { EventBus } from '../messaging/EventBus';
import { logger } from '../../shared/logger';
import type { IJobRepository, IUrlFrontierRepository } from '../../application/interfaces';
import type { CrawlCommand } from '../../shared/types';

export class CrawlScheduler {
  private currentJob: CrawlJob | null = null;
  private frontier: UrlFrontier | null = null;

  constructor(
    private jobRepo: IJobRepository,
    private frontierRepo: IUrlFrontierRepository,
    private eventBus: EventBus,
  ) {}

  async handleCommand(command: CrawlCommand): Promise<void> {
    logger.debug('CrawlScheduler', `Handling command: ${command.type}`);
    switch (command.type) {
      case 'START':
        await this.resume(command.jobId);
        break;
      case 'PAUSE':
        if (this.currentJob) {
          this.currentJob.pause();
          await this.persistState();
          this.eventBus.emit({
            type: 'CRAWL_PAUSED', jobId: this.currentJob.id,
            payload: {}, timestamp: Date.now(),
          });
        }
        break;
      case 'RESUME':
        await this.resume(command.jobId);
        break;
      case 'CANCEL':
        if (this.currentJob) {
          this.currentJob.cancel();
          await this.persistState();
          await this.frontierRepo.clear();
          this.frontier = null;
          this.eventBus.emit({
            type: 'CRAWL_FAILED', jobId: this.currentJob.id,
            payload: { error: 'Cancelled by user' }, timestamp: Date.now(),
          });
        }
        break;
    }
  }

  async rehydrate(): Promise<boolean> {
    const frontier = await this.frontierRepo.load();
    if (!frontier || frontier.isEmpty()) return false;
    const jobs = await this.jobRepo.list();
    const activeJob = jobs.find(j => j.isActive?.());
    if (!activeJob) return false;
    this.frontier = frontier;
    this.currentJob = activeJob;
    this.currentJob.resume();
    logger.info('CrawlScheduler', `Rehydrated job ${activeJob.id} with ${frontier.size()} URLs`);
    return true;
  }

  private async resume(jobId: string): Promise<void> {
    if (!this.currentJob || this.currentJob.id !== jobId) {
      const job = await this.jobRepo.load(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      this.currentJob = job;
    }
    if (this.currentJob.state === 'RUNNING') return;
    this.currentJob.resume();
    await this.persistState();
  }

  private async persistState(): Promise<void> {
    if (!this.currentJob) return;
    await this.jobRepo.save(this.currentJob);
    if (this.frontier) await this.frontierRepo.save(this.frontier);
  }

  getCurrentJob(): CrawlJob | null { return this.currentJob; }
  getFrontier(): UrlFrontier | null { return this.frontier; }
}
```

- [ ] **Step 2: Implement MessageRouter**

```typescript
// src/infrastructure/background/MessageRouter.ts
import { CrawlScheduler } from './CrawlScheduler';
import { EventBus } from '../messaging/EventBus';
import { PortManager } from '../messaging/PortManager';
import { logger } from '../../shared/logger';

type MessageHandler = (message: any, sender: chrome.runtime.MessageSender) => Promise<any>;

export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();

  constructor(
    private scheduler: CrawlScheduler,
    private eventBus: EventBus,
    private portManager: PortManager,
  ) {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.register('start-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'START', jobId: msg.jobId, config: msg.config });
      return { success: true };
    });
    this.register('pause-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'PAUSE', jobId: msg.jobId });
      return { success: true };
    });
    this.register('resume-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'RESUME', jobId: msg.jobId });
      return { success: true };
    });
    this.register('cancel-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'CANCEL', jobId: msg.jobId });
      return { success: true };
    });
    this.register('get-status', async () => {
      const job = this.scheduler.getCurrentJob();
      return { job: job ? job.toJSON() : null };
    });
  }

  register(action: string, handler: MessageHandler): void {
    this.handlers.set(action, handler);
  }

  async route(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const handler = this.handlers.get(message.action);
    if (!handler) {
      logger.warn('MessageRouter', `No handler for action: ${message.action}`);
      return { error: `Unknown action: ${message.action}` };
    }
    try {
      return await handler(message, sender);
    } catch (err) {
      logger.error('MessageRouter', `Handler error for ${message.action}`, { error: String(err) });
      return { error: String(err) };
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/background/
git commit -m "feat: add CrawlScheduler and MessageRouter"
```

---

### Task 13: Service Worker Entry Point + Stubs

**Files:**
- Create: `src/infrastructure/background/service-worker.ts`
- Create: `src/infrastructure/content-script/index.ts`
- Create: `src/infrastructure/offscreen/index.ts`

**Interfaces:**
- Consumes: CrawlScheduler, MessageRouter, EventBus, PortManager, storage repos
- Produces: Extension entry point

- [ ] **Step 1: Implement service-worker.ts**

```typescript
// src/infrastructure/background/service-worker.ts
import { CrawlScheduler } from './CrawlScheduler';
import { MessageRouter } from './MessageRouter';
import { EventBus } from '../messaging/EventBus';
import { PortManager } from '../messaging/PortManager';
import { ChromeStorageSessionRepository } from '../storage/ChromeStorageSessionRepository';
import { ChromeStorageLocalRepository } from '../storage/ChromeStorageLocalRepository';
import { logger } from '../../shared/logger';
import { HEARTBEAT_INTERVAL_MS } from '../../shared/constants';

const eventBus = new EventBus();
const portManager = new PortManager();
const frontierRepo = new ChromeStorageSessionRepository();
const jobRepo = new ChromeStorageLocalRepository();
const scheduler = new CrawlScheduler(jobRepo, frontierRepo, eventBus);
const messageRouter = new MessageRouter(scheduler, eventBus, portManager);

// --- Lifecycle ---
chrome.runtime.onInstalled.addListener(async () => {
  logger.info('SW', 'Extension installed');
  await logger.loadLevel();
  chrome.alarms.create('crawl-heartbeat', { periodInMinutes: HEARTBEAT_INTERVAL_MS / 60000 });
  chrome.contextMenus.create({ id: 'scan-page', title: 'Scan this page', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'scan-site', title: 'Scan this site', contexts: ['page'] });
});

// --- Alarm handler (SW revival) ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'crawl-heartbeat') return;
  const rehydrated = await scheduler.rehydrate();
  if (rehydrated) logger.info('SW', 'Crawl resumed after rehydration');
});

// --- Message handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageRouter.route(message, sender).then(sendResponse);
  return true;
});

// --- Port handler (long-lived connections) ---
chrome.runtime.onConnect.addListener((port) => {
  portManager.register(port);
  port.onMessage.addListener((msg) => {
    if (msg.action === 'subscribe') portManager.subscribe(port.name || '', msg.topic);
  });
});

// --- Context menu ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.url) return;
  if (info.menuItemId === 'scan-page' || info.menuItemId === 'scan-site') {
    chrome.runtime.sendMessage({
      action: 'start-crawl',
      jobId: crypto.randomUUID(),
      config: { startUrl: tab.url, maxDepth: info.menuItemId === 'scan-page' ? 0 : 5 },
    });
  }
});

logger.info('SW', 'Service worker initialized');
```

- [ ] **Step 2: Create content script stub**

```typescript
// src/infrastructure/content-script/index.ts
import { logger } from '../../shared/logger';
logger.debug('ContentScript', 'Injected into page');
export {};
```

- [ ] **Step 3: Create offscreen stub**

```typescript
// src/infrastructure/offscreen/index.ts
// Placeholder for M2 — heavy XML/HTML parsing
export {};
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/background/service-worker.ts src/infrastructure/content-script/index.ts src/infrastructure/offscreen/index.ts
git commit -m "feat: add service worker entry point with lifecycle management"
```

---

### Task 14: Run Full Test Suite + Type Check

**File:** Execute the entire test suite and type-check

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p tests/unit/domain tests/unit/application tests/integration/storage
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass. Fix any failures immediately.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No type errors. Note: some errors from chrome.* API usage in test files are expected since tests don't run in browser context. If type errors occur in source, fix them.

- [ ] **Step 4: Build**

```bash
npx vite build
```

Expected: Build succeeds with all entries.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: add vitest config, verify full test suite + build"
```

---

## After M0 — Next Milestones

| Milestone | Focus |
|---|---|
| M1 | Static crawl — BFS frontier execution, HTML link discovery, domain scope, content script DOM scanning |
| M2 | Resource discovery — CSS/JS/sitemap/robots/JSON-LD parsing via offscreen document |
| M3 | SPA support — History/hash hooks, MutationObserver, fetch/XHR/WebSocket interception |
| M4 | Storage & Export — IndexedDB full schema, 5 export formats (JSON/CSV/MD/HTML/SQLite) |
| M5 | UI — Dashboard, Tree/Graph view, filters, dark mode, virtualized list |
| M6 | Resilience — Service worker revival, circuit breaker, content fingerprint loop detection |
| M7 | Testing & Hardening — 7 test types, security review, Chrome Web Store submission |
