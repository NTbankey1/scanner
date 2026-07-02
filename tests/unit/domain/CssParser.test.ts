import { describe, it, expect } from 'vitest';
import { extractCssResources, resolveCssUrl } from '../../../src/infrastructure/resource-discovery/CssParser';

describe('CssParser', () => {
  it('should extract url() references', () => {
    const css = `.bg { background: url("https://example.com/bg.png"); }`;
    const urls = extractCssResources(css);
    expect(urls).toContain('https://example.com/bg.png');
  });

  it('should extract @import URLs', () => {
    const css = `@import url('https://example.com/fonts.css');`;
    const urls = extractCssResources(css);
    expect(urls).toContain('https://example.com/fonts.css');
  });

  it('should handle multiple url() references', () => {
    const css = `
      @font-face { src: url('/fonts/custom.woff2'); }
      .icon { background: url('/icons/check.svg'); }
    `;
    const urls = extractCssResources(css);
    expect(urls.length).toBe(2);
  });

  it('should not duplicate URLs', () => {
    const css = `a { background: url('img.png'); }
                 b { background: url('img.png'); }`;
    const urls = extractCssResources(css);
    expect(urls.filter(u => u === 'img.png').length).toBe(1);
  });

  it('should resolve relative URLs', () => {
    const resolved = resolveCssUrl('https://example.com/css/main.css', '../images/bg.png');
    expect(resolved).toBe('https://example.com/images/bg.png');
  });

  it('should not modify absolute URLs', () => {
    const resolved = resolveCssUrl('https://example.com/css/main.css', 'https://cdn.example.com/bg.png');
    expect(resolved).toBe('https://cdn.example.com/bg.png');
  });

  it('should handle data: URIs', () => {
    const resolved = resolveCssUrl('https://example.com/css/main.css', 'data:image/png;base64,abc');
    expect(resolved).toBe('data:image/png;base64,abc');
  });

  it('should extract with single quotes', () => {
    const css = `a { background: url('/path/img.jpg'); }`;
    const urls = extractCssResources(css);
    expect(urls).toContain('/path/img.jpg');
  });

  it('should extract without quotes', () => {
    const css = `a { background: url(/path/img.jpg); }`;
    const urls = extractCssResources(css);
    expect(urls).toContain('/path/img.jpg');
  });
});
