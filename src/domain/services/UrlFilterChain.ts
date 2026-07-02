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
