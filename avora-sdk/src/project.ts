import { appearanceIssues } from "./appearance";
import Ajv from "ajv";
import { safeDependencyPath } from "./dependencies";
import { parseTree, getNodeValue, findNodeAtLocation, printParseErrorCode, modify, applyEdits, type ParseError } from "jsonc-parser";
import type { Diagnostic, JsonObject, NodeManifest } from "./index";
import type { ScenarioChanges } from "../types/scenario";
export type { NodeScenario, WorkspaceContext, ScenarioChanges } from "../types/scenario";

export interface SourceArtifact { path: string; kind: "scenario" | "context" }
/** Local identity only. Do not upload private effective-configuration fingerprints. */
export interface NodeRunIdentity {
  sourceFingerprint: string;
  scenarioFingerprint: string;
  contextFingerprint: string;
  compilerVersion: string;
  dependencyFingerprint: string;
  runtimeProfileId: string;
  privateConfigurationFingerprint: string;
}
export interface ProjectIssue { pointer: string; message: string; code: string; severity: Diagnostic["severity"] }
const text = { type: "string", minLength: 1 };
const strings = { type: "array", items: text };
const objects = { type: "array", items: { type: "object" } };
const definitions = {
  field: { type: "object", required: ["id", "kind"], properties: {
    id: text, kind: { enum: ["text", "input", "select"] }, label: { type: "string" },
    fieldType: { enum: ["text", "number", "datetime", "boolean", "string"] },
    options: { type: "array", items: { type: "object", properties: {
      addFields: { type: "array", items: { $ref: "#/$defs/field" } },
      hideFields: strings, overrideElements: { $ref: "#/$defs/elements" },
    } } },
  } },
  elements: { type: "object", properties: {
    inputs: { type: "object", properties: { defaults: objects } },
    outputs: { type: "object", properties: { defaults: objects } },
    errors: objects, logicFlows: objects,
  } },
  line: { type: "object", required: ["id"], properties: {
    id: text, fields: { type: "array", items: { $ref: "#/$defs/field" } },
    lineType: { enum: ["required", "optional", "optional-multiple", "generic-object"] },
    instances: { type: "array", items: { $ref: "#/$defs/line" } },
    appendElements: { $ref: "#/$defs/elements" },
  } },
  variant: { type: "object", required: ["id"], properties: {
    id: text, title: { type: "string" }, lines: { type: "array", items: { $ref: "#/$defs/line" } },
    elements: { $ref: "#/$defs/elements" },
    elementPacks: { type: "array", items: { type: "object", required: ["id"], properties: {
      id: text, elements: { $ref: "#/$defs/elements" }, instances: objects,
    } } },
    instances: objects, conditions: objects,
  } },
};
export const projectSchemas: Record<string, JsonObject> = {
  manifest: {
    $schema: "http://json-schema.org/draft-07/schema#", $defs: definitions,
    title: "Avora node project", type: "object", required: ["formatVersion", "payload", "templates"],
    properties: {
      formatVersion: { enum: [1, 2, 3, 4] }, projectId: text,
      draftId: { type: "string", pattern: "^[a-f0-9]{32}$" }, revision: { type: "integer", minimum: 1 },
      payload: { type: "object", required: ["node_config", "code_bundle"], properties: {
        node_config: { type: "object", required: ["variants"], properties: {
          color: { type: "string", description: "Heading accent: #RRGGBB. Avora fixes the background tint at 10%. Legacy palette classes remain supported." },
          colorSource: { enum: ["logo", "manual"], description: "Manual colors survive logo replacement; logo uses the default image's dominant color." },
          logo: { type: "object", required: ["light"], additionalProperties: false, properties: Object.fromEntries(["light", "dark"].map(theme => [theme, {
            type: "object", required: ["path"], additionalProperties: false,
            properties: { path: {type:"string", pattern:"^assets/[a-z0-9_-]+\\.png$", description: "Portable PNG created by avora node appearance --logo."} },
          }])) },
          label: { type: "string" }, variants: { type: "array", minItems: 1, items: { $ref: "#/$defs/variant" } },
        } },
        code_bundle: { type: "object", additionalProperties: { type: "object", properties: {
          variants: { type: "object", additionalProperties: { type: "object" } },
          dependencies: { type: "array", items: { type: "object", required: ["name"], properties: { name: text, version: { type: "string" }, importLine: { type: "string" } } } },
        } } },
      } },
      templates: { type: "array", items: { type: "object", required: ["path", "framework", "variantIds"], properties: {
        path: { type: "string", pattern: "^templates/[a-z0-9_-]+\\.(py|ts|java)\\.avora$" }, framework: { enum: ["fastapi", "django", "nestjs", "spring"] }, variantIds: { ...strings, minItems: 1, uniqueItems: true },
      } } },
      dependencyFiles: { type: "array", minItems: 1, items: { type: "object", required: ["path", "framework"], properties: {path:text,framework:{const:"fastapi"}} } },
      artifacts: { type: "array", items: { type: "object", required: ["path", "kind"], properties: {
        path: text, kind: { enum: ["scenario", "context"] },
      } } },
    },
    allOf: [
      { if: { properties: { formatVersion: { const: 3 } } }, then: { required: ["dependencyFiles"] } },
      { if: { properties: { formatVersion: { const: 1 } } }, then: { required: ["draftId", "revision"] }, else: { required: ["projectId"] } },
      { if: { required: ["draftId"] }, then: { required: ["revision"] } },
      { if: { required: ["revision"] }, then: { required: ["draftId"] } },
    ],
  },
  scenario: {
    $schema: "http://json-schema.org/draft-07/schema#", title: "Avora test scenario", type: "object",
    required: ["formatVersion", "id", "framework", "variantId", "context", "configuration", "inputs"],
    properties: {
      formatVersion: { const: 1 }, id: text, label: { type: "string" }, framework: text, variantId: text,
      context: { type: "string", pattern: "^tests/context/[a-z0-9_-]+\\.json$" },
      configuration: { type: "object", required: ["lineValues"], properties: {
        lineValues: { type: "object", additionalProperties: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] } },
        deletedLineIds: strings, configLineOrder: strings,
        inputs: objects, outputs: objects, errors: objects, logicFlows: objects,
        onErrorContinue: { type: "boolean" }, onErrorMessage: { type: "string" },
      } },
      generatedCase: { type: "object", required: ["version", "key", "baselineHash"], properties: {version:{const:1},key:text,baselineHash:{type:"string",pattern:"^[a-f0-9]{64}$"}} },
      inputs: { type: "object" }, expect: {
        type: "object", additionalProperties: false,
        properties: {
          output: {},
          error: { type: "object", required: ["status"], additionalProperties: false, properties: {
            status: { type: "integer", minimum: 400, maximum: 599 }, body: {},
          } },
        },
        not: { required: ["output", "error"] },
      },
    },
  },
  context: {
    $schema: "http://json-schema.org/draft-07/schema#", title: "Avora workspace context", type: "object",
    required: ["formatVersion", "id", "graph", "settings"], properties: {
      formatVersion: { const: 1 }, id: text,
      graph: { type: "object", required: ["nodes", "edges"], properties: { nodes: objects, edges: objects } },
      settings: { type: "object" },
      caseFixtures: {type:"object",additionalProperties:false,properties:{
        fields:{type:"object",additionalProperties:{anyOf:[{type:"string"},{type:"array",items:{type:"string"}}]}},
        inputs:{type:"object"},types:{type:"object"},
      }},
    },
  },
};
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = Object.fromEntries(Object.entries(projectSchemas).map(([key, schema]) => [key, ajv.compile(schema)]));
const pointerKey = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1");
export function safeArtifactPath(path: string, kind?: SourceArtifact["kind"]): boolean {
  return ((!kind || kind === "scenario") && /^tests\/cases\/(?:[a-z0-9_-]+\/)?[a-z0-9_-]+\.avora-test\.json$/.test(path)) ||
    ((!kind || kind === "context") && /^tests\/context\/[a-z0-9_-]+\.json$/.test(path));
}
export function schemaIssues(value: unknown, kind: string): ProjectIssue[] {
  const validate = validators[kind];
  if (!validate) throw new Error(`Unknown project document kind: ${kind}`);
  if (validate(value)) return [];
  return (validate.errors || []).map(error => ({
    pointer: error.instancePath + (error.keyword === "required" ? `/${pointerKey(error.params.missingProperty)}` : ""),
    code: `schema.${error.keyword}`, message: `${error.instancePath || "/"} ${error.message}`, severity: "error",
  }));
}
/** Opt-in v1 → v2 migration; preserves IDs, link revision, payload and unknown metadata. */
export function upgradeManifest(manifest: NodeManifest): NodeManifest {
  const errors = schemaIssues(manifest, "manifest");
  if (errors.length) throw new Error(errors[0].message);
  return { ...JSON.parse(JSON.stringify(manifest)), formatVersion: manifest.formatVersion >= 3 ? manifest.formatVersion : 2, projectId: manifest.projectId || manifest.draftId };
}
export function manifestIssues(value: unknown): ProjectIssue[] {
  const issues = schemaIssues(value, "manifest");
  if (issues.length) return issues;
  const manifest = value as NodeManifest;
  const add = (pointer: string, message: string, code = "reference.missing") => issues.push({ pointer, message, code, severity: "error" });
  for (const message of appearanceIssues(manifest.payload.node_config)) add('/payload/node_config', message, 'appearance.invalid');
  if (manifest.payload.node_config.logo && manifest.formatVersion !== 4) add('/formatVersion', 'Logos require formatVersion 4.');
  const unique = (items: JsonObject[], pointer: string) => {
    const seen = new Set<string>();
    items.forEach((item, i) => { if (seen.has(item.id)) add(`${pointer}/${i}/id`, `Duplicate ID: ${item.id}`, "identity.duplicate"); seen.add(item.id); });
  };
  const variants = manifest.payload.node_config.variants as JsonObject[];
  unique(variants, "/payload/node_config/variants");
  variants.forEach((variant, vi) => {
    const base = `/payload/node_config/variants/${vi}`;
    const fields = new Set<string>(), lines = new Set<string>(), packs = new Set<string>(["base"]);
    const collect = (node: any, pointer: string) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node.fields)) { unique(node.fields, `${pointer}/fields`); node.fields.forEach((f: any) => fields.add(f.id)); }
      if (Array.isArray(node.addFields)) node.addFields.forEach((f: any) => fields.add(f.id));
      for (const [key, child] of Object.entries(node)) if (child && typeof child === "object") collect(child, `${pointer}/${pointerKey(key)}`);
    };
    collect(variant, base);
    unique(variant.lines || [], `${base}/lines`);
    for (const line of variant.lines || []) { lines.add(line.id); for (const instance of line.instances || []) lines.add(instance.id); }
    for (const pack of variant.elementPacks || []) packs.add(pack.id);
    const visit = (node: any, pointer: string) => {
      if (!node || typeof node !== "object") return;
      for (const [key, child] of Object.entries(node)) {
        const at = `${pointer}/${pointerKey(key)}`;
        const expected = ["relatedToField", "defaultValueFieldId", "relatedFieldId", "fieldId", "valueFieldId"].includes(key) ? fields :
          ["lineId", "overrideLineId"].includes(key) ? lines : ["packId", "appendPackId", "overridePackId"].includes(key) ? packs : undefined;
        if (expected && typeof child === "string" && child && !expected.has(child)) add(at, `Unknown ${key}: ${child}.`);
        if (child && typeof child === "object") visit(child, at);
      }
    };
    visit(variant, base);
  });
  const ids = new Set(variants.map(v => v.id));
  const mappings = new Set<string>(), paths = new Set<string>();
  manifest.templates.forEach((entry, i) => {
    const at = `/templates/${i}`;
    if (paths.has(entry.path)) add(`${at}/path`, `Duplicate source path: ${entry.path}`);
    paths.add(entry.path);
    entry.variantIds.forEach((id, j) => {
      const key = `${entry.framework}:${id}`;
      if (!ids.has(id) || !manifest.payload.code_bundle[entry.framework]?.variants?.[id]) add(`${at}/variantIds/${j}`, `Unknown variant mapping: ${key}`);
      if (mappings.has(key)) add(`${at}/variantIds/${j}`, `Duplicate variant mapping: ${key}`);
      mappings.add(key);
    });
  });
  for (const [fw, bundle] of Object.entries(manifest.payload.code_bundle)) for (const id of Object.keys(bundle.variants || {})) {
    if (!mappings.has(`${fw}:${id}`)) add("/templates", `Missing template mapping for ${fw}:${id}`);
  }
  (manifest.artifacts || []).forEach((entry, i) => {
    if (!safeArtifactPath(entry.path, entry.kind)) add(`/artifacts/${i}/path`, `Unsafe ${entry.kind} path: ${entry.path}`);
    if (paths.has(entry.path)) add(`/artifacts/${i}/path`, `Duplicate source path: ${entry.path}`);
    paths.add(entry.path);
  });
  const frameworks = new Set<string>();
  for (const [i, entry] of (manifest.dependencyFiles || []).entries()) {
    if (manifest.formatVersion < 3 || !safeDependencyPath(entry.path) || paths.has(entry.path) || frameworks.has(entry.framework) || !manifest.payload.code_bundle[entry.framework]) add(`/dependencyFiles/${i}`, 'Invalid or duplicate dependency file mapping.');
    if (Object.hasOwn(manifest.payload.code_bundle[entry.framework] || {}, 'dependencies')) add(`/payload/code_bundle/${entry.framework}/dependencies`, 'Edit dependencies in requirements.txt; remove these duplicate declarations.');
    paths.add(entry.path); frameworks.add(entry.framework);
  }
  return issues;
}
/** Strict JSON parsing and pointer-to-range mapping shared by UI and headless consumers. */
export function parseProjectDocument(source: string, kind: "manifest" | "scenario" | "context", manifest?: NodeManifest) {
  const errors: ParseError[] = [];
  const tree = parseTree(source, errors, { disallowComments: true, allowTrailingComma: false });
  if (errors.length || !tree) return { value: undefined, diagnostics: errors.length ? errors.map(e => ({ start: e.offset, end: e.offset + Math.max(1, e.length), code: "json.syntax", severity: "error" as const, message: printParseErrorCode(e.error) })) : [{ start: 0, end: 0, code: "json.empty", severity: "error" as const, message: "JSON document is empty." }] };
  const value = getNodeValue(tree);
  const issues = kind === "manifest" ? manifestIssues(value) : schemaIssues(value, kind);
  if (!issues.length && kind === "scenario" && manifest) {
    const add = (pointer: string, message: string) => issues.push({ pointer, message, code: "reference.missing", severity: "error" });
    if (!manifest.payload.node_config.variants.some((v: JsonObject) => v.id === value.variantId)) add("/variantId", `Unknown variant: ${value.variantId}`);
    if (!manifest.payload.code_bundle[value.framework]) add("/framework", `No template for framework: ${value.framework}`);
    else if (manifest.payload.node_config.variants.some((v: JsonObject) => v.id === value.variantId) && !manifest.payload.code_bundle[value.framework]?.variants?.[value.variantId]) add("/variantId", `No ${value.framework} template for variant: ${value.variantId}`);
    if (!manifest.artifacts?.some(a => a.kind === "context" && a.path === value.context)) add("/context", `Unknown workspace context: ${value.context}`);
  }
  return { value, diagnostics: issues.map(issue => {
    const parts = issue.pointer.split("/").slice(1).map(p => p.replace(/~1/g, "/").replace(/~0/g, "~"));
    let node = tree;
    let current = tree;
    for (const part of parts) {
      const next = findNodeAtLocation(current, [current.type === "array" ? Number(part) : part]);
      if (!next) break;
      current = next; node = next;
    }
    return { ...issue, start: node.offset, end: node.offset + node.length };
  }) };
}

export function scenarioFieldDiagnostics(source: string, issues: Array<{ fieldId: string; message: string; level: "error" | "warning" }>): Diagnostic[] {
  const tree = parseTree(source);
  if (!tree) return [];
  return issues.map(issue => {
    const node = findNodeAtLocation(tree, ["configuration", "lineValues", issue.fieldId]) || findNodeAtLocation(tree, ["configuration", "lineValues"]) || tree;
    return { start: node.offset, end: node.offset + node.length, severity: issue.level, message: issue.message, code: "case.configuration" };
  });
}

/** Edit only owned JSON properties; preserve unknown metadata, formatting and identity. */
export function patchScenarioSource(source: string, changes: ScenarioChanges, manifest: NodeManifest): string {
  const before = parseProjectDocument(source, "scenario", manifest);
  if (before.diagnostics.some(issue => issue.severity === "error")) throw new Error("Fix the case JSON before editing visually.");
  const allowed = new Set(["label", "variantId", "framework", "context", "configuration", "inputs", "expect"]);
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || Object.keys(changes).some(key => !allowed.has(key))) throw new Error("Invalid case changes.");
  const indent = source.match(/\n([ \t]+)"/)?.[1] || "  ";
  const formattingOptions = { insertSpaces: !indent.includes("\t"), tabSize: indent.length, eol: source.includes("\r\n") ? "\r\n" : "\n" };
  let result = source;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) throw new Error("Case values must be JSON.");
    result = applyEdits(result, modify(result, [key], value, { formattingOptions }));
  }
  const after = parseProjectDocument(result, "scenario", manifest);
  const error = after.diagnostics.find(issue => issue.severity === "error");
  if (error) throw new Error(error.message);
  return result;
}
