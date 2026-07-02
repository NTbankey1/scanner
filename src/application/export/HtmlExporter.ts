import { ResourceNode } from '../../domain/entities/ResourceNode';
import type { IExporter } from './IExporter';

export class HtmlExporter implements IExporter {
  readonly format = 'html';
  readonly mimeType = 'text/html';
  readonly fileExtension = 'html';

  export(nodes: ResourceNode[], _options?: Record<string, unknown>): Blob {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deep Site Scanner — Crawl Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { color: #1a1a2e; margin-bottom: 8px; }
  .meta { color: #666; margin-bottom: 24px; font-size: 14px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .stat-card .value { font-size: 24px; font-weight: 700; color: #0f3460; }
  .stat-card .label { font-size: 12px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #0f3460; color: #fff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { font-size: 13px; }
  td.url { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr:hover { background: #f8f9fa; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
  .tag-html { background: #d4edda; color: #155724; }
  .tag-css { background: #cce5ff; color: #004085; }
  .tag-js { background: #fff3cd; color: #856404; }
  .tag-img { background: #e8daef; color: #6c3483; }
  .tag-api { background: #f8d7da; color: #721c24; }
</style>
</head>
<body>
<div class="container">
<h1>Deep Site Scanner — Crawl Report</h1>
<p class="meta">Generated: ${new Date().toISOString()} | Resources: ${nodes.length}</p>

<div class="summary">
  ${this.statCard('Total', nodes.length)}
  ${this.statCard('HTML', nodes.filter(n => n.resourceType === 'HTML').length)}
  ${this.statCard('CSS', nodes.filter(n => n.resourceType === 'CSS').length)}
  ${this.statCard('JS', nodes.filter(n => n.resourceType === 'JAVASCRIPT').length)}
  ${this.statCard('Images', nodes.filter(n => n.resourceType === 'IMAGE').length)}
  ${this.statCard('API', nodes.filter(n => n.resourceType === 'API').length)}
</div>

<table>
<thead><tr><th>#</th><th>URL</th><th>Type</th><th>Depth</th><th>Status</th></tr></thead>
<tbody>
${nodes.map((n, i) => `<tr>
  <td>${i + 1}</td>
  <td class="url"><a href="${n.url}" target="_blank">${n.url}</a></td>
  <td><span class="tag tag-${n.resourceType.toLowerCase()}">${n.resourceType}</span></td>
  <td>${n.depth.value}</td>
  <td>${n.status}</td>
</tr>`).join('\n')}
</tbody>
</table>
</div>
</body>
</html>`;

    return new Blob([html], { type: this.mimeType });
  }

  private statCard(label: string, value: number): string {
    return `<div class="stat-card"><div class="value">${value}</div><div class="label">${label}</div></div>`;
  }
}
