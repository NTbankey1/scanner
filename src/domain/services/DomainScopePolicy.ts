import { NormalizedUrl } from '../value-objects/NormalizedUrl';
import { DomainScope } from '../../shared/types';

export class DomainScopePolicy {
  constructor(
    private scope: DomainScope,
    private extraDomains: string[],
  ) {}

  isAllowed(url: NormalizedUrl, startUrl: NormalizedUrl): boolean {
    switch (this.scope) {
      case DomainScope.SameOrigin:
        return url.origin === startUrl.origin;
      case DomainScope.SameDomain:
        return url.hostname.endsWith(startUrl.hostname);
      case DomainScope.SameDomainPlusList:
        return url.hostname.endsWith(startUrl.hostname) ||
          this.extraDomains.some(d => url.hostname.endsWith(d));
      case DomainScope.Unrestricted:
        return true;
    }
  }
}
