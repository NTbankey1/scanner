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
