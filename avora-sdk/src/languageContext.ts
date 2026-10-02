/** Load a verified, prepared context. This never generates, installs or executes user code. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  currentGeneration,
  readGenerationSnapshot,
  readGenerationSource,
  safePath,
  generationContextHash,
  generationHash,
} from "./generation";
import { safeArtifactPath, safeTemplatePath } from "./index";
import type { PreparedNode } from "./environment";
import type { SourceMap } from "../types/diagnostics";

export interface LanguageContext {
  folder: string;
  casePath: string;
  template: { path: string; source: string };
  generated: string;
  file: string;
  map: SourceMap;
  prepared: PreparedNode;
  identity: string;
}
export async function readLanguageContext(
  folder: string,
  read = (relative: string) => readGenerationSource(folder, relative),
): Promise<LanguageContext> {
  async function json(relative: string, limit = 24_000_000) {
    const file = await safePath(folder, relative);
    if ((await fs.stat(file)).size > limit)
      throw new Error("Invalid Python context metadata.");
    return JSON.parse(await fs.readFile(file, "utf8"));
  }
  const metadata = await json(".avora/generated/current.json");
  const prepared: PreparedNode = await json(".avora/environment.json");
  const casePath = prepared.languageContext?.casePath || metadata.casePath;
  if (!safeArtifactPath(casePath, "scenario"))
    throw new Error("Prepare a case to enable Python assistance.");
  const snapshot = await readGenerationSnapshot(folder, casePath, read);
  const saved = prepared.languageContext || {
    template: snapshot.template,
    contextHash: generationContextHash(snapshot.request),
  };
  if (
    !saved.template ||
    !safeTemplatePath(saved.template.path) ||
    typeof saved.template.source !== "string" ||
    saved.template.source.length > 2_000_000 ||
    snapshot.template.path !== saved.template.path ||
    saved.contextHash !== generationContextHash(snapshot.request)
  )
    throw new Error(
      "Case, structure or dependencies changed. Prepare or run this case to refresh Python context.",
    );
  const generation = await currentGeneration(folder, casePath, (relative) =>
    relative === saved.template.path
      ? Promise.resolve(saved.template.source)
      : read(relative),
  );
  if (!generation?.sourceMap || !generation.serviceFile)
    throw new Error(
      "Generate this case with source maps to enable Python assistance.",
    );
  const environments = path.join(folder, ".avora/environments") + path.sep;
  if (
    prepared?.generation?.id !== generation.id ||
    typeof prepared.directory !== "string" ||
    typeof prepared.interpreter !== "string" ||
    !prepared.directory.startsWith(environments) ||
    path.resolve(prepared.interpreter) !==
      path.join(
        prepared.directory,
        "venv",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      )
  )
    throw new Error("Prepare this case to select its Python environment.");
  const ready = JSON.parse(
    await fs.readFile(
      await safePath(
        folder,
        path
          .relative(folder, path.join(prepared.directory, "ready.json"))
          .split(path.sep)
          .join("/"),
      ),
      "utf8",
    ),
  );
  if (
    ready.environmentId !== prepared.environmentId ||
    ready.lockHash !== prepared.lockHash
  )
    throw new Error("The Python environment changed. Prepare this case again.");
  const lock = await json("avora.lock", 4_000_000);
  if (
    lock.formatVersion !== 1 ||
    !lock.profiles ||
    !Object.values(lock.profiles).some(
      (profile: any) =>
        typeof profile?.requirements === "string" &&
        profile.lockHash === prepared.lockHash &&
        generationHash(profile.requirements) === prepared.lockHash &&
        generationHash(profile.runtime) === generationHash(prepared.runtime),
    )
  )
    throw new Error("The dependency lock changed. Prepare this case again.");
  const file = path
    .relative(generation.directory, generation.serviceFile)
    .split(path.sep)
    .join("/");
  return {
    folder,
    casePath,
    template: saved.template,
    generated: await fs.readFile(generation.serviceFile, "utf8"),
    file,
    map: generation.sourceMap,
    prepared,
    identity: generation.id + ":" + prepared.environmentId + ":" + casePath,
  };
}
