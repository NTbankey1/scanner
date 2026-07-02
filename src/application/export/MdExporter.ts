import { ResourceNode } from '../../domain/entities/ResourceNode';
import type { IExporter } from './IExporter';

export class MdExporter implements IExporter {
  readonly format = 'markdown';
  readonly mimeType = 'text/markdown';
  readonly fileExtension = 'md';

  export(nodes: ResourceNode[], _options?: Record<string, unknown>): Blob {
    const lines: string[] = [];

    lines.push('# Deep Site Scanner — Export Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Resources found:** ${nodes.length}`);
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|---|---|');
    lines.push(`| Total URLs | ${nodes.length} |`);
    lines.push(`| HTML Pages | ${nodes.filter(n => n.resourceType === 'HTML').length} |`);
    lines.push(`| CSS Files | ${nodes.filter(n => n.resourceType === 'CSS').length} |`);
    lines.push(`| JS Files | ${nodes.filter(n => n.resourceType === 'JAVASCRIPT').length} |`);
    lines.push(`| Images | ${nodes.filter(n => n.resourceType === 'IMAGE').length} |`);
    lines.push(`| Fonts | ${nodes.filter(n => n.resourceType === 'FONT').length} |`);
    lines.push(`| API Endpoints | ${nodes.filter(n => n.resourceType === 'API').length} |`);
    lines.push('');

    // Resource list
    lines.push('## Resources');
    lines.push('');
    lines.push('| # | URL | Type | Depth | Status |');
    lines.push('|---|---|---|---|---|');

    nodes.forEach((node, i) => {
      lines.push(`| ${i + 1} | ${node.url.toString()} | ${node.resourceType} | ${node.depth.value} | ${node.status} |`);
    });

    return new Blob([lines.join('\n')], { type: this.mimeType });
  }
}
