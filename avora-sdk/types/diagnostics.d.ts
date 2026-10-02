export interface SourceOrigin {
  /** UTF-16 offsets in the authored template. */
  start: number;
  end: number;
  kind: "literal" | "field" | "section";
  sectionId?: string;
  repeatIndex?: number;
}
export interface GeneratedLocation {
  /** Relative to the generated application, never a server filesystem path. */
  path: string;
  line: number;
  /** Zero-based UTF-16 column, when available. */
  column?: number;
  hash?: string;
}
export interface SourceMap {
  version: 1;
  framework: string;
  variantId: string;
  templateHash: string;
  files: Record<
    string,
    Array<{
      line: number;
      column: number;
      endColumn: number;
      origin: SourceOrigin;
    }>
  >;
}
export interface SourceDiagnostic {
  code: string;
  message: string;
  casePath: string;
  generated?: GeneratedLocation;
  related?: GeneratedLocation[];
  authored?: SourceOrigin & { path: string; hash: string };
}
