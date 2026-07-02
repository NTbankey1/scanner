import { describe, it, expect } from 'vitest';
import { ResourceNode } from '../../../src/domain/entities/ResourceNode';
import { NormalizedUrl } from '../../../src/domain/value-objects/NormalizedUrl';
import { CrawlDepth } from '../../../src/domain/value-objects/CrawlDepth';
import { ResourceType, ResourceStatus } from '../../../src/shared/types';
import { JsonExporter } from '../../../src/application/export/JsonExporter';
import { CsvExporter } from '../../../src/application/export/CsvExporter';
import { MdExporter } from '../../../src/application/export/MdExporter';
import { HtmlExporter } from '../../../src/application/export/HtmlExporter';

function makeNode(id: string, url: string, type: ResourceType, depth: number): ResourceNode {
  const node = new ResourceNode(id, new NormalizedUrl(url), type, new CrawlDepth(depth));
  node.updateStatus(ResourceStatus.Discovered);
  return node;
}

const sampleNodes = [
  makeNode('1', 'https://example.com/', ResourceType.HTML, 0),
  makeNode('2', 'https://example.com/style.css', ResourceType.CSS, 1),
  makeNode('3', 'https://example.com/app.js', ResourceType.JavaScript, 1),
  makeNode('4', 'https://example.com/logo.png', ResourceType.Image, 2),
];

describe('JsonExporter', () => {
  it('should export JSON', async () => {
    const exporter = new JsonExporter();
    const blob = exporter.export(sampleNodes);
    const text = await blob.text();
    expect(text).toContain('https://example.com/');
    expect(exporter.mimeType).toBe('application/json');
    expect(exporter.fileExtension).toBe('json');
  });
});

describe('CsvExporter', () => {
  it('should export CSV with headers', async () => {
    const exporter = new CsvExporter();
    const blob = exporter.export(sampleNodes);
    const text = await blob.text();
    expect(text).toContain('URL');
    expect(text).toContain('Type');
    expect(text).toContain('https://example.com/');
    expect(exporter.mimeType).toBe('text/csv');
  });
});

describe('MdExporter', () => {
  it('should export Markdown report', async () => {
    const exporter = new MdExporter();
    const blob = exporter.export(sampleNodes);
    const text = await blob.text();
    expect(text).toContain('# Deep Site Scanner');
    expect(text).toContain('https://example.com/');
    expect(exporter.mimeType).toBe('text/markdown');
  });
});

describe('HtmlExporter', () => {
  it('should export HTML report', async () => {
    const exporter = new HtmlExporter();
    const blob = exporter.export(sampleNodes);
    const text = await blob.text();
    expect(text).toContain('<!DOCTYPE html>');
    expect(text).toContain('Crawl Report');
    expect(text).toContain('https://example.com/');
    expect(exporter.mimeType).toBe('text/html');
  });
});
