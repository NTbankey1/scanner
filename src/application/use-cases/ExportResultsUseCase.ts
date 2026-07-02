import type { IResourceRepository } from '../interfaces';
import { IExporter } from '../export/IExporter';
import { JsonExporter } from '../export/JsonExporter';
import { CsvExporter } from '../export/CsvExporter';
import { MdExporter } from '../export/MdExporter';
import { HtmlExporter } from '../export/HtmlExporter';

type ExportFormat = 'json' | 'csv' | 'markdown' | 'html';

const EXPORTERS: Record<ExportFormat, () => IExporter> = {
  json: () => new JsonExporter(),
  csv: () => new CsvExporter(),
  markdown: () => new MdExporter(),
  html: () => new HtmlExporter(),
};

export interface ExportInput {
  jobId: string;
  format: ExportFormat;
  options?: Record<string, unknown>;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

export class ExportResultsUseCase {
  constructor(
    private resourceRepo: IResourceRepository,
  ) {}

  async execute(input: ExportInput): Promise<ExportResult> {
    const exporterFactory = EXPORTERS[input.format];
    if (!exporterFactory) {
      throw new Error(`Unsupported export format: ${input.format}. Supported: ${Object.keys(EXPORTERS).join(', ')}`);
    }

    const nodes = await this.resourceRepo.listByJob(input.jobId);
    const exporter = exporterFactory();
    const blob = exporter.export(nodes, input.options);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dss-crawl-${input.jobId.slice(0, 8)}-${timestamp}.${exporter.fileExtension}`;

    return { blob, filename };
  }

  static getSupportedFormats(): ExportFormat[] {
    return Object.keys(EXPORTERS) as ExportFormat[];
  }
}
