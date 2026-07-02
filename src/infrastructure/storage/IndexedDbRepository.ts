import { ResourceNode } from '../../domain/entities/ResourceNode';
import { NormalizedUrl } from '../../domain/value-objects/NormalizedUrl';
import { CrawlDepth } from '../../domain/value-objects/CrawlDepth';
import type { IResourceRepository } from '../../application/interfaces';
import { ResourceType, ResourceStatus } from '../../shared/types';

const DB_NAME = 'DeepSiteScanner';
const DB_VERSION = 2;

interface StoredResource {
  id: string;
  url: string;
  resourceType: ResourceType;
  depth: number;
  parentId: string | null;
  status: ResourceStatus;
  children: string[];
  contentType?: string;
  contentSize?: number;
  discoveredAt: number;
  jobId?: string;
}

export class IndexedDbRepository implements IResourceRepository {
  private db: IDBDatabase | null = null;
  private currentJobId: string = '';

  setJobId(jobId: string): void {
    this.currentJobId = jobId;
  }

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
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('depth', 'depth', { unique: false });
          store.createIndex('discoveredAt', 'discoveredAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  async save(node: ResourceNode): Promise<void> {
    const db = await this.open();
    const stored = this.toStored(node);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readwrite');
      tx.objectStore('resources').put(stored);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveBatch(nodes: ResourceNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const db = await this.open();
    const stored = nodes.map(n => this.toStored(n));
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readwrite');
      const store = tx.objectStore('resources');
      for (const s of stored) store.put(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(id: string): Promise<ResourceNode | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readonly');
      const req = tx.objectStore('resources').get(id);
      req.onsuccess = () => {
        const data = req.result as StoredResource | undefined;
        resolve(data ? this.fromStored(data) : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async listByJob(jobId: string): Promise<ResourceNode[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readonly');
      const index = tx.objectStore('resources').index('jobId');
      const req = index.getAll(jobId);
      req.onsuccess = () => {
        const results = (req.result as StoredResource[]) || [];
        resolve(results.map(r => this.fromStored(r)));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async query(options: {
    jobId?: string;
    type?: ResourceType;
    status?: ResourceStatus;
    domain?: string;
    minDepth?: number;
    maxDepth?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<ResourceNode[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readonly');
      let source: IDBObjectStore | IDBIndex;

      if (options.jobId) {
        source = tx.objectStore('resources').index('jobId');
      } else if (options.type) {
        source = tx.objectStore('resources').index('type');
      } else {
        source = tx.objectStore('resources');
      }

      const req = source.getAll();
      req.onsuccess = () => {
        let results = ((req.result as StoredResource[]) || []).map(r => this.fromStored(r));

        if (options.jobId) results = results.filter(r => r.id.includes(options.jobId!));
        if (options.type) results = results.filter(r => r.resourceType === options.type);
        if (options.status) results = results.filter(r => r.status === options.status);
        if (options.minDepth !== undefined) results = results.filter(r => r.depth.value >= options.minDepth!);
        if (options.maxDepth !== undefined) results = results.filter(r => r.depth.value <= options.maxDepth!);

        results.sort((a, b) => b.discoveredAt - a.discoveredAt);

        if (options.offset) results = results.slice(options.offset);
        if (options.limit) results = results.slice(0, options.limit);

        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteByJob(jobId: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readwrite');
      const index = tx.objectStore('resources').index('jobId');
      const req = index.openCursor(jobId);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async count(): Promise<number> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('resources', 'readonly');
      const req = tx.objectStore('resources').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private toStored(node: ResourceNode): StoredResource {
    return {
      id: node.id,
      url: node.url.toString(),
      resourceType: node.resourceType,
      depth: node.depth.value,
      parentId: node.parentId,
      status: node.status,
      children: node.children.map(c => c.id),
      contentType: node.contentType,
      contentSize: node.contentSize,
      discoveredAt: node.discoveredAt,
      jobId: this.currentJobId || undefined,
    };
  }

  private fromStored(data: StoredResource): ResourceNode {
    const node = new ResourceNode(
      data.id,
      new NormalizedUrl(data.url),
      data.resourceType,
      new CrawlDepth(data.depth),
      data.parentId,
    );
    node.status = data.status;
    node.contentType = data.contentType;
    node.contentSize = data.contentSize;
    // Note: children array references are stored by ID, not hydrated
    return node;
  }
}
