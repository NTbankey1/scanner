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
