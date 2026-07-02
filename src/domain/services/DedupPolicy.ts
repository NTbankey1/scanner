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
