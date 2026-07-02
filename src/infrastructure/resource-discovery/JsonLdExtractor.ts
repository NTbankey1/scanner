export interface JsonLdEntity {
  '@type': string;
  '@id'?: string;
  url?: string;
  name?: string;
  image?: string | string[];
  sameAs?: string[];
  [key: string]: unknown;
}

export function extractJsonLdFromHtml(html: string): JsonLdEntity[] {
  const entities: JsonLdEntity[] = [];

  // Match <script type="application/ld+json">...</script>
  const pattern = /<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const raw = match[1].trim();
      const parsed = JSON.parse(raw);

      // Could be an array or single object
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && item['@type']) {
          entities.push(item as JsonLdEntity);
        }
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  return entities;
}

export function extractUrlsFromJsonLd(entities: JsonLdEntity[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (url: string) => {
    if (url && !seen.has(url) && (url.startsWith('http') || url.startsWith('/'))) {
      seen.add(url);
      urls.push(url);
    }
  };

  for (const entity of entities) {
    if (entity.url) add(entity.url);
    if (entity.image) {
      if (Array.isArray(entity.image)) {
        entity.image.forEach(add);
      } else {
        add(entity.image);
      }
    }
    if (entity['@id'] && entity['@id'].startsWith('http')) add(entity['@id']);
    if (entity.sameAs) entity.sameAs.forEach(add);

    // Recursively find URLs in nested properties
    for (const [, value] of Object.entries(entity)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const sub = value as Record<string, unknown>;
        if (sub.url && typeof sub.url === 'string') add(sub.url);
        if (sub['@id'] && typeof sub['@id'] === 'string' && sub['@id'].startsWith('http')) add(sub['@id']);
      }
    }
  }

  return urls;
}
