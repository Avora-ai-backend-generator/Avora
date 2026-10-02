/** Editor-only overlay of public source-map literals. No tag expansion or compiler rules. */
import { parseTags } from "./index";
import type { SourceMap } from "../types/diagnostics";

export type TextPosition = { line: number; character: number };
export type TextRange = { start: TextPosition; end: TextPosition };
export type LiteralMapping = {
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  repeatIndex?: number;
};
export function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++)
    if (text[i] === "\n") offsets.push(i + 1);
  return offsets;
}
export function offsetAt(
  text: string,
  position: TextPosition,
  lines = lineOffsets(text),
): number | undefined {
  const start = lines[position.line];
  if (
    !Number.isSafeInteger(position.line) ||
    !Number.isSafeInteger(position.character) ||
    position.character < 0 ||
    start === undefined
  )
    return;
  const end = (lines[position.line + 1] ?? text.length + 1) - 1;
  if (start + position.character > end) return;
  return start + position.character;
}
export function positionAt(
  text: string,
  offset: number,
  lines = lineOffsets(text),
): TextPosition {
  let lo = 0,
    hi = lines.length;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid] <= offset) lo = mid;
    else hi = mid;
  }
  return { line: lo, character: offset - lines[lo] };
}
function render(
  text: string,
  sourceStart: number,
  indent: string,
  repeatIndex?: number,
) {
  let code = "",
    cursor = 0;
  const mappings: LiteralMapping[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i) code += "\n" + (line.trim() ? indent : "");
    const start = code.length;
    code += line;
    mappings.push({
      start,
      end: code.length,
      sourceStart: sourceStart + cursor,
      sourceEnd: sourceStart + cursor + line.length,
      repeatIndex,
    });
    cursor +=
      line.length +
      (text.slice(cursor + line.length, cursor + line.length + 2) === "\r\n"
        ? 2
        : 1);
  }
  return { code, mappings };
}
export class LanguageProjection {
  private lines: number[];
  constructor(
    readonly source: string,
    readonly code: string,
    readonly mappings: LiteralMapping[],
  ) {
    this.lines = lineOffsets(code);
  }
  generatedPosition(sourceOffset: number): TextPosition | undefined {
    // Repeated copies have the same literal text: consistently use the first row.
    const m = this.mappings.find(
      (m) => m.sourceStart <= sourceOffset && m.sourceEnd >= sourceOffset,
    );
    if (m)
      return positionAt(
        this.code,
        m.start + sourceOffset - m.sourceStart,
        this.lines,
      );
  }
  sourceRange(
    range: TextRange,
  ): { start: number; end: number; repeatIndex?: number } | undefined {
    const start = offsetAt(this.code, range.start, this.lines),
      end = offsetAt(this.code, range.end, this.lines);
    if (start === undefined || end === undefined || end < start) return;
    const m = this.mappings.find((m) => m.start <= start && m.end >= end);
    if (m)
      return {
        start: m.sourceStart + start - m.start,
        end: m.sourceStart + end - m.start,
        repeatIndex: m.repeatIndex,
      };
  }
}

/** Only unchanged tag boundaries and provable indentation transformations are reusable. */
export function projectLanguage(
  source: string,
  baseline: string,
  generated: string,
  map: SourceMap,
  file: string,
): LanguageProjection {
  if (source.length > 2_000_000 || generated.length > 8_000_000)
    throw new Error("Template is too large for interactive Python assistance.");
  const oldTags = parseTags(baseline),
    newTags = parseTags(source);
  if (
    oldTags.diagnostics.length ||
    newTags.diagnostics.length ||
    oldTags.tags.length !== newTags.tags.length ||
    oldTags.tags.some(
      (tag, i) =>
        baseline.slice(tag.start, tag.end) !==
        source.slice(newTags.tags[i].start, newTags.tags[i].end),
    )
  )
    throw new Error(
      "Tags changed. Prepare or run this case to refresh Python context.",
    );
  const chunks = oldTags.tags.map((tag, i) => ({
    start: i ? oldTags.tags[i - 1].end : 0,
    end: tag.start,
    newStart: i ? newTags.tags[i - 1].end : 0,
    newEnd: newTags.tags[i].start,
  }));
  chunks.push({
    start: oldTags.tags.at(-1)?.end ?? 0,
    end: baseline.length,
    newStart: newTags.tags.at(-1)?.end ?? 0,
    newEnd: source.length,
  });
  const generatedLines = lineOffsets(generated);
  const groups = new Map<
    string,
    {
      chunk: number;
      start: number;
      end: number;
      sourceStart: number;
      sourceEnd: number;
      repeatIndex?: number;
    }
  >();
  for (const span of map.files[file] || []) {
    if (span.origin.kind !== "literal") continue;
    let lo = 0,
      hi = chunks.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (chunks[mid].start <= span.origin.start) lo = mid;
      else hi = mid;
    }
    const chunk = chunks[lo];
    if (span.origin.start < chunk.start || span.origin.end > chunk.end)
      continue;
    const start = generatedLines[span.line - 1] + span.column,
      end = generatedLines[span.line - 1] + span.endColumn;
    const key = lo + ":" + (span.origin.repeatIndex ?? "");
    const group = groups.get(key);
    if (group) {
      group.start = Math.min(group.start, start);
      group.end = Math.max(group.end, end);
      group.sourceStart = Math.min(group.sourceStart, span.origin.start);
      group.sourceEnd = Math.max(group.sourceEnd, span.origin.end);
    } else
      groups.set(key, {
        chunk: lo,
        start,
        end,
        sourceStart: span.origin.start,
        sourceEnd: span.origin.end,
        repeatIndex: span.origin.repeatIndex,
      });
  }
  const patches: {
    start: number;
    end: number;
    code: string;
    mappings: LiteralMapping[];
  }[] = [];
  const covered = new Set([...groups.values()].map((group) => group.chunk));
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (
      !covered.has(i) &&
      baseline.slice(chunk.start, chunk.end) !==
        source.slice(chunk.newStart, chunk.newEnd)
    )
      throw new Error(
        "This code is outside the prepared literal sections. Prepare or run this case to refresh Python context.",
      );
  }
  for (const group of groups.values()) {
    const chunk = chunks[group.chunk],
      before = baseline.slice(chunk.start, group.sourceStart),
      after = baseline.slice(group.sourceEnd, chunk.end);
    const current = source.slice(chunk.newStart, chunk.newEnd);
    if (
      before.trim() ||
      after.trim() ||
      !current.startsWith(before) ||
      !current.endsWith(after) ||
      current.length < before.length + after.length
    )
      throw new Error(
        "Section boundaries changed. Prepare or run this case to refresh Python context.",
      );
    const sourcePrefix =
      baseline
        .slice(
          baseline.lastIndexOf("\n", group.sourceStart - 1) + 1,
          group.sourceStart,
        )
        .match(/^[ \t]*/)?.[0] || "";
    const generatedPrefix =
      generated
        .slice(generated.lastIndexOf("\n", group.start - 1) + 1, group.start)
        .match(/^[ \t]*/)?.[0] || "";
    if (!generatedPrefix.endsWith(sourcePrefix))
      throw new Error(
        "Indentation changed. Refresh this case before using Python assistance.",
      );
    const indent = generatedPrefix.slice(
      0,
      generatedPrefix.length - sourcePrefix.length,
    );
    const original = baseline.slice(group.sourceStart, group.sourceEnd);
    if (
      render(original, 0, indent).code !==
      generated.slice(group.start, group.end)
    )
      throw new Error("This section needs refreshed Python context.");
    const text = current.slice(before.length, current.length - after.length);
    patches.push({
      start: group.start,
      end: group.end,
      ...render(
        text,
        chunk.newStart + before.length,
        indent,
        group.repeatIndex,
      ),
    });
  }
  patches.sort((a, b) => a.start - b.start);
  let code = "",
    cursor = 0;
  const mappings: LiteralMapping[] = [];
  for (const patch of patches) {
    if (patch.start < cursor)
      throw new Error("Ambiguous source mapping. Generate this case again.");
    code += generated.slice(cursor, patch.start);
    mappings.push(
      ...patch.mappings.map((m) => ({
        ...m,
        start: m.start + code.length,
        end: m.end + code.length,
      })),
    );
    code += patch.code;
    cursor = patch.end;
  }
  code += generated.slice(cursor);
  return new LanguageProjection(source, code, mappings);
}
