import { logger } from '../../shared/logger';

interface DiscoveredResource {
  url: string;
  type: 'link' | 'img' | 'script' | 'stylesheet' | 'video' | 'audio' | 'source' | 'iframe' | 'icon' | 'meta';
}

const SELECTORS = [
  'a[href]',
  'img[src]',
  'script[src]',
  'link[href]',
  'video[src]',
  'audio[src]',
  'source[src]',
  'iframe[src]',
  'link[rel="icon"]',
  'link[rel="shortcut icon"]',
  'link[rel="apple-touch-icon"]',
  'meta[content]',
];

const ATTR_MAP: Record<string, string> = {
  'a': 'href',
  'img': 'src',
  'script': 'src',
  'link': 'href',
  'video': 'src',
  'audio': 'src',
  'source': 'src',
  'iframe': 'src',
  'meta': 'content',
};

export class DomScanner {
  private batchBuffer: DiscoveredResource[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_MS = 500;
  private sendCallback: (batch: DiscoveredResource[]) => void;

  constructor(sendCallback: (batch: DiscoveredResource[]) => void) {
    this.sendCallback = sendCallback;
  }

  scanDocument(): DiscoveredResource[] {
    const resources: DiscoveredResource[] = [];
    const elements = document.querySelectorAll<HTMLElement>(SELECTORS.join(','));

    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      const attr = ATTR_MAP[tag];
      if (!attr) continue;

      let value: string | null = null;
      if (tag === 'meta' && (el as HTMLMetaElement).name === 'og:image') {
        value = (el as HTMLMetaElement).content;
      } else if (tag === 'a') {
        value = (el as HTMLAnchorElement).href;
      } else if (tag === 'img') {
        value = (el as HTMLImageElement).src;
      } else if (tag === 'link') {
        value = (el as HTMLLinkElement).href;
      } else if (tag === 'video' || tag === 'audio') {
        value = (el as HTMLVideoElement | HTMLAudioElement).src;
      } else if (tag === 'source') {
        value = (el as HTMLSourceElement).src;
      } else if (tag === 'iframe') {
        value = (el as HTMLIFrameElement).src;
      }

      if (value && value.startsWith('http')) {
        resources.push({ url: value, type: tag as any });
      }
    }

    // Also scan meta tags for Open Graph images
    const ogImages = document.querySelectorAll('meta[property="og:image"]');
    ogImages.forEach(el => {
      const content = el.getAttribute('content');
      if (content && content.startsWith('http')) {
        resources.push({ url: content, type: 'meta' });
      }
    });

    logger.debug('DomScanner', `Scanned DOM: found ${resources.length} resources`);
    return resources;
  }

  scanAndBatch(): void {
    const resources = this.scanDocument();
    this.batchBuffer.push(...resources);

    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flushBatch(), this.BATCH_MS);
    }
  }

  private flushBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    if (this.batchBuffer.length > 0) {
      this.sendCallback([...this.batchBuffer]);
      this.batchBuffer = [];
    }
  }
}
