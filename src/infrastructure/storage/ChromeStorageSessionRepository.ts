import { UrlFrontier } from '../../domain/entities/UrlFrontier';
import type { IUrlFrontierRepository } from '../../application/interfaces';

const FRONTIER_KEY = 'dss:frontier';

export class ChromeStorageSessionRepository implements IUrlFrontierRepository {
  async save(frontier: UrlFrontier): Promise<void> {
    await chrome.storage.session.set({ [FRONTIER_KEY]: frontier.toJSON() });
  }

  async load(): Promise<UrlFrontier | null> {
    const result = await chrome.storage.session.get(FRONTIER_KEY);
    const data = result[FRONTIER_KEY];
    if (!data) return null;
    return UrlFrontier.fromJSON(data);
  }

  async clear(): Promise<void> {
    await chrome.storage.session.remove(FRONTIER_KEY);
  }
}
