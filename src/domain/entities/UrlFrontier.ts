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
