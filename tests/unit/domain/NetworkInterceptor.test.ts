import { describe, it, expect, vi } from 'vitest';

// Test the buffering and callback pattern used by NetworkInterceptor

function createBuffer(callback: (items: any[]) => void, batchSize = 5) {
  let buffer: any[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const add = (item: any) => {
    buffer.push(item);
    if (buffer.length >= batchSize) {
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, 500);
    }
  };

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (buffer.length > 0) {
      callback([...buffer]);
      buffer = [];
    }
  };

  return { add, flush };
}

describe('NetworkInterceptor buffer pattern', () => {
  it('should buffer items and flush on batch size', () => {
    const cb = vi.fn();
    const buf = createBuffer(cb, 3);

    buf.add({ url: 'https://example.com/1' });
    buf.add({ url: 'https://example.com/2' });
    buf.add({ url: 'https://example.com/3' });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([
      { url: 'https://example.com/1' },
      { url: 'https://example.com/2' },
      { url: 'https://example.com/3' },
    ]);
  });

  it('should flush remaining items', () => {
    const cb = vi.fn();
    const buf = createBuffer(cb, 10);

    buf.add({ url: 'https://example.com/1' });
    buf.add({ url: 'https://example.com/2' });

    // Simulate timer flush
    buf.flush();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([
      { url: 'https://example.com/1' },
      { url: 'https://example.com/2' },
    ]);
  });

  it('should not emit empty buffers', () => {
    const cb = vi.fn();
    const buf = createBuffer(cb, 5);
    buf.flush();
    expect(cb).not.toHaveBeenCalled();
  });

  it('should deduplicate against seen set', () => {
    const seen = new Set<string>();
    const items: string[] = [];

    const addUrl = (url: string) => {
      if (!seen.has(url)) {
        seen.add(url);
        items.push(url);
      }
    };

    addUrl('https://example.com/a');
    addUrl('https://example.com/a'); // duplicate
    addUrl('https://example.com/b');

    expect(items).toEqual(['https://example.com/a', 'https://example.com/b']);
  });
});
