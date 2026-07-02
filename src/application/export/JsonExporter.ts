import { ResourceNode } from '../../domain/entities/ResourceNode';
import type { IExporter } from './IExporter';

export class JsonExporter implements IExporter {
  readonly format = 'json';
  readonly mimeType = 'application/json';
  readonly fileExtension = 'json';

  export(nodes: ResourceNode[], options?: Record<string, unknown>): Blob {
    const pretty = options?.pretty !== false;
    const data = nodes.map(n => n.toJSON());
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    return new Blob([json], { type: this.mimeType });
  }
}
