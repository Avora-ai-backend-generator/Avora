/** Browser-independent authoring contract. No VS Code, filesystem or app imports. */
import { logoAssets, hydrateAppearance, appearanceIssues } from "./appearance";
export * from "./appearance";
import { safeArtifactPath, type SourceArtifact } from "./project";
import { safeDependencyPath, dependenciesToDeclarations, migrateDependencyFiles, type DependencyFile } from "./dependencies";
export * from "./dependencies";
export * from "./project";
export type JsonObject = Record<string, any>;
export interface DraftPayload {
  node_config: JsonObject;
  code_bundle: JsonObject;
  [key: string]: any;
}
export interface NodeDraft {
  draft_id: string;
  revision: number;
  payload: DraftPayload;
  updated_at?: string;
}
export interface NodeDraftSummary {
  draft_id: string;
  revision: number;
  label: string;
  updated_at?: string;
}
export interface TemplateFile {
  path: string;
  framework: string;
  variantIds: string[];
}
export interface NodeManifest {
  formatVersion: 1 | 2 | 3 | 4;
  projectId?: string;
  draftId?: string;
  revision?: number;
  payload: DraftPayload;
  templates: TemplateFile[];
  artifacts?: SourceArtifact[];
  dependencyFiles?: DependencyFile[];
}
export interface Diagnostic {
  message: string;
  severity: "error" | "warning" | "info";
  start: number;
  end: number;
  code: string;
}
export interface Tag {
  kind: "START" | "STOP" | "FIELD";
  id: string;
  type: string;
  name: string;
  start: number;
  end: number;
}
export interface TagSuggestion {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  suggestionKind: string;
  /** Names and IDs understood by existing published templates. */
  aliases?: string[];
}
export const FRAMEWORKS: Record<
  string,
  { language: string; extension: string }
> = {
  fastapi: { language: "python", extension: "py" },
  django: { language: "python", extension: "py" },
  nestjs: { language: "typescript", extension: "ts" },
  spring: { language: "java", extension: "java" },
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const tagPattern = () => /\/\*__HLV1_(START|STOP|FIELD)__\|([\s\S]*?)__\*\//g;
export function parseTags(source: string): {
  tags: Tag[];
  diagnostics: Diagnostic[];
} {
  const tags: Tag[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const match of source.matchAll(tagPattern())) {
    const props: Record<string, string> = {};
    try {
      for (const part of match[2].split("|")) {
        const at = part.indexOf("=");
        if (at > 0)
          props[part.slice(0, at)] = decodeURIComponent(part.slice(at + 1));
      }
      if (props.options) JSON.parse(props.options);
    } catch {
      diagnostics.push({
        start: match.index!,
        end: match.index! + match[0].length,
        message: "Invalid tag encoding or options JSON.",
        severity: "error",
        code: "tag.encoding",
      });
    }
    tags.push({
      kind: match[1] as Tag["kind"],
      id: props.id || props.name || "",
      type: props.type || "",
      name: props.name || props.id || "",
      start: match.index!,
      end: match.index! + match[0].length,
    });
  }
  for (const match of source.matchAll(/\/\*__HLV1_/g))
    if (!tags.some((t) => t.start === match.index))
      diagnostics.push({
        start: match.index!,
        end: match.index! + 12,
        message: "Incomplete or malformed Avora tag.",
        severity: "error",
        code: "tag.malformed",
      });
  return { tags, diagnostics };
}
export function makeTag(
  kind: Tag["kind"],
  type: string,
  id: string,
  name = id,
): string {
  return `/*__HLV1_${kind}__|type=${type}|id=${encodeURIComponent(id)}|name=${encodeURIComponent(name)}__*/`;
}
/** Catalogue derives from the visual contract, never from labels invented by an agent. */
export function getTagCatalog(config: JsonObject): TagSuggestion[] {
  const result: TagSuggestion[] = [];
  const seen = new Set<string>();
  const add = (
    kind: string,
    type: string,
    id: unknown,
    label: unknown,
    options?: unknown,
    aliases: unknown[] = [],
  ) => {
    if (typeof id !== "string" || !id) return;
    const key = `${kind === "field" ? "FIELD" : "START"}:${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const name = String(label || id);
    let marker = makeTag(kind === "field" ? "FIELD" : "START", type, id, name);
    if (kind === "field" && options)
      marker = marker.replace(
        "__*/",
        `|options=${encodeURIComponent(JSON.stringify(options))}__*/`,
      );
    result.push({
      id,
      type,
      label: name,
      suggestionKind: kind,
      aliases: [...new Set([id, name, ...aliases].filter((v): v is string => typeof v === "string" && !!v))],
      placeholder:
        kind === "field"
          ? marker
          : `${marker}\n\n${makeTag("STOP", type, id, name)}`,
    });
  };
  const elements = (pack: JsonObject | undefined, prefix = "") => {
    for (const out of pack?.outputs?.defaults || [])
      add(
        "output",
        "outputs",
        `${prefix}output:${out.id || out.key}`,
        out.key || out.id,
        undefined,
        [out.id, out.key, `output:${out.id || out.key}`],
      );
    for (const flow of pack?.logicFlows || [])
      add(
        "logicflow",
        "logicflow",
        `${prefix}logicflow:${flow.id}`,
        flow.title || flow.id,
        undefined,
        [flow.id, `logicflow:${flow.id}`],
      );
    for (const err of pack?.errors || [])
      add("error", "error", `${prefix}error:${err.id}`, err.message || err.id, undefined, [err.id, `error:${err.id}`]);
  };
  const fields = (values: JsonObject[] = []) => {
    for (const field of values) {
      if (field.kind === "text") continue;
      add("field", "config", field.id, field.label, field.options);
      for (const option of field.options || []) {
        fields(option.addFields);
        elements(option.overrideElements);
      }
    }
  };
  const line = (row: JsonObject) => {
    add("line", "config", row.id, row.label);
    fields(row.fields);
    elements(row.appendElements);
    for (const instance of row.instances || []) {
      add("line", "config", instance.id || instance.instanceId, instance.label);
      fields(instance.fields);
      elements(instance.appendElements);
    }
  };
  for (const v of config.variants || []) {
    add("variant", "config", v.id || v.title, v.title);
    for (const row of v.lines || []) line(row);
    elements(v.elements);
    for (const instance of v.instances || [])
      elements(instance.elements, `instance:${instance.instanceId || instance.id}:`);
    for (const p of v.elementPacks || []) {
      elements(p.elements || p, `pack:${p.id}:`);
      for (const instance of p.instances || [])
        elements(instance.elements, `pack:${p.id}:instance:${instance.instanceId || instance.id}:`);
    }
    for (const c of v.conditions || [])
      add("condition", "config", `condition:${c.id}`, c.label, undefined, [c.id]);
  }
  return result;
}
const normalizeTagName = (name: string) => name.trim().toLowerCase();
const normalizeTagType = (type: string) => {
  const normalized = normalizeTagName(type);
  return ({ output: "outputs", errors: "error", logicflows: "logicflow" } as Record<string, string>)[normalized] || normalized;
};
export function matchesTag(tag: Tag, suggestion: TagSuggestion): boolean {
  if (normalizeTagType(tag.type) !== normalizeTagType(suggestion.type)) return false;
  if (tag.kind === "FIELD") return suggestion.suggestionKind === "field" && tag.id === suggestion.id;
  if (suggestion.suggestionKind === "field") return false;
  // The generator also resolves legacy sections by their visible name. Keep
  // field identity strict so a renamed field cannot silently bind elsewhere.
  return (suggestion.aliases || [suggestion.id, suggestion.label]).some(alias =>
    [tag.id, tag.name].some(name => normalizeTagName(name) === normalizeTagName(alias)),
  );
}
export function validateTemplate(
  source: string,
  config?: JsonObject,
  variantIds?: string[],
): Diagnostic[] {
  const parsed = parseTags(source);
  const issues = [...parsed.diagnostics];
  const stack: Tag[] = [];
  const catalog = config ? getTagCatalog(config) : [];
  const issue = (
    tag: Tag,
    message: string,
    code: string,
    severity: Diagnostic["severity"] = "error",
  ) => issues.push({ start: tag.start, end: tag.end, message, code, severity });
  for (const tag of parsed.tags) {
    if (!tag.id || !tag.type)
      issue(tag, "A tag must have a type and stable ID.", "tag.identity");
    if (tag.kind === "START") stack.push(tag);
    if (tag.kind === "STOP") {
      const top = stack[stack.length - 1];
      if (!top || top.id !== tag.id || top.type !== tag.type)
        issue(
          tag,
          "Closing tag does not match the enclosing section.",
          "tag.nesting",
        );
      else stack.pop();
    }
    if (
      config &&
      tag.kind !== "STOP" &&
      !catalog.some(
        (c) =>
          matchesTag(tag, c),
      )
    )
      issue(
        tag,
        `Unknown ${tag.kind === "FIELD" ? "field" : "section"}: ${tag.id}.`,
        "tag.unknown",
        "warning",
      );
  }
  for (const tag of stack)
    issue(tag, `Missing closing tag for ${tag.name}.`, "tag.unclosed");
  for (const id of variantIds || []) {
    if (
      !parsed.tags.some(
        (t) => t.kind === "START" && t.type === "config" && t.id === id,
      )
    )
      issues.push({
        start: 0,
        end: Math.min(source.length, 1),
        message: `Missing variant section: ${id}.`,
        severity: "error",
        code: "variant.missing",
      });
  }
  if (!source.trim())
    issues.push({
      start: 0,
      end: 0,
      message: "Template is empty.",
      severity: "error",
      code: "template.empty",
    });
  return issues;
}
export interface Projection {
  code: string;
  offsets: number[];
  variantId?: string;
}
/** Syntax projection only. Does not execute source or claim runtime/type correctness. */
export function projectPython(
  source: string,
  variantIds: string[] = [],
): Projection[] {
  const { tags } = parseTags(source);
  const spans: Array<{ start: number; end: number; variantId?: string }> = [];
  for (const id of variantIds) {
    const open = tags.find(
      (t) => t.kind === "START" && t.type === "config" && t.id === id,
    );
    const close =
      open &&
      tags.find(
        (t) =>
          t.kind === "STOP" &&
          t.type === open.type &&
          t.id === id &&
          t.start > open.start,
      );
    if (open && close)
      spans.push({ start: open.end, end: close.start, variantId: id });
  }
  if (!spans.length) spans.push({ start: 0, end: source.length });
  return spans.map((span) => {
    let text = "";
    const map: number[] = [];
    let cursor = span.start;
    const append = (value: string, origin: number, literal = false) => {
      text += value;
      for (let i = 0; i < value.length; i++)
        map.push(origin + (literal ? i : 0));
    };
    for (const tag of tags.filter(
      (t) => t.start >= span.start && t.end <= span.end,
    )) {
      append(source.slice(cursor, tag.start), cursor, true);
      if (tag.kind === "FIELD") append("__avora_field", tag.start);
      // Production generation removes section markers, including inline ones.
      // Their source positions remain recoverable through the offset map.
      cursor = tag.end;
    }
    append(source.slice(cursor, span.end), cursor, true);
    const rows = text.split("\n");
    let index = 0;
    const meaningful = rows.filter((row) => row.trim());
    const indent = Math.min(
      ...meaningful.map((row) => row.match(/^[ \t]*/)?.[0].length || 0),
      0x7fffffff,
    );
    let code = "async def __avora_check(self, db=None):\n";
    const offsets: number[] = Array(code.length).fill(span.start);
    for (const row of rows) {
      // Blank tag lines must not dictate indentation of the action body.
      const removed = row.trim()
        ? Math.min(indent, row.match(/^[ \t]*/)?.[0].length || 0)
        : row.length;
      code += "    " + row.slice(removed) + "\n";
      offsets.push(
        ...Array(4).fill(map[index] ?? span.start),
        ...map.slice(index + removed, index + row.length),
        map[index + row.length] ?? span.end,
      );
      index += row.length + 1;
    }
    code += "    pass\n";
    offsets.push(...Array(9).fill(span.end));
    return { code, offsets, variantId: span.variantId };
  });
}
export function projectedOffset(
  projection: Projection,
  line: number,
  column: number,
): number {
  const lines = projection.code.split("\n");
  let offset = 0;
  for (let i = 0; i < Math.min(line - 1, lines.length); i++)
    offset += lines[i].length + 1;
  const utf16Column = [...(lines[Math.max(0, line - 1)] || "")]
    .slice(0, Math.max(0, column - 1))
    .join("").length;
  return (
    projection.offsets[
      Math.min(offset + utf16Column, projection.offsets.length - 1)
    ] ?? 0
  );
}
export function safeTemplatePath(value: string): boolean {
  return /^templates\/[a-z0-9_-]+(?:-[0-9]+)?\.(py|ts|java)\.avora$/.test(
    value,
  );
}
export function materializeDraft(draft: NodeDraft): {
  manifest: NodeManifest;
  files: Record<string, string>;
} {
  const payload = clone(draft.payload);
  const files: Record<string, string> = {};
  const templates: TemplateFile[] = [];
  const artifacts: SourceArtifact[] = [];
  const logoErrors = appearanceIssues(payload.node_config, true);
  if (logoErrors.length) throw new Error(logoErrors[0]);
  for (const asset of logoAssets(payload.node_config)) {
    if (files[asset.path] && files[asset.path] !== asset.data) throw new Error('Conflicting logo assets.');
    files[asset.path] = asset.data!;
    delete asset.data;
  }
  const authoring = payload.authoring;
  const dependencyFiles: DependencyFile[] = [];
  if (authoring?.dependencyFiles) {
    for (const [file, source] of Object.entries(authoring.dependencyFiles)) {
      if (!safeDependencyPath(file) || typeof source !== "string" || !payload.code_bundle.fastapi) throw new Error("Invalid dependency source in draft.");
      const declarations = dependenciesToDeclarations(source);
      const stable = (v: unknown): string => JSON.stringify(v, (_k, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])) : value);
      if (stable(declarations) !== stable(payload.code_bundle.fastapi.dependencies || [])) throw new Error("Draft dependency source differs from its declarations. Reconcile changes made by an older client before opening it.");
      dependencyFiles.push({framework:"fastapi",path:file});
      files[file] = source;
      delete payload.code_bundle.fastapi.dependencies;
    }
    delete authoring.dependencyFiles;
  }
  const hasAuthoring = authoring?.formatVersion === 1 && typeof authoring.projectId === "string" && authoring.files && typeof authoring.files === "object" && !Array.isArray(authoring.files);
  if (hasAuthoring) {
    for (const [path, value] of Object.entries(authoring.files)) {
      if (!safeArtifactPath(path)) throw new Error(`Unsafe authoring file: ${path}`);
      artifacts.push({ path, kind: path.startsWith("tests/cases/") ? "scenario" : "context" });
      files[path] = JSON.stringify(value, null, 2) + "\n";
    }
    authoring.files = {};
  }
  for (const [framework, bundle] of Object.entries(payload.code_bundle)) {
    const adapter = FRAMEWORKS[framework];
    if (!adapter) throw new Error(`Unsupported framework: ${framework}`);
    const groups = new Map<string, string[]>();
    for (const [id, variant] of Object.entries(bundle.variants || {}) as [
      string,
      JsonObject,
    ][]) {
      const code = String(variant.code || "");
      groups.set(code, [...(groups.get(code) || []), id]);
      delete variant.code;
    }
    let index = 0;
    for (const [code, variantIds] of groups) {
      const file = `templates/${framework}${index ? `-${index}` : ""}.${adapter.extension}.avora`;
      index++;
      files[file] = code;
      templates.push({ path: file, framework, variantIds });
    }
  }
  return {
    manifest: {
      formatVersion: payload.node_config.logo ? 4 : dependencyFiles.length ? 3 : hasAuthoring ? 2 : 1,
      ...(payload.node_config.logo ? {projectId: authoring?.projectId || draft.draft_id} : {}),
      ...(dependencyFiles.length ? {dependencyFiles, projectId: authoring?.projectId || draft.draft_id} : {}),
      ...(hasAuthoring ? { projectId: authoring.projectId, artifacts } : {}),
      draftId: draft.draft_id,
      revision: draft.revision,
      payload,
      templates,
    },
    files,
  };
}
export function assembleDraft(
  manifest: NodeManifest,
  files: Record<string, string>,
): DraftPayload {
  if (
    ![1, 2, 3, 4].includes(manifest.formatVersion) ||
    !Array.isArray(manifest.templates) ||
    !manifest.payload?.node_config ||
    !manifest.payload.code_bundle
  )
    throw new Error("Invalid avora.node.json format.");
  const payload = clone(manifest.payload);
  payload.node_config = hydrateAppearance(payload.node_config, files);
  if (manifest.artifacts) {
    payload.authoring = { ...payload.authoring, formatVersion: 1, projectId: manifest.projectId, files: {} };
    const paths = new Set<string>();
    for (const artifact of manifest.artifacts) {
      if (!safeArtifactPath(artifact.path, artifact.kind) || paths.has(artifact.path)) throw new Error(`Invalid authoring file: ${artifact.path}`);
      paths.add(artifact.path);
      if (typeof files[artifact.path] !== "string") throw new Error(`Missing authoring file: ${artifact.path}`);
      payload.authoring.files[artifact.path] = JSON.parse(files[artifact.path]);
    }
  }
  if (manifest.dependencyFiles) {
    payload.authoring = {...payload.authoring, formatVersion:1, projectId:manifest.projectId, dependencyFiles:{}};
    const seenFrameworks = new Set<string>();
    for (const entry of manifest.dependencyFiles) {
      if (manifest.formatVersion < 3 || !safeDependencyPath(entry.path) || entry.framework !== "fastapi" || seenFrameworks.has(entry.framework) || typeof files[entry.path] !== "string" || !payload.code_bundle[entry.framework]) throw new Error("Missing or invalid dependency file mapping.");
      if (Object.hasOwn(payload.code_bundle[entry.framework], "dependencies")) throw new Error("Dependencies belong in requirements.txt. Remove the duplicate declarations from avora.node.json.");
      seenFrameworks.add(entry.framework);
      payload.code_bundle[entry.framework].dependencies = dependenciesToDeclarations(files[entry.path]);
      payload.authoring.dependencyFiles[entry.path] = files[entry.path];
    }
  }
  const seen = new Set<string>();
  for (const entry of manifest.templates) {
    if (!safeTemplatePath(entry.path) || typeof files[entry.path] !== "string")
      throw new Error(`Missing or unsafe template file: ${entry.path}`);
    if (!FRAMEWORKS[entry.framework] || !Array.isArray(entry.variantIds))
      throw new Error("Invalid template mapping.");
    for (const id of entry.variantIds) {
      const key = `${entry.framework}:${id}`;
      if (seen.has(key)) throw new Error(`Duplicate variant mapping: ${key}`);
      seen.add(key);
      const variant = payload.code_bundle[entry.framework]?.variants?.[id];
      if (!variant) throw new Error(`Unknown variant mapping: ${key}`);
      variant.code = files[entry.path];
    }
  }
  for (const [fw, bundle] of Object.entries(payload.code_bundle))
    for (const id of Object.keys(bundle.variants || {}))
      if (!seen.has(`${fw}:${id}`))
        throw new Error(`Missing template mapping for ${fw}:${id}`);
  return payload;
}
/** Create a portable local project. The caller supplies identity; no network or login is used. */
export function createLocalProject(label: string, projectId: string) {
  if (!label.trim() || !projectId.trim()) throw new Error("A node name and project ID are required.");
  const source = [
    makeTag("START", "config", "main", "Main"),
    makeTag("START", "config", "message-line", "Message"),
    `message = ${makeTag("FIELD", "config", "message", "Message")}`,
    makeTag("STOP", "config", "message-line", "Message"),
    "# Add your node implementation here.", "pass",
    makeTag("STOP", "config", "main", "Main"), "",
  ].join("\n");
  const project = materializeDraft({ draft_id: "", revision: 0, payload: {
    icon_name: "Box",
    node_config: { label: label.trim(), description: "", category: "Other", color: "#3b82f6", variants: [{
      id: "main", title: "Main", lines: [{ id: "message-line", label: "Message", lineType: "required", fields: [{ id: "message", kind: "input", label: "Message", fieldType: "string", defaultValue: "Hello" }] }],
      elements: { inputs: { title: "Inputs", canAdd: false, defaults: [] }, outputs: { title: "Outputs", canAdd: false, defaults: [] }, errors: [], logicFlows: [] },
    }] },
    code_bundle: { fastapi: { frameworkId: "fastapi", language: "python", baseTemplate: "", zones: [], dependencies: [], variants: { main: { variantId: "main", header: "", snippets: [], code: source } } } },
    authoring: { formatVersion: 1, projectId, files: {
      "tests/cases/example.avora-test.json": { formatVersion: 1, id: "example", label: "Example", framework: "fastapi", variantId: "main", context: "tests/context/workspace.json", configuration: { lineValues: { message: "Hello" }, deletedLineIds: [] }, inputs: {} },
      "tests/context/workspace.json": { formatVersion: 1, id: "scratch", graph: { nodes: [], edges: [] }, settings: { name: "NodeScratch", framework: "fastapi", database_type: "sqlite" } },
    } },
  } });
  project.manifest.formatVersion = 2;
  project.manifest.projectId = projectId;
  delete project.manifest.draftId;
  delete project.manifest.revision;
  const migrated = migrateDependencyFiles(project.manifest);
  return {manifest:migrated.manifest, files:{...project.files,...migrated.files}};
}
export class DraftConflictError extends Error {
  constructor() {
    super(
      "This draft changed elsewhere. Pull the remote draft or save your local work as a new draft.",
    );
  }
}
export class NodeDraftClient {
  constructor(
    private apiBaseUrl: string,
    private token: () => Promise<string>,
  ) {}
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<any> {
    const response = await fetch(
      `${this.apiBaseUrl.replace(/\/$/, "")}/node-drafts${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (response.status === 409) throw new DraftConflictError();
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : `Draft request failed (${response.status}).`,
      );
    return data;
  }
  list(): Promise<NodeDraftSummary[]> {
    return this.request("");
  }
  get(id: string): Promise<NodeDraft> {
    return this.request(`/${encodeURIComponent(id)}`);
  }
  create(payload: DraftPayload): Promise<NodeDraft> {
    return this.request("", "POST", { payload });
  }
  update(
    id: string,
    revision: number,
    payload: DraftPayload,
  ): Promise<NodeDraft> {
    return this.request(`/${encodeURIComponent(id)}`, "PUT", {
      revision,
      payload,
    });
  }
}
