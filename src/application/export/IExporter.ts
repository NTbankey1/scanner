import { ResourceNode } from '../../domain/entities/ResourceNode';

export interface IExporter {
  readonly format: string;
  readonly mimeType: string;
  readonly fileExtension: string;

  export(nodes: ResourceNode[], options?: Record<string, unknown>): Blob;
  exportStream?(nodes: ResourceNode[], options?: Record<string, unknown>): AsyncIterable<string>;
}
