import { TRACKING_PARAMS, DEFAULT_PORTS } from '../../shared/constants';

export class NormalizedUrl {
  readonly normalized: string;
  readonly origin: string;
  readonly hostname: string;
  private readonly _url: URL;

  constructor(raw: string) {
    this._url = new URL(raw);
    this.hostname = this._url.hostname.toLowerCase();
    const portStr = this._url.port ? `:${this._url.port}` : '';
    this.origin = `${this._url.protocol}//${this.hostname}${portStr}`;
    this.normalized = this.normalize();
  }

  private normalize(): string {
    const url = this._url;
    let result = `${url.protocol}//${url.hostname.toLowerCase()}`;

    const hasDefaultPort = DEFAULT_PORTS.some(
      dp => dp.scheme === url.protocol.replace(':', '') && dp.port === Number(url.port)
    );
    if (url.port && !hasDefaultPort) {
      result += `:${url.port}`;
    }

    const path = url.pathname;
    result += path.length > 1 ? path.replace(/\/$/, '') : (path || '/');

    const params = new URLSearchParams(url.search);
    const cleanParams: string[] = [];
    for (const [key, val] of params.entries()) {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        cleanParams.push(`${key}=${val}`);
      }
    }
    cleanParams.sort();
    if (cleanParams.length > 0) {
      result += '?' + cleanParams.join('&');
    }

    return result;
  }

  equals(other: NormalizedUrl): boolean {
    return this.normalized === other.normalized;
  }

  toString(): string {
    return this.normalized;
  }

  toJSON(): string {
    return this.normalized;
  }
}
