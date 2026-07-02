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

  async save(_node: ResourceNode): Promise<void> { /* Stub for M2 */ }
  async saveBatch(_nodes: ResourceNode[]): Promise<void> { /* Stub for M2 */ }
  async load(_id: string): Promise<ResourceNode | null> { return null; }
  async listByJob(_jobId: string): Promise<ResourceNode[]> { return []; }
  async deleteByJob(_jobId: string): Promise<void> { /* Stub */ }
}
