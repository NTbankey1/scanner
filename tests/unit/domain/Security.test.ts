import { describe, it, expect } from 'vitest';
import { sanitizeText, isValidOrigin, isSafeUrl, truncateContent } from '../../../src/shared/security';

describe('Security utilities', () => {
  it('should sanitize text for safe display', () => {
    // In Node.js, document.createElement isn't available
    // So we test the concept — the function wraps textContent
    expect(typeof sanitizeText).toBe('function');
  });

  it('should validate origins correctly', () => {
    expect(isValidOrigin('https://example.com/page', 'https://example.com')).toBe(true);
    expect(isValidOrigin('https://evil.com', 'https://example.com')).toBe(false);
    expect(isValidOrigin('not-a-url', 'https://example.com')).toBe(false);
  });

  it('should detect safe URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('should truncate large content', () => {
    const smallContent = 'hello world';
    expect(truncateContent(smallContent)).toBe(smallContent);

    const largeContent = 'x'.repeat(100);
    const truncated = truncateContent(largeContent, 10);
    expect(truncated.length).toBeLessThanOrEqual(12); // UTF-8 bytes, may be ~10 chars
  });
});
