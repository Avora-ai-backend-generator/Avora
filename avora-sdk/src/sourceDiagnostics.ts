/** Public position metadata only. All transformations remain in the server compiler. */
import { createHash } from "node:crypto";
import type { GenerationSnapshot } from "./generation";
import type {
  SourceMap,
  SourceOrigin,
  GeneratedLocation,
  SourceDiagnostic,
} from "../types/diagnostics";
export type {
  SourceMap,
  SourceOrigin,
  GeneratedLocation,
  SourceDiagnostic,
} from "../types/diagnostics";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const integer = (n: unknown, min = 0): n is number =>
  Number.isSafeInteger(n) && (n as number) >= min;
const decode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};
export const safeGeneratedPath = (name: unknown): name is string =>
  typeof name === "string" &&
  /^[A-Za-z0-9_./-]+\.py$/.test(name) &&
  !name.startsWith("/") &&
  !name.split("/").some((p) => !p || p === "." || p === "..");
function validOrigin(origin: any, source: string): origin is SourceOrigin {
  return (
    origin &&
    integer(origin.start) &&
    integer(origin.end, origin.start) &&
    origin.end <= source.length &&
    ["literal", "field", "section"].includes(origin.kind) &&
    (origin.sectionId === undefined ||
      (typeof origin.sectionId === "string" &&
        origin.sectionId.length <= 500)) &&
    (origin.repeatIndex === undefined ||
      (integer(origin.repeatIndex) && origin.repeatIndex <= 100))
  );
}
export function validateSourceMap(
  value: any,
  snapshot: GenerationSnapshot,
  files?: Record<string, string>,
): SourceMap | undefined {
  if (value === undefined) return;
  const source = snapshot.template.source;
  if (
    value?.version !== 1 ||
    value.framework !== snapshot.request.framework ||
    value.variantId !== snapshot.request.variant_id ||
    value.templateHash !== hash(source) ||
    !value.files ||
    typeof value.files !== "object" ||
    Array.isArray(value.files)
  )
    throw new Error(
      "Source map does not match the selected template. Generate again.",
    );
  let count = 0;
  for (const [file, raw] of Object.entries(value.files)) {
    if (
      !safeGeneratedPath(file) ||
      !Array.isArray(raw) ||
      (files && typeof files[file] !== "string")
    )
      throw new Error("Invalid generated source-map file.");
    const lines = files?.[file]?.split(/\r?\n/);
    for (const span of raw) {
      if (
        ++count > 30000 ||
        !span ||
        !integer(span.line, 1) ||
        !integer(span.column) ||
        !integer(span.endColumn, span.column + 1) ||
        !validOrigin(span.origin, source)
      )
        throw new Error("Invalid generated source-map range.");
      if (lines) {
        const line = lines[span.line - 1];
        if (line === undefined || span.endColumn > line.length)
          throw new Error("Source-map range exceeds generated source.");
        if (
          span.origin.kind === "literal" &&
          line.slice(span.column, span.endColumn) !==
            source.slice(span.origin.start, span.origin.end)
        )
          throw new Error("Source-map literal differs from authored source.");
      }
    }
  }
  return value as SourceMap;
}
function sectionOrigin(source: string, origin: SourceOrigin): SourceOrigin {
  // Only locate the enclosing authored HLV1 section. This does not expand tags.
  const tags = /\/\*__HLV1_(START|STOP)__\|(.*?)__\*\//gs;
  const stack: { type: string; id: string; start: number }[] = [],
    matches: SourceOrigin[] = [];
  for (const match of source.matchAll(tags)) {
    const props = Object.fromEntries(
      match[2]
        .split("|")
        .filter((p) => p.includes("="))
        .map((p) => {
          const i = p.indexOf("=");
          return [p.slice(0, i), decode(p.slice(i + 1))];
        }),
    );
    if (match[1] === "START")
      stack.push({ type: props.type, id: props.id, start: match.index });
    else {
      let index = stack.length - 1;
      while (
        index >= 0 &&
        (stack[index].type !== props.type || stack[index].id !== props.id)
      )
        index--;
      if (index < 0) continue;
      const start = stack.splice(index, 1)[0],
        end = match.index + match[0].length;
      if (start.start <= origin.start && end >= origin.end)
        matches.push({
          ...origin,
          start: start.start,
          end,
          kind: "section",
          sectionId: start.id,
        });
    }
  }
  return (
    matches.sort((a, b) => a.end - a.start - (b.end - b.start))[0] || {
      ...origin,
      kind: "section",
    }
  );
}
export function mapSourceDiagnostic(
  snapshot: GenerationSnapshot,
  map: SourceMap | undefined,
  issue: {
    message: string;
    code?: string;
    generated?: GeneratedLocation;
    origin?: SourceOrigin;
  },
): SourceDiagnostic {
  const generated =
    issue.generated &&
    safeGeneratedPath(issue.generated.path) &&
    integer(issue.generated.line, 1) &&
    (issue.generated.column === undefined || integer(issue.generated.column))
      ? issue.generated
      : undefined;
  let authored: SourceOrigin | undefined;
  if (map && validOrigin(issue.origin, snapshot.template.source))
    authored = issue.origin;
  if (map && generated) {
    const spans = (map.files[generated.path] || []).filter(
      (span) => span.line === generated.line,
    );
    const exact =
      generated.column !== undefined
        ? spans.find(
            (s) =>
              s.column <= generated.column! && s.endColumn > generated.column!,
          )
        : undefined;
    if (exact) {
      authored = exact.origin;
      if (authored.kind === "literal") {
        const start = authored.start + generated.column! - exact.column;
        authored = {
          ...authored,
          start,
          end: Math.min(start + 1, authored.end),
        };
      }
    } else if (spans.length)
      authored = sectionOrigin(snapshot.template.source, spans[0].origin);
  }
  return {
    code: (issue.code || "python.runtime").slice(0, 100),
    message: issue.message.slice(0, 4000),
    casePath: snapshot.casePath,
    ...(generated ? { generated } : {}),
    ...(authored
      ? {
          authored: {
            ...authored,
            path: snapshot.template.path,
            hash: map!.templateHash,
          },
        }
      : {}),
  };
}
export class GenerationDiagnosticError extends Error {
  diagnostics: SourceDiagnostic[] = [];
  sourceHash?: string;
  constructor(
    message: string,
    readonly sourceMap: unknown,
    readonly issues: unknown,
  ) {
    super(message);
    this.name = "GenerationDiagnosticError";
  }
  resolve(snapshot: GenerationSnapshot) {
    this.sourceHash = snapshot.sourceHash;
    const map = validateSourceMap(this.sourceMap, snapshot);
    if (Array.isArray(this.issues))
      this.diagnostics = this.issues
        .slice(0, 50)
        .filter((i) => typeof i?.message === "string")
        .map((issue) => mapSourceDiagnostic(snapshot, map, issue));
    return this;
  }
}
