import type { CanvasMarkdownParser } from "./markdown-parser.ts";

interface ParsedObject {
  source: string;
  revision: number;
  html: string;
}

interface ParsedSource {
  revision: number;
  html: string;
}

export class MarkdownHtmlCache {
  private readonly parser: CanvasMarkdownParser;
  private readonly objects = new Map<string, ParsedObject>();
  private readonly sources = new Map<string, ParsedSource>();
  private readonly standaloneSources = new Set<string>();
  private currentRevision = 0;

  constructor(parser: CanvasMarkdownParser) {
    this.parser = parser;
  }

  get revision(): number {
    return this.currentRevision;
  }

  htmlFor(source: string): string {
    this.standaloneSources.add(source);
    return this.renderSource(source);
  }

  htmlForObject(objectId: string, source: string): string {
    const cached = this.objects.get(objectId);
    if (cached?.source === source && cached.revision === this.currentRevision) {
      return cached.html;
    }
    if (cached?.source !== source) this.releaseSource(cached?.source, objectId);
    const html = this.renderSource(source);
    this.objects.set(objectId, { source, revision: this.currentRevision, html });
    return html;
  }

  invalidateObject(objectId: string): void {
    const source = this.objects.get(objectId)?.source;
    this.objects.delete(objectId);
    this.releaseSource(source, objectId);
  }

  invalidateResolvedLatex(): void {
    this.currentRevision++;
    this.sources.clear();
    this.standaloneSources.clear();
  }

  prune(activeObjectIds: ReadonlySet<string>): void {
    for (const objectId of this.objects.keys()) {
      if (!activeObjectIds.has(objectId)) this.invalidateObject(objectId);
    }
  }

  clear(): void {
    this.objects.clear();
    this.sources.clear();
    this.standaloneSources.clear();
  }

  size(): { objects: number; sources: number } {
    return { objects: this.objects.size, sources: this.sources.size };
  }

  private renderSource(source: string): string {
    const cached = this.sources.get(source);
    if (cached?.revision === this.currentRevision) return cached.html;
    const html = this.parser.render(source);
    this.sources.set(source, { revision: this.currentRevision, html });
    return html;
  }

  private releaseSource(source: string | undefined, excludingObjectId: string): void {
    if (!source || this.standaloneSources.has(source)) return;
    const retained = [...this.objects.entries()].some(
      ([objectId, entry]) => objectId !== excludingObjectId && entry.source === source,
    );
    if (!retained) this.sources.delete(source);
  }
}
