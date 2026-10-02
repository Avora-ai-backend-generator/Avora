/** Safe local case proposals and regeneration. No network calls or compiler assets. */
import * as fs from "node:fs/promises";
import { modify, applyEdits } from "jsonc-parser";
import {
  parseProjectDocument,
  safeArtifactPath,
  type NodeManifest,
  type NodeScenario,
  type WorkspaceContext,
} from "./index";
import { generationHash, safePath } from "./generation";
import { atomicRuntimeFile, withRuntimeLock } from "./localRuntime";
import { sampleNodeCases } from "./caseSamples";
import type { CasePreview, CaseProposal } from "../types/cases";

const INDEX = ".avora/cases/index.json",
  JOURNAL = ".avora/cases/transaction.json";
const managed = [
  "formatVersion",
  "id",
  "label",
  "framework",
  "variantId",
  "context",
  "configuration",
  "inputs",
];
const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const equal = (a: unknown, b: unknown) =>
  generationHash(a ?? null) === generationHash(b ?? null);
const clean = (value: NodeScenario): NodeScenario =>
  Object.fromEntries(
    managed.filter((k) => Object.hasOwn(value, k)).map((k) => [k, value[k]]),
  ) as unknown as NodeScenario;
const object = (v: any): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
type Baselines = Record<string, { key: string; baseline: NodeScenario }>;
type Write = { path: string; before: string | null; after: string };
export interface CasePlan extends CasePreview {
  /** Snapshot for compare-before-write. Plans must be applied in their original folder. */
  folder: string;
  sources: Record<string, string | null>;
  writes: Write[];
}
export interface CaseGenerationOptions {
  folder: string;
  contextPath?: string;
  budget?: number;
  signal?: AbortSignal;
}
async function read(
  folder: string,
  file: string,
  max = 2_000_000,
): Promise<string | null> {
  const target = await safePath(folder, file);
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > max)
      throw new Error(`File exceeds the ${max}-byte limit: ${file}`);
    return await fs.readFile(target, "utf8");
  } catch (error: any) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function parsed<T>(
  source: string | null,
  kind: "manifest" | "scenario" | "context",
  manifest?: NodeManifest,
): T {
  if (source === null) throw new Error(`Missing ${kind} source.`);
  const result = parseProjectDocument(source, kind, manifest),
    error = result.diagnostics.find((d) => d.severity === "error");
  if (error) throw new Error(`${kind}: ${error.message}`);
  return result.value as T;
}
function merge(
  base: any,
  current: any,
  next: any,
  path: string,
  conflicts: string[],
): any {
  if (equal(current, base)) return next;
  if (equal(next, base) || equal(current, next)) return current;
  if (object(base) && object(current) && object(next)) {
    const result = Object.create(null);
    for (const key of new Set([
      ...Object.keys(base),
      ...Object.keys(current),
      ...Object.keys(next),
    ])) {
      const value = merge(
        base[key],
        current[key],
        next[key],
        `${path}/${key}`,
        conflicts,
      );
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  conflicts.push(path);
  return current;
}
const writable = (file: string) =>
  file === "avora.node.json" ||
  file === INDEX ||
  safeArtifactPath(file, "scenario");
async function rollback(folder: string, writes: Write[]) {
  for (const write of [...writes].reverse()) {
    const current = await read(folder, write.path, 8_000_000);
    if (current !== write.after) continue; // An external edit is never ours to undo.
    if (write.before === null)
      await fs.unlink(await safePath(folder, write.path));
    else await atomicRuntimeFile(folder, write.path, write.before);
  }
}
async function recover(folder: string) {
  const text = await read(folder, JOURNAL, 16_000_000);
  if (!text) return;
  const transaction = JSON.parse(text);
  if (
    transaction.version !== 1 ||
    !Array.isArray(transaction.writes) ||
    transaction.writes.length > 102 ||
    transaction.writes.some(
      (w: any) =>
        !writable(w.path) ||
        typeof w.after !== "string" ||
        !(w.before === null || typeof w.before === "string"),
    )
  )
    throw new Error(
      "Invalid case transaction. Restore .avora/cases from a trusted local backup.",
    );
  await rollback(folder, transaction.writes);
  await fs.unlink(await safePath(folder, JOURNAL));
}

export async function planNodeCases(
  options: CaseGenerationOptions,
): Promise<CasePlan> {
  options = { ...options, folder: await fs.realpath(options.folder) };
  return withRuntimeLock(
    options.folder,
    ".avora/cases-operation",
    options.signal,
    undefined,
    async (signal) => {
      await fs
        .writeFile(await safePath(options.folder, ".avora/.gitignore"), "*\n", {
          flag: "wx",
        })
        .catch((error: any) => {
          if (error.code !== "EEXIST") throw error;
        });
      await recover(options.folder);
      const sources: Record<string, string | null> = Object.create(null);
      let inputBytes = 0;
      const source = async (file: string, max?: number) => {
        const value = await read(options.folder, file, max);
        inputBytes += Buffer.byteLength(value || "");
        if (inputBytes > 16_000_000)
          throw new Error(
            "Case generation input exceeds 16 MB. Reduce large fixtures or split this node project.",
          );
        return (sources[file] = value);
      };
      const manifest = parsed<NodeManifest>(
        await source("avora.node.json"),
        "manifest",
      );
      const contexts = (manifest.artifacts || [])
        .filter((a) => a.kind === "context")
        .map((a) => a.path);
      const contextPath =
        options.contextPath ||
        (contexts.length === 1 ? contexts[0] : undefined);
      if (!contextPath || !contexts.includes(contextPath))
        throw new Error(
          "Choose a registered workspace context with --context or in Generate cases.",
        );
      const context = parsed<WorkspaceContext>(
        await source(contextPath),
        "context",
      );
      const indexSource = await source(INDEX, 8_000_000);
      const index: Baselines = indexSource
        ? JSON.parse(indexSource)
        : Object.create(null);
      if (!object(index)) throw new Error("Invalid case baseline index.");
      const existing = new Map<string, { path: string; case: NodeScenario }>(),
        ids = new Map<string, string>();
      for (const artifact of manifest.artifacts || [])
        if (artifact.kind === "scenario") {
          const text = await source(artifact.path);
          if (!text)
            throw new Error(
              `Missing case: ${artifact.path}. Restore it or remove its manifest registration.`,
            );
          let value: NodeScenario;
          try {
            value = JSON.parse(text);
          } catch {
            throw new Error(
              `Fix invalid JSON before generating cases: ${artifact.path}`,
            );
          }
          if (value.id) {
            if (ids.has(value.id))
              throw new Error(
                `Duplicate case ID: ${value.id}. Fix it before generating cases.`,
              );
            ids.set(value.id, artifact.path);
          }
          const metadata = value.generatedCase as any;
          if (metadata?.version === 1 && typeof metadata.key === "string") {
            if (existing.has(metadata.key))
              throw new Error(
                `Duplicate generated case identity: ${metadata.key}. Remove generatedCase metadata from manual copies.`,
              );
            existing.set(metadata.key, { path: artifact.path, case: value });
          }
        }
      const { samples, warnings } = sampleNodeCases(
        manifest,
        contextPath,
        context,
        options.budget ?? 24,
      );
      const entries: CaseProposal[] = [],
        writes: Write[] = [],
        artifacts = [...(manifest.artifacts || [])],
        nextIndex = { ...index },
        keys = new Set(samples.map((s) => s.key));
      for (const sample of samples) {
        signal.throwIfAborted();
        const prior = existing.get(sample.key),
          file = prior?.path || sample.path;
        const before = Object.hasOwn(sources, file)
          ? sources[file]
          : await source(file);
        const conflicts: string[] = [],
          entry: CaseProposal = {
            path: file,
            label: sample.scenario.label || sample.key,
            status: "unchanged",
            warnings: sample.warnings,
            conflicts,
          };
        let next = sample.scenario;
        if (prior) {
          const metadata = prior.case.generatedCase as any,
            saved = index[file];
          let base =
            saved?.key === sample.key &&
            object(saved.baseline) &&
            equal(generationHash(saved.baseline), metadata.baselineHash)
              ? saved.baseline
              : undefined;
          if (
            !base &&
            generationHash(clean(prior.case)) === metadata.baselineHash
          )
            base = clean(prior.case);
          if (!base) {
            entry.status = "review";
            conflicts.push(
              "Previous baseline unavailable; preserve this edited case.",
            );
          } else {
            next = {
              ...prior.case,
              ...merge(base, clean(prior.case), sample.scenario, "", conflicts),
            };
            if (conflicts.length) entry.status = "review";
          }
        } else if (before !== null || ids.has(next.id)) {
          entry.status = "review";
          conflicts.push(
            "A file or case ID already exists. It will not be overwritten.",
          );
        } else entry.status = "add";
        const generatedCase = {
          version: 1 as const,
          key: sample.key,
          baselineHash: generationHash(sample.scenario),
        };
        // Review diff shows the fresh proposal on conflicts; expectations remain visible.
        entry.proposed =
          entry.status === "review"
            ? {
                ...sample.scenario,
                ...(prior?.case.expect ? { expect: prior.case.expect } : {}),
                generatedCase,
              }
            : { ...next, generatedCase };
        if (entry.status !== "review") {
          parsed<NodeScenario>(encode(entry.proposed), "scenario", manifest);
          nextIndex[file] = { key: sample.key, baseline: sample.scenario };
          if (prior && !equal(prior.case, entry.proposed))
            entry.status = "update";
          if (entry.status === "add" || entry.status === "update") {
            writes.push({ path: file, before, after: encode(entry.proposed) });
            if (!artifacts.some((a) => a.path === file))
              artifacts.push({ kind: "scenario", path: file });
          }
        }
        entries.push(entry);
      }
      for (const [key, prior] of existing)
        if (!keys.has(key))
          entries.push({
            path: prior.path,
            label: prior.case.label || prior.case.id,
            status: "obsolete",
            warnings: [
              "Outside this preview: removed coverage, another context, or budget limit. Kept unchanged.",
            ],
            conflicts: [],
          });
      const afterManifest = applyEdits(
        sources["avora.node.json"]!,
        modify(sources["avora.node.json"]!, ["artifacts"], artifacts, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
      if (afterManifest !== sources["avora.node.json"])
        writes.push({
          path: "avora.node.json",
          before: sources["avora.node.json"],
          after: afterManifest,
        });
      const afterIndex = encode(nextIndex);
      if (afterIndex !== indexSource)
        writes.push({ path: INDEX, before: indexSource, after: afterIndex });
      if (
        Buffer.byteLength(encode(writes)) > 12_000_000 ||
        writes.some(
          (w) => w.path !== INDEX && Buffer.byteLength(w.after) > 2_000_000,
        )
      )
        throw new Error(
          "Case proposal is too large. Reduce the budget or fixture sizes.",
        );
      return {
        folder: options.folder,
        context: contextPath,
        budget: options.budget ?? 24,
        entries,
        warnings,
        sources,
        writes,
      };
    },
  );
}

export async function applyNodeCasePlan(
  plan: CasePlan,
  options: {
    signal?: AbortSignal;
    beforeWrite?: (file: string) => Promise<void>;
  } = {},
) {
  return withRuntimeLock(
    plan.folder,
    ".avora/cases-operation",
    options.signal,
    undefined,
    async (signal) => {
      await recover(plan.folder);
      for (const [file, expected] of Object.entries(plan.sources)) {
        if (
          file !== "avora.node.json" &&
          file !== INDEX &&
          !safeArtifactPath(file)
        )
          throw new Error("Invalid case plan source.");
        await options.beforeWrite?.(file);
        if ((await read(plan.folder, file, 8_000_000)) !== expected)
          throw new Error(
            `Sources changed after preview: ${file}. Preview again.`,
          );
      }
      if (
        plan.writes.some(
          (w) => !writable(w.path) || plan.sources[w.path] !== w.before,
        )
      )
        throw new Error("Invalid case plan write.");
      await atomicRuntimeFile(
        plan.folder,
        JOURNAL,
        encode({ version: 1, writes: plan.writes }),
      );
      try {
        for (const write of plan.writes) {
          signal.throwIfAborted();
          await options.beforeWrite?.(write.path);
          if ((await read(plan.folder, write.path, 8_000_000)) !== write.before)
            throw new Error(`Source changed: ${write.path}. Preview again.`);
          await atomicRuntimeFile(plan.folder, write.path, write.after);
        }
        await fs.unlink(await safePath(plan.folder, JOURNAL));
      } catch (error) {
        await rollback(plan.folder, plan.writes);
        await fs.unlink(await safePath(plan.folder, JOURNAL));
        throw error;
      }
      return {
        written: plan.entries
          .filter((e) => e.status === "add" || e.status === "update")
          .map((e) => e.path),
        review: plan.entries
          .filter((e) => e.status === "review")
          .map((e) => e.path),
      };
    },
  );
}
