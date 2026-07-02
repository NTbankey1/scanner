import { describe, it, expect } from 'vitest';
import { ContentFingerprint } from '../../../src/domain/services/ContentFingerprint';

describe('ContentFingerprint', () => {
  it('should generate consistent fingerprints for same content', () => {
    const cf = new ContentFingerprint();
    const html1 = '<html><body><h1>Hello World</h1><p>Content</p></body></html>';
    const html2 = '<html><body><h1>Hello World</h1><p>Content</p></body></html>';
    expect(cf.generate(html1)).toBe(cf.generate(html2));
  });

  it('should detect duplicate content', () => {
    const cf = new ContentFingerprint();
    const content = '<html><body>Static content</body></html>';
    expect(cf.isDuplicate(content)).toBe(false);
    cf.register(content, 'https://example.com/page1');
    expect(cf.isDuplicate(content)).toBe(true);
  });

  it('should produce different fingerprints for different content', () => {
    const cf = new ContentFingerprint();
    const a = cf.generate('<html><body>AAAA</body></html>');
    const b = cf.generate('<html><body>BBBB</body></html>');
    expect(a).not.toBe(b);
  });

  it('should strip scripts before fingerprinting', () => {
    const cf = new ContentFingerprint();
    const withScript = '<html><script>var x=1;</script><body>Content</body></html>';
    const without = '<html><body>Content</body></html>';
    // Both should have similar fingerprints (scripts stripped)
    const similarity = 1 - (ContentFingerprint.hammingDistance(cf.generate(withScript), cf.generate(without)) / 32);
    expect(similarity).toBeGreaterThan(0.5);
  });

  it('should compute hamming distance', () => {
    // Same values = distance 0
    expect(ContentFingerprint.hammingDistance(0xFF, 0xFF)).toBe(0);
    // Completely different
    expect(ContentFingerprint.hammingDistance(0x00, 0xFF)).toBe(8);
  });
});
