/** Local dependency preparation. Reuses uv; never imports or runs authored node code. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import {
  currentGeneration,
  generationHash,
  generationContextHash,
  readGenerationSnapshot,
  safePath,
  type GenerationResult,
} from "./generation";
import {
  ensureUv,
  resolvePython,
  defaultToolRoot,
  UV_VERSION,
  type PythonIdentity,
} from "./pythonToolchain";
import {
  withRuntimeLock,
  atomicRuntimeFile,
  runRuntime,
  runtimeEnvironment,
  type RuntimeProgress,
} from "./localRuntime";

export type PrepareOptions = {
  folder: string;
  casePath?: string;
  python?: string;
  signal?: AbortSignal;
  read?: (relative: string) => Promise<string>;
  progress?: RuntimeProgress;
  generate?: (signal: AbortSignal) => Promise<unknown>;
  toolRoot?: string;
};
export type PreparedNode = {
  /** User source only; retained for local, unsaved language-service overlays. */
  languageContext?: {
    casePath: string;
    template: { path: string; source: string };
    contextHash: string;
  };
  pythonSelector?: string;
  generation: GenerationResult;
  interpreter: string;
  directory: string;
  environmentId: string;
  runtime: PythonIdentity;
  lockHash: string;
  reused: boolean;
  workspaceFile: string;
};
type LockProfile = {
  runtime: PythonIdentity;
  resolver: string;
  requirementsHash: string;
  lockHash: string;
  requirements: string;
};
type LockDocument = {
  formatVersion: 1;
  profiles: Record<string, LockProfile>;
  [key: string]: unknown;
};
export class GenerationRequiredError extends Error {
  constructor() {
    super(
      "Generate this case before preparing dependencies. Its generated application is missing, changed or outdated.",
    );
  }
}
export function normalizeRequirements(source: string, locked = false): string {
  if (Buffer.byteLength(source) > 2_000_000)
    throw new Error("The dependency list exceeds 2 MB.");
  const lines = [];
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    if (locked && /^--hash=sha256:[a-f0-9]{64}\s*\\?$/.test(line)) {
      lines.push(line);
      continue;
    }
    const entry = locked ? line.replace(/\s*\\$/, "") : line;
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9._,-]+\])?(?:\s*[<>=!~][A-Za-z0-9.*+!<>=~,\s-]+)?(?:\s*;[A-Za-z0-9_ .<>=!'"()\-]+)?$/.test(
        entry,
      ) ||
      /\s--?\w|@|:\/\//.test(entry)
    )
      throw new Error(
        "Dependencies must be named PyPI packages. URLs, local paths, custom indexes and source builds are not supported by Prepare.",
      );
    lines.push(line);
  }
  if (!lines.length) throw new Error("The generated dependency list is empty.");
  return locked ? source : [...new Set(lines)].sort().join("\n") + "\n";
}
export const environmentIdentity = (
  runtime: PythonIdentity,
  lockHash: string,
  executable: string,
) =>
  generationHash([
    "avora-python-environment-v1",
    runtime,
    lockHash,
    executable,
  ]);

export async function prepareNode(
  options: PrepareOptions,
): Promise<PreparedNode> {
  const folder = await fs.realpath(options.folder);
  const root = await safePath(folder, ".avora/environments");
  await fs.mkdir(root, { recursive: true });
  return withRuntimeLock(
    folder,
    ".avora/prepare",
    options.signal,
    options.progress,
    async (signal) => {
      let generation = await currentGeneration(
        folder,
        options.casePath,
        options.read,
      );
      if (!generation && options.generate) {
        options.progress?.("Generating the current case…");
        await options.generate(signal);
        generation = await currentGeneration(
          folder,
          options.casePath,
          options.read,
        );
      }
      if (!generation) throw new GenerationRequiredError();
      const requirements = normalizeRequirements(
        await fs.readFile(
          await safePath(generation.directory, "requirements.txt"),
          "utf8",
        ),
      );
      const requirementsHash = generationHash(requirements);
      const toolRoot = path.resolve(options.toolRoot || defaultToolRoot());
      const uv = await ensureUv(toolRoot, signal, options.progress);
      const runtime = await resolvePython(
        uv,
        toolRoot,
        options.python,
        signal,
        options.progress,
      );
      const env = runtimeEnvironment(toolRoot);
      const run = (args: string[]) =>
        runRuntime(uv, args, { cwd: root, env, signal });
      const profileId = generationHash([
        "uv-pypi-wheels-v1",
        UV_VERSION,
        runtime.identity,
        requirementsHash,
      ]);
      const lockPath = await safePath(folder, "avora.lock");
      let lockDocument: LockDocument = { formatVersion: 1, profiles: {} };
      try {
        if ((await fs.stat(lockPath)).size > 12_000_000)
          throw new Error("avora.lock exceeds 12 MB.");
        lockDocument = JSON.parse(await fs.readFile(lockPath, "utf8"));
        if (
          !lockDocument ||
          lockDocument.formatVersion !== 1 ||
          !lockDocument.profiles ||
          typeof lockDocument.profiles !== "object" ||
          Array.isArray(lockDocument.profiles)
        )
          throw new Error("Unsupported avora.lock format.");
      } catch (error: any) {
        if (error.code !== "ENOENT")
          throw new Error(
            "Fix avora.lock before preparing dependencies: " + error.message,
          );
      }
      let profile = lockDocument.profiles[profileId];
      if (
        profile &&
        (typeof profile.requirements !== "string" ||
          !profile.runtime ||
          profile.lockHash !== generationHash(profile.requirements) ||
          profile.requirementsHash !== requirementsHash ||
          generationHash(profile.runtime) !== generationHash(runtime.identity))
      )
        throw new Error(
          "The dependency lock was modified. Remove the affected profile from avora.lock, then Prepare again.",
        );
      if (!profile) {
        options.progress?.("Resolving exact package versions…");
        const resolution = await fs.mkdtemp(path.join(root, ".resolve-"));
        try {
          const input = path.join(resolution, "requirements.in"),
            output = path.join(resolution, "requirements.lock");
          await fs.writeFile(input, requirements);
          await run([
            "pip",
            "compile",
            input,
            "--python",
            runtime.executable,
            "--generate-hashes",
            "--only-binary",
            ":all:",
            "--no-header",
            "--no-annotate",
            "--output-file",
            output,
          ]);
          const locked = normalizeRequirements(
            await fs.readFile(output, "utf8"),
            true,
          );
          profile = {
            runtime: runtime.identity,
            resolver: `uv ${UV_VERSION}`,
            requirementsHash,
            lockHash: generationHash(locked),
            requirements: locked,
          };
          lockDocument.profiles[profileId] = profile;
          signal.throwIfAborted();
          await atomicRuntimeFile(
            folder,
            "avora.lock",
            JSON.stringify(lockDocument, null, 2) + "\n",
          );
        } finally {
          await fs.rm(resolution, { recursive: true, force: true });
        }
      }
      normalizeRequirements(profile.requirements, true);
      const environmentId = environmentIdentity(
        runtime.identity,
        profile.lockHash,
        runtime.executable,
      );
      let directory: string | undefined,
        reused = false;
      const pythonIn = (target: string) =>
        path.join(
          target,
          "venv",
          ...(process.platform === "win32"
            ? ["Scripts", "python.exe"]
            : ["bin", "python"]),
        );
      const inventory = async (python: string) => {
        const packages = JSON.parse(
          await run(["pip", "list", "--python", python, "--format", "json"]),
        );
        return generationHash(
          packages
            .map((item: any) => [item.name, item.version])
            .sort((a: string[], b: string[]) => a[0].localeCompare(b[0])),
        );
      };
      options.progress?.("Checking for a matching prepared environment…");
      for (const name of (await fs.readdir(root)).sort()) {
        if (
          !name.startsWith(environmentId + "-") ||
          !/^[a-f0-9]{64}-[a-f0-9]{8}$/.test(name)
        )
          continue;
        const candidate = await safePath(folder, `.avora/environments/${name}`);
        try {
          const ready = JSON.parse(
            await fs.readFile(await safePath(candidate, "ready.json"), "utf8"),
          );
          if (
            ready.environmentId === environmentId &&
            ready.lockHash === profile.lockHash &&
            ready.inventory === (await inventory(pythonIn(candidate)))
          ) {
            await run(["pip", "check", "--python", pythonIn(candidate)]);
            directory = candidate;
            reused = true;
            break;
          }
        } catch {
          signal.throwIfAborted();
        }
      }
      if (!directory) {
        // Virtual environments contain absolute paths. Build at their final location;
        // publish ready.json last instead of moving a venv and breaking entry points.
        directory = path.join(
          root,
          `${environmentId}-${randomUUID().slice(0, 8)}`,
        );
        await fs.mkdir(directory);
        try {
          const lock = path.join(directory, "requirements.lock");
          await fs.writeFile(lock, profile.requirements);
          options.progress?.("Creating the isolated Python environment…");
          await run([
            "venv",
            path.join(directory, "venv"),
            "--python",
            runtime.executable,
          ]);
          options.progress?.("Installing locked dependencies…");
          await run([
            "pip",
            "sync",
            lock,
            "--python",
            pythonIn(directory),
            "--require-hashes",
            "--only-binary",
            ":all:",
            "--compile-bytecode",
          ]);
          options.progress?.("Checking installed dependencies…");
          await run(["pip", "check", "--python", pythonIn(directory)]);
          const installed = await inventory(pythonIn(directory));
          signal.throwIfAborted();
          await atomicRuntimeFile(
            directory,
            "ready.json",
            JSON.stringify({
              environmentId,
              lockHash: profile.lockHash,
              runtime: runtime.identity,
              inventory: installed,
            }),
          );
        } catch (error) {
          await fs.rm(directory, { recursive: true, force: true });
          throw error;
        }
      }
      signal.throwIfAborted();
      const latest = await currentGeneration(
        folder,
        options.casePath,
        options.read,
      );
      const languageSnapshot = await readGenerationSnapshot(
        folder,
        options.casePath,
        options.read,
      );
      if (
        !latest ||
        latest.id !== generation.id ||
        latest.directory !== generation.directory ||
        languageSnapshot.sourceHash !== generation.sourceHash
      )
        throw new Error(
          "The generated case changed during preparation. Prepare again; the previous environment selection is intact.",
        );
      const result: PreparedNode = {
        languageContext: {
          casePath: languageSnapshot.casePath,
          template: languageSnapshot.template,
          contextHash: generationContextHash(languageSnapshot.request),
        },
        pythonSelector: options.python || "3.11",
        generation,
        interpreter: pythonIn(directory),
        directory,
        environmentId,
        runtime: runtime.identity,
        lockHash: profile.lockHash,
        reused,
        workspaceFile: path.join(
          folder,
          ".avora/generated-python.code-workspace",
        ),
      };
      await atomicRuntimeFile(
        folder,
        ".avora/generated-python.code-workspace",
        JSON.stringify(
          {
            folders: [{ name: "Avora node", path: folder }],
            settings: {
              "python.defaultInterpreterPath": result.interpreter,
              "python.terminal.activateEnvironment": false,
              "python.analysis.extraPaths": [generation.directory],
              "files.exclude": { ".avora": true, "avora.lock": true },
              "files.readonlyInclude": { "generated/**": true },
            },
            extensions: {
              recommendations: ["ms-python.python", "ms-python.vscode-pylance"],
            },
          },
          null,
          2,
        ) + "\n",
      );
      signal.throwIfAborted();
      await atomicRuntimeFile(
        folder,
        ".avora/environment.json",
        JSON.stringify(result, null, 2) + "\n",
      );
      options.progress?.(
        reused
          ? "Reused the prepared environment."
          : "Python and dependencies are ready.",
      );
      return result;
    },
  );
}
