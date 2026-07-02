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
