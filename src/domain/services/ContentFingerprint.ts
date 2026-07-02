/**
 * Lightweight content fingerprint using SimHash-like approach.
 * Detects when different URLs return identical content (e.g., session IDs in URL).
 */

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return hash;
}

const MAX_TOKENS = 1000;
const FINGERPRINT_HASH_BITS = 64;

export class ContentFingerprint {
  private fingerprints = new Map<number, string>(); // hash -> original URL
  private fuzzySet: number[] = [];

  /**
   * Generate a fingerprint from HTML/text content.
   * Strips whitespace and produces a hash.
   */
  generate(content: string): number {
    const normalized = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Take first MAX_TOKENS significant words
    const words = normalized.split(/\s+/).filter(w => w.length > 2).slice(0, MAX_TOKENS);

    // SimHash-style: count bits for each token hash
    const bits = new Int32Array(FINGERPRINT_HASH_BITS);
    for (const word of words) {
      const h = hashString(word);
      for (let i = 0; i < FINGERPRINT_HASH_BITS; i++) {
        if ((h & (1 << (i % 32))) !== 0) {
          bits[i]++;
        } else {
          bits[i]--;
        }
      }
    }

    // Convert to final hash
    let fingerprint = 0;
    for (let i = 0; i < FINGERPRINT_HASH_BITS; i++) {
      if (bits[i] > 0) {
        fingerprint |= (1 << (i % 32));
      }
    }

    return fingerprint;
  }

  /**
   * Check if content is a duplicate (same fingerprint as previously seen).
   */
  isDuplicate(content: string): boolean {
    const fp = this.generate(content);
    return this.fingerprints.has(fp);
  }

  /**
   * Register content as seen.
   */
  register(content: string, url: string): void {
    const fp = this.generate(content);
    this.fingerprints.set(fp, url);
    this.fuzzySet.push(fp);

    // Keep only recent fingerprints (last 10000)
    if (this.fuzzySet.length > 10000) {
      const removed = this.fuzzySet.shift()!;
      this.fingerprints.delete(removed);
    }
  }

  /**
   * Hamming distance between two fingerprints (lower = more similar).
   */
  static hammingDistance(a: number, b: number): number {
    let xor = a ^ b;
    let distance = 0;
    while (xor) {
      distance += xor & 1;
      xor >>>= 1;
    }
    return distance;
  }
}
