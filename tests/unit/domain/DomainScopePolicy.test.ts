import { describe, it, expect } from 'vitest';
import { DomainScopePolicy } from '../../../src/domain/services/DomainScopePolicy';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { DomainScope } from '../../../src/shared/types';

describe('DomainScopePolicy', () => {
  const base = new NormalizedUrl('https://example.com/page');

  it('SAME_ORIGIN: allow same host', () => {
    const policy = new DomainScopePolicy(DomainScope.SameOrigin, []);
    expect(policy.isAllowed(new NormalizedUrl('https://example.com/other'), base)).toBe(true);
  });

  it('SAME_ORIGIN: reject different subdomain', () => {
    const policy = new DomainScopePolicy(DomainScope.SameOrigin, []);
    expect(policy.isAllowed(new NormalizedUrl('https://blog.example.com/page'), base)).toBe(false);
  });

  it('SAME_DOMAIN: allow subdomain', () => {
    const policy = new DomainScopePolicy(DomainScope.SameDomain, []);
    expect(policy.isAllowed(new NormalizedUrl('https://blog.example.com/page'), base)).toBe(true);
  });

  it('SAME_DOMAIN: reject different domain', () => {
    const policy = new DomainScopePolicy(DomainScope.SameDomain, []);
    expect(policy.isAllowed(new NormalizedUrl('https://other.com/page'), base)).toBe(false);
  });

  it('SAME_DOMAIN_PLUS_LIST: allow whitelisted', () => {
    const policy = new DomainScopePolicy(DomainScope.SameDomainPlusList, ['cdn.example.com']);
    expect(policy.isAllowed(new NormalizedUrl('https://cdn.example.com/resource'), base)).toBe(true);
  });

  it('UNRESTRICTED: allow everything', () => {
    const policy = new DomainScopePolicy(DomainScope.Unrestricted, []);
    expect(policy.isAllowed(new NormalizedUrl('https://anywhere.com'), base)).toBe(true);
  });
});
