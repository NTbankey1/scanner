import { ResourceNode } from '../../domain/entities/ResourceNode';
import type { IResourceRepository } from '../../application/interfaces';

export class InMemoryResourceRepository implements IResourceRepository {
  private store = new Map<string, ResourceNode>();
  private jobIndex = new Map<string, string[]>();

  async save(node: ResourceNode): Promise<void> {
    this.store.set(node.id, node);
    const list = this.jobIndex.get(node.id) || [];
    if (!list.includes(node.id)) list.push(node.id);
    this.jobIndex.set(node.id, list);
  }

  async saveBatch(nodes: ResourceNode[]): Promise<void> {
    for (const node of nodes) {
      this.store.set(node.id, node);
    }
  }

  async load(id: string): Promise<ResourceNode | null> {
    return this.store.get(id) ?? null;
  }

  async listByJob(_jobId: string): Promise<ResourceNode[]> {
    return Array.from(this.store.values());
  }

  async deleteByJob(_jobId: string): Promise<void> {
    this.store.clear();
    this.jobIndex.clear();
  }
}
