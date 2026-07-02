import { ResourceNode } from '../../domain/entities/ResourceNode';
import type { IExporter } from './IExporter';

const HEADERS = ['URL', 'Type', 'Depth', 'Status', 'Content Type', 'Content Size', 'Parent ID', 'Discovered At'];

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export class CsvExporter implements IExporter {
  readonly format = 'csv';
  readonly mimeType = 'text/csv';
  readonly fileExtension = 'csv';

  export(nodes: ResourceNode[], _options?: Record<string, unknown>): Blob {
    const lines: string[] = [HEADERS.join(',')];

    for (const node of nodes) {
      lines.push([
        escapeCsv(node.url.toString()),
        escapeCsv(node.resourceType),
        String(node.depth.value),
        escapeCsv(node.status),
        escapeCsv(node.contentType || ''),
        node.contentSize ? String(node.contentSize) : '',
        node.parentId || '',
        new Date(node.discoveredAt).toISOString(),
      ].join(','));
    }

    const bom = '﻿';
    return new Blob([bom + lines.join('\n')], { type: `${this.mimeType};charset=utf-8` });
  }
}
