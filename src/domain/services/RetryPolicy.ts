import { MAX_RETRIES, RETRY_BASE_DELAY_MS } from '../../shared/constants';

export interface RetryRecord {
  url: string;
  attempts: number;
  lastError: string;
  lastAttemptAt: number;
  nextRetryAt: number;
  status: 'pending' | 'failed' | 'exhausted';
}

export class RetryPolicy {
  private records = new Map<string, RetryRecord>();
  private maxRetries: number;
  private baseDelay: number;

  constructor(maxRetries = MAX_RETRIES, baseDelay = RETRY_BASE_DELAY_MS) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  recordFailure(url: string, error: string): RetryRecord {
    const existing = this.records.get(url);
    const attempts = (existing?.attempts ?? 0) + 1;
    const now = Date.now();
    const delay = this.baseDelay * Math.pow(2, attempts - 1); // exponential backoff
    const jitter = Math.random() * 0.5 * delay; // 50% max jitter

    const record: RetryRecord = {
      url,
      attempts,
      lastError: error,
      lastAttemptAt: now,
      nextRetryAt: now + delay + jitter,
      status: attempts > this.maxRetries ? 'exhausted' : 'failed',
    };

    this.records.set(url, record);
    return record;
  }

  recordSuccess(url: string): void {
    this.records.delete(url);
  }

  shouldRetry(url: string): boolean {
    const record = this.records.get(url);
    if (!record) return true; // not yet failed
    if (record.status === 'exhausted') return false;
    if (Date.now() >= record.nextRetryAt) return true;
    return false;
  }

  getRecord(url: string): RetryRecord | undefined {
    return this.records.get(url);
  }

  getPendingRetries(): RetryRecord[] {
    const now = Date.now();
    return Array.from(this.records.values())
      .filter(r => r.status === 'failed' && now >= r.nextRetryAt)
      .sort((a, b) => a.nextRetryAt - b.nextRetryAt);
  }

  get allRecords(): RetryRecord[] {
    return Array.from(this.records.values());
  }

  get exhaustedUrls(): string[] {
    return Array.from(this.records.values())
      .filter(r => r.status === 'exhausted')
      .map(r => r.url);
  }

  clear(): void {
    this.records.clear();
  }
}
