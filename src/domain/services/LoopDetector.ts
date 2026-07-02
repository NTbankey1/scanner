/**
 * Path-based loop detection — detects when a URL has repeated path segments,
 * e.g., /category/page/page/page/... (faceting search or calendar).
 */

import { NormalizedUrl } from '../value-objects/NormalizedUrl';

const MAX_PATH_SEGMENT_REPEAT = 2;
const MAX_QUERY_PARAM_REPEAT = 5;
const SUSPICIOUS_SEGMENTS = ['page', 'category', 'tag', 'date', 'item', 'view', 'product', 'detail'];

export class LoopDetector {
  private urlDepth = new Map<string, number>();

  /**
   * Check if a URL has a repeating path structure suggesting an infinite loop.
   */
  hasPathLoop(url: NormalizedUrl): boolean {
    const segments = url.normalized.split('/').filter(Boolean);

    // Count segment repetitions
    const segmentCounts = new Map<string, number>();
    for (const seg of segments) {
      segmentCounts.set(seg, (segmentCounts.get(seg) ?? 0) + 1);
    }

    // Check for repeated suspicious segments
    for (const [seg, count] of segmentCounts) {
      if (SUSPICIOUS_SEGMENTS.includes(seg.toLowerCase()) && count > MAX_PATH_SEGMENT_REPEAT) {
        return true;
      }
    }

    // Check for unusual segment repetition (any segment appearing too many times)
    for (const count of segmentCounts.values()) {
      if (count > MAX_PATH_SEGMENT_REPEAT * 2) return true;
    }

    return false;
  }

  /**
   * Check for faceted search explosion: excessive query params.
   */
  hasQueryParamExplosion(url: NormalizedUrl): boolean {
    const queryStart = url.normalized.indexOf('?');
    if (queryStart === -1) return false;

    const params = url.normalized.slice(queryStart + 1).split('&');
    return params.length > MAX_QUERY_PARAM_REPEAT;
  }

  /**
   * Track URL visit depth — detects if we're crawling the same URL structure
   * at ever-increasing depths.
   */
  trackVisit(url: NormalizedUrl): boolean {
    const hash = url.normalized;
    const count = this.urlDepth.get(hash) ?? 0;
    this.urlDepth.set(hash, count + 1);

    // If a URL has been visited more than expected, it might be a redirect loop
    return count < 3; // Allow max 3 visits to the same URL
  }

  /**
   * Check if a URL looks like a calendar or infinite scrolling pattern.
   * E.g., /page/2024/01/02 → /page/2024/01/03 → ... endless
   */
  hasInfinitePattern(url: NormalizedUrl): boolean {
    const segments = url.normalized.split('/').filter(Boolean);

    // Check for numeric-only segments (dates, page numbers)
    const numericSegments = segments.filter(s => /^\d+$/.test(s));
    if (numericSegments.length > 2) return true; // suspicious: 3+ numeric segments

    // Check for /page/N pattern
    for (let i = 0; i < segments.length - 1; i++) {
      if (SUSPICIOUS_SEGMENTS.includes(segments[i].toLowerCase()) && /^\d+$/.test(segments[i + 1])) {
        // There might be /page/1, /page/2, etc. — not inherently bad unless we've seen many
        const key = segments.slice(0, i + 1).join('/');
        const count = this.urlDepth.get(key) ?? 0;
        if (count > 20) return true; // 20+ pages = likely infinite
      }
    }

    return false;
  }
}
