import { ResourceType } from '../../shared/types';
import { RESOURCE_TYPE_PRIORITY } from '../../shared/constants';

const EXTENSION_MAP: Record<string, ResourceType> = {
  '.html': ResourceType.HTML,
  '.htm': ResourceType.HTML,
  '.css': ResourceType.CSS,
  '.js': ResourceType.JavaScript,
  '.mjs': ResourceType.JavaScript,
  '.jpg': ResourceType.Image,
  '.jpeg': ResourceType.Image,
  '.png': ResourceType.Image,
  '.gif': ResourceType.Image,
  '.svg': ResourceType.Image,
  '.webp': ResourceType.Image,
  '.ico': ResourceType.Image,
  '.woff': ResourceType.Font,
  '.woff2': ResourceType.Font,
  '.ttf': ResourceType.Font,
  '.eot': ResourceType.Font,
  '.mp4': ResourceType.Video,
  '.webm': ResourceType.Video,
  '.mp3': ResourceType.Audio,
  '.wav': ResourceType.Audio,
  '.ogg': ResourceType.Audio,
  '.pdf': ResourceType.Document,
  '.xml': ResourceType.Document,
  '.json': ResourceType.API,
};

export function detectResourceType(url: string): ResourceType {
  const lower = url.toLowerCase();
  for (const [ext, type] of Object.entries(EXTENSION_MAP)) {
    if (lower.includes(ext)) return type;
  }
  if (url.includes('/graphql') || url.includes('/api/')) return ResourceType.API;
  if (url.startsWith('ws://') || url.startsWith('wss://')) return ResourceType.WebSocket;
  return ResourceType.Other;
}

export function getPriorityMultiplier(type: ResourceType): number {
  return RESOURCE_TYPE_PRIORITY[type] ?? 0.1;
}
