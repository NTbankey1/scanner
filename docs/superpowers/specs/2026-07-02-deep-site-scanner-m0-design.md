# Deep Site Scanner — M0 Foundation Design

## Overview
Chrome Extension MV3, 4-layer Clean Architecture, full TypeScript.
M0 establishes the project skeleton, domain layer, storage abstraction, messaging infrastructure, and service worker lifecycle.

## Tech Stack
- TypeScript 5.x, Vite 6.x (multi-entry), Vitest, ESLint + Prettier

## Directory Structure
```
deep-site-scanner/
├── manifest.json
├── package.json / tsconfig.json / vite.config.ts
├── src/
│   ├── domain/
│   │   ├── entities/     (CrawlJob, ResourceNode, UrlFrontier)
│   │   ├── value-objects/ (NormalizedUrl, ResourceType, CrawlDepth)
│   │   └── services/     (DedupPolicy, DomainScopePolicy, UrlFilterChain, PriorityCalculator)
│   ├── application/
│   │   └── use-cases/    (StartCrawlUseCase, StopCrawlUseCase, interfaces)
│   ├── infrastructure/
│   │   ├── background/   (service-worker.ts, CrawlScheduler, MessageRouter)
│   │   ├── messaging/    (EventBus, PortManager)
│   │   ├── storage/      (IndexedDbRepository, ChromeStorageRepository, IRepository)
│   │   └── content-script/ (stub)
│   └── shared/           (types.ts, constants.ts, logger.ts)
├── tests/
│   ├── unit/domain/
│   └── unit/application/
└── docs/
```

## Domain Layer (no chrome.* imports)
- CrawlJob: state machine Idle→Running→Paused→Completed/Failed/Cancelled
- ResourceNode: composite with children[]
- UrlFrontier: binary heap priority queue
- NormalizedUrl: URL normalization (lowercase, strip frag/tracking, sort params, default ports)
- Services: DedupPolicy, DomainScopePolicy, PriorityCalculator, UrlFilterChain (CoR)

## Application Layer
- StartCrawlUseCase: validate config → create job → init frontier → start scheduler
- StopCrawlUseCase: pause/cancel job
- IUrlFrontierRepository, IJobRepository interfaces

## Infrastructure Layer
- Service Worker: onInstalled, onAlarm (heartbeat), onMessage → rehydrate → route
- CrawlScheduler: orchestrator, pop frontier → inject content → process results
- MessageRouter: mediator pattern between components
- EventBus: observer pattern for progress events
- ChromeStorageSessionRepository: frontier + state persistence
- PortManager: long-lived port for real-time UI

## M0 Deliverables
- Project skeleton fully scaffolded
- Domain entities + value objects + services
- Application use cases + repository interfaces
- Storage implementations (chrome.storage.session/local)
- EventBus + MessageRouter
- CrawlScheduler + Service Worker entry
- Unit tests for all domain logic
- manifest.json with all MV3 declarations
