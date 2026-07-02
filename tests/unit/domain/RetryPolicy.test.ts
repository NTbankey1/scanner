import { describe, it, expect } from 'vitest';
import { RetryPolicy } from '../../../src/domain/services/RetryPolicy';

describe('RetryPolicy', () => {
  it('should start with no records', () => {
    const policy = new RetryPolicy(3, 100);
    expect(policy.allRecords.length).toBe(0);
  });

  it('should record failure and increment attempts', () => {
    const policy = new RetryPolicy(3, 100);
    const record = policy.recordFailure('https://example.com', 'timeout');
    expect(record.attempts).toBe(1);
    expect(record.lastError).toBe('timeout');
    expect(record.status).toBe('failed');
  });

  it('should mark as exhausted after max retries', () => {
    const policy = new RetryPolicy(2, 100);
    policy.recordFailure('https://example.com', 'err1');
    policy.recordFailure('https://example.com', 'err2');
    const record = policy.recordFailure('https://example.com', 'err3');
    expect(record.status).toBe('exhausted');
  });

  it('should not retry exhausted URLs', () => {
    const policy = new RetryPolicy(1, 100);
    policy.recordFailure('https://example.com', 'err');
    policy.recordFailure('https://example.com', 'err');
    expect(policy.shouldRetry('https://example.com')).toBe(false);
  });

  it('should clear URL on success', () => {
    const policy = new RetryPolicy(3, 100);
    policy.recordFailure('https://example.com', 'timeout');
    expect(policy.allRecords.length).toBe(1);
    policy.recordSuccess('https://example.com');
    expect(policy.allRecords.length).toBe(0);
  });

  it('should apply exponential backoff', () => {
    const policy = new RetryPolicy(3, 1000);
    const r1 = policy.recordFailure('https://example.com', 'err');
    const r2 = policy.recordFailure('https://example.com', 'err');
    const delay1 = r1.nextRetryAt - r1.lastAttemptAt;
    const delay2 = r2.nextRetryAt - r2.lastAttemptAt;
    expect(delay2).toBeGreaterThan(delay1);
  });
});
