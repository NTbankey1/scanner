import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../../src/domain/services/CircuitBreaker';

describe('CircuitBreaker', () => {
  it('should start closed for all domains', () => {
    const cb = new CircuitBreaker(3, 1000);
    expect(cb.isAllowed('example.com')).toBe(true);
    expect(cb.getState('example.com')).toBe('closed');
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker(3, 10000);
    cb.recordFailure('example.com');
    cb.recordFailure('example.com');
    cb.recordFailure('example.com');
    expect(cb.isAllowed('example.com')).toBe(false);
    expect(cb.getState('example.com')).toBe('open');
  });

  it('should not affect other domains', () => {
    const cb = new CircuitBreaker(2, 10000);
    cb.recordFailure('bad.com');
    cb.recordFailure('bad.com');
    expect(cb.isAllowed('other.com')).toBe(true);
    expect(cb.isAllowed('bad.com')).toBe(false);
  });

  it('should reset on success', () => {
    const cb = new CircuitBreaker(2, 10000);
    cb.recordFailure('example.com');
    cb.recordSuccess('example.com');
    expect(cb.getFailureCount('example.com')).toBe(0);
    expect(cb.isAllowed('example.com')).toBe(true);
  });

  it('should return to half-open after reset period', () => {
    const cb = new CircuitBreaker(2, -1); // negative = immediately reset
    cb.recordFailure('example.com');
    cb.recordFailure('example.com');
    expect(cb.isAllowed('example.com')).toBe(true); // reset period passed instantly
  });

  it('should list open circuits', () => {
    const cb = new CircuitBreaker(2, 10000);
    cb.recordFailure('bad.com');
    cb.recordFailure('bad.com');
    expect(cb.getOpenCircuits()).toContain('bad.com');
  });
});
