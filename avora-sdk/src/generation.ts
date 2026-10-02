import { PUBLIC_API_BASE_URL } from "./endpoints";
import { safeLogoPath } from "./appearance";
/** Node.js client for Avora's existing preview API. Contains no compiler or private assets. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import {
  validateSourceMap,
  GenerationDiagnosticError,
  type SourceMap,
} from "./sourceDiagnostics";
import { publishApplication, recoverPublication } from "./generatedWorkspace";
import { withRuntimeLock } from "./localRuntime";
import {
  assembleDraft,
  validateTemplate,
  parseProjectDocument,
  safeArtifactPath,
  safeTemplatePath,
  safeDependencyPath,
  type NodeManifest,
  type NodeScenario,
  type WorkspaceContext,
} from "./index";

export const LIVE_GENERATION_API = PUBLIC_API_BASE_URL;
export const generationHash = (value: unknown): string =>
  createHash("sha256").update(stable(value)).digest("hex");
function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function parsed<T>(
  source: string,
  kind: "manifest" | "scenario" | "context",
  manifest?: NodeManifest,
): T {
  const result = parseProjectDocument(source, kind, manifest);
  const issue = result.diagnostics.find((d) => d.severity === "error");
  if (issue) throw new Error(`${kind}: ${issue.message}`);
  return result.value as T;
}

/** Every path component must stay inside the source folder and cannot be a symlink. */
export async function readGenerationSource(
  folder: string,
  relative: string,
): Promise<string> {
  if (
    relative !== "avora.node.json" &&
    !safeTemplatePath(relative) &&
    !safeArtifactPath(relative) &&
    !safeDependencyPath(relative) && !safeLogoPath(relative)
  )
    throw new Error("Invalid node source path.");
  const file = await safePath(folder, relative);
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > 2_000_000)
    throw new Error(`Source must be a file under 2 MB: ${relative}`);
  return fs.readFile(file, safeLogoPath(relative) ? "base64" : "utf8");
}
export async function safePath(
  folder: string,
  relative: string,
): Promise<string> {
  if (
    !relative ||
    relative.includes("\\") ||
    relative.split("/").some((p) => !p || p === "." || p === "..") ||
    path.isAbsolute(relative)
  )
    throw new Error("Unsafe generated path.");
  let target = folder;
  for (const part of relative.split("/")) {
    target = path.join(target, part);
    try {
      if ((await fs.lstat(target)).isSymbolicLink())
        throw new Error("Avora does not follow source or output symlinks.");
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}
export type GenerationSnapshot = {
  request: Record<string, any>;
  sourceHash: string;
  casePath: string;
  template: { path: string; source: string };
};
/** Editing literal code does not change the selected case's typed context. */
export function generationContextHash(
  request: GenerationSnapshot["request"],
): string {
  const context = structuredClone(request);
  for (const bundle of Object.values(context.code_bundle || {}) as any[]) {
    for (const variant of Object.values(bundle.variants || {}) as any[])
      delete variant.code;
  }
  return generationHash(context);
}
export async function readGenerationSnapshot(
  folder: string,
  casePath?: string,
  read = (relative: string) => readGenerationSource(folder, relative),
): Promise<GenerationSnapshot> {
  const manifest = parsed<NodeManifest>(
    await read("avora.node.json"),
    "manifest",
  );
  const cases = manifest.artifacts?.filter((a) => a.kind === "scenario") || [];
  if (!casePath) {
    if (cases.length !== 1)
      throw new Error(
        "Choose a case with --case tests/cases/<name>.avora-test.json.",
      );
    casePath = cases[0].path;
  }
  if (!cases.some((c) => c.path === casePath))
    throw new Error("Register this case in avora.node.json before generating.");
  const scenario = parsed<NodeScenario>(
    await read(casePath),
    "scenario",
    manifest,
  );
  const context = parsed<WorkspaceContext>(
    await read(scenario.context),
    "context",
  );
  // Only authoring templates are assembled. Cases, assertions, runtime inputs and other metadata stay local.
  const files: Record<string, string> = {};
  for (const template of manifest.templates) {
    files[template.path] = await read(template.path);
    const issue = validateTemplate(
      files[template.path],
      manifest.payload.node_config,
    ).find((d) => d.severity === "error");
    if (issue) throw new Error(`${template.path}: ${issue.message}`);
  }
  for (const entry of manifest.dependencyFiles || [])
    files[entry.path] = await read(entry.path);
  const {logo: _logo, color: _color, colorSource: _colorSource, ...runtimeConfig} = manifest.payload.node_config;
  const payload = assembleDraft({ ...manifest, payload: {...manifest.payload, node_config:runtimeConfig}, artifacts: undefined }, files);
  const configuration: Record<string, unknown> = {};
  for (const key of [
    "lineValues",
    "deletedLineIds",
    "configLineOrder",
    "inputs",
    "outputs",
    "errors",
    "logicFlows",
    "onErrorContinue",
    "onErrorMessage",
  ]) {
    if (Object.hasOwn(scenario.configuration, key))
      configuration[key] = scenario.configuration[key];
  }
  const settings: Record<string, unknown> = {};
  for (const key of ["name", "database_type", "expected_auth"])
    if (Object.hasOwn(context.settings, key))
      settings[key] = context.settings[key];
  if (Array.isArray(context.settings.env_variables))
    settings.env_variables = context.settings.env_variables.map((v: any) => ({
      key: v.key,
      value: "",
    }));
  const request = {
    source_map_version: 1,
    node_config: payload.node_config,
    code_bundle: {
      [scenario.framework]: payload.code_bundle[scenario.framework],
    },
    variant_id: scenario.variantId,
    framework: scenario.framework,
    configuration,
    context: { formatVersion: 1, graph: context.graph, settings },
  };
  if (Buffer.byteLength(JSON.stringify(request)) > 4_000_000)
    throw new Error("Generation snapshot exceeds 4 MB.");
  const template = manifest.templates.find(
    (t) =>
      t.framework === scenario.framework &&
      t.variantIds.includes(scenario.variantId),
  )!;
  return {
    request,
    sourceHash: generationHash(request),
    casePath,
    template: { path: template.path, source: files[template.path] },
  };
}

type Identity = { compiler_version: string; account_scope: string };
type Response = Identity & {
  files: Record<string, string>;
  service_file_path?: string;
  route_file_path?: string;
  schema_file_path?: string;
  request_path: string;
  operation_name: string;
  source_map?: SourceMap;
};
export type GenerationResult = {
  sourceMap?: SourceMap;
  id: string;
  directory: string;
  reused: boolean;
  sourceHash: string;
  compilerVersion: string;
  serviceFile?: string;
  routeFile?: string;
  schemaFile?: string;
  requestPath: string;
};
export type GenerateOptions = {
  folder: string;
  casePath?: string;
  apiUrl?: string;
  token: () => Promise<string>;
  read?: (relative: string) => Promise<string>;
  signal?: AbortSignal;
  fetch?: typeof fetch;
};
const inflight = new Map<string, Promise<GenerationResult>>();

/** One operation per local project; separate processes are serialized by an exclusive lock. */
export async function generateNode(
  options: GenerateOptions,
): Promise<GenerationResult> {
  const folder = await fs.realpath(options.folder);
  if (inflight.has(folder))
    throw new Error("Generation is already running for this node.");
  // Execution holds the same lease until its process tree is stopped. Never
  // replace an application underneath a running service (including lazy imports).
  const operation = withRuntimeLock(
    folder,
    ".avora/application",
    options.signal,
    undefined,
    (signal) => generate({ ...options, folder, signal }),
  );
  inflight.set(folder, operation);
  try {
    return await operation;
  } finally {
    inflight.delete(folder);
  }
}
async function jsonRequest(
  options: GenerateOptions,
  endpoint: string,
  token: string,
  body?: unknown,
): Promise<any> {
  const url = (options.apiUrl || LIVE_GENERATION_API).replace(/\/$/, "");
  if (
    !url.startsWith("https://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)
  )
    throw new Error("Generation requires HTTPS.");
  const signal = AbortSignal.any([
    AbortSignal.timeout(60_000),
    ...(options.signal ? [options.signal] : []),
  ]);
  const response = await (options.fetch || fetch)(url + endpoint, {
    method: body ? "POST" : "GET",
    signal,
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 20_000_000) {
          await reader.cancel();
          throw new Error("Generation response exceeds 20 MB.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  const source = Buffer.concat(chunks).toString("utf8");
  let data: any;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error("Avora returned an invalid generation response.");
  }
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "Your session expired. Log in to Avora and generate again.",
      );
    if (response.status === 404)
      throw new Error(
        "This backend does not support local node generation yet.",
      );
    if (response.status === 429)
      throw new Error("Generation is busy. Retry shortly.");
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : "Check the node structure and scratch context.";
    throw new GenerationDiagnosticError(
      `Generation failed (${response.status}): ${detail.slice(0, 1000)}`,
      data.source_map,
      data.source_diagnostics,
    );
  }
  return data;
}
function validateIdentity(value: any): asserts value is Identity {
  if (
    !/^[a-f0-9]{64}$/.test(value?.compiler_version) ||
    !/^[a-f0-9]{64}$/.test(value?.account_scope)
  )
    throw new Error("Invalid compiler version response.");
}
function validateFiles(response: Response) {
  if (
    !response.files ||
    typeof response.files !== "object" ||
    Array.isArray(response.files) ||
    !Object.keys(response.files).length ||
    Object.keys(response.files).length > 2000
  )
    throw new Error("Invalid generated files.");
  for (const [file, source] of Object.entries(response.files)) {
    if (
      typeof source !== "string" ||
      !/^[a-zA-Z0-9_./-]+$/.test(file) ||
      file.startsWith("/") ||
      file.split("/").some((p) => !p || p === "." || p === "..") ||
      /\.(jinja|j2)$/.test(file) ||
      file === ".env.local"
    )
      throw new Error("Unsafe generated file response.");
  }
  for (const file of [
    response.service_file_path,
    response.route_file_path,
    response.schema_file_path,
  ]) {
    if (file && !Object.hasOwn(response.files, file))
      throw new Error("Generated entry point is missing.");
  }
}
async function intact(
  directory: string,
  hashes: Record<string, string>,
): Promise<boolean> {
  try {
    if (
      (await fs.lstat(directory)).isSymbolicLink() ||
      !Object.keys(hashes).length
    )
      return false;
    for (const [file, hash] of Object.entries(hashes)) {
      const target = await safePath(directory, file);
      if (generationHash(await fs.readFile(target, "utf8")) !== hash)
        return false;
    }
    // Extra files invalidate a source cache, avoiding reuse of a modified application.
    const all = await fs.readdir(directory, {
      recursive: true,
      withFileTypes: true,
    });
    return (
      all.filter((item) => item.isFile() || item.isSymbolicLink()).length ===
      Object.keys(hashes).length
    );
  } catch {
    return false;
  }
}

/** Local verification only: preparation can reuse generated source while offline. */
export async function currentGeneration(
  folder: string,
  casePath?: string,
  read?: (relative: string) => Promise<string>,
): Promise<GenerationResult | undefined> {
  const snapshot = await readGenerationSnapshot(folder, casePath, read);
  if (
    await fs
      .stat(await safePath(folder, ".avora/generated/publication.json"))
      .then(
        () => true,
        (error: any) => {
          if (error.code === "ENOENT") return false;
          throw error;
        },
      )
  )
    return;
  const pointer = await safePath(folder, ".avora/generated/current.json");
  let current: any;
  try {
    current = JSON.parse(await fs.readFile(pointer, "utf8"));
  } catch (error: any) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return;
    throw error;
  }
  if (
    !current ||
    typeof current !== "object" ||
    current.sourceHash !== snapshot.sourceHash ||
    !/^[a-f0-9]{64}$/.test(current.id) ||
    !/^generated\/(fastapi|django|nestjs|spring)$/.test(current.directory) ||
    !current.hashes ||
    typeof current.hashes !== "object" ||
    Array.isArray(current.hashes)
  )
    return;
  const directory = await safePath(folder, current.directory);
  if (!(await intact(directory, current.hashes))) return;
  const response = current.response as Response;
  try {
    validateIdentity(response);
  } catch {
    return;
  }
  for (const file of [
    response.service_file_path,
    response.route_file_path,
    response.schema_file_path,
  ]) {
    if (file && !Object.hasOwn(current.hashes, file)) return;
  }
  return {
    sourceMap: validateSourceMap(response.source_map, snapshot),
    id: current.id,
    directory,
    reused: true,
    sourceHash: snapshot.sourceHash,
    compilerVersion: response.compiler_version,
    requestPath: response.request_path,
    serviceFile: response.service_file_path
      ? path.join(directory, response.service_file_path)
      : undefined,
    routeFile: response.route_file_path
      ? path.join(directory, response.route_file_path)
      : undefined,
    schemaFile: response.schema_file_path
      ? path.join(directory, response.schema_file_path)
      : undefined,
  };
}
async function generate(options: GenerateOptions): Promise<GenerationResult> {
  const read =
    options.read ||
    ((file: string) => readGenerationSource(options.folder, file));
  const snapshot = await readGenerationSnapshot(
    options.folder,
    options.casePath,
    read,
  );
  const root = await safePath(options.folder, ".avora/generated");
  await fs.mkdir(root, { recursive: true });
  const ignore = await safePath(options.folder, ".avora/.gitignore");
  await fs
    .writeFile(ignore, "*\n", { flag: "wx" })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
  const lockPath = await safePath(options.folder, ".avora/generate.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
  } catch (error: any) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another process is generating this node. If it crashed, remove .avora/generate.lock after confirming it has stopped.",
      );
    throw error;
  }
  await lock.writeFile(String(process.pid));
  let staged: string | undefined;
  try {
    await recoverPublication(options.folder);
    const token = await options.token();
    if (!token) throw new Error("Log in to Avora before generating.");
    const identity = await jsonRequest(
      options,
      "/generator/logic-node-preview/version",
      token,
    );
    validateIdentity(identity);
    const id = generationHash([
      options.apiUrl || LIVE_GENERATION_API,
      identity,
      snapshot.sourceHash,
    ]);

    const pointer = await safePath(
      options.folder,
      ".avora/generated/current.json",
    );
    let previous: any;
    try {
      previous = JSON.parse(await fs.readFile(pointer, "utf8"));
    } catch {}
    const targetRelative = `generated/${snapshot.request.framework}`;
    const priorDirectory =
      previous?.directory === targetRelative
        ? await safePath(options.folder, targetRelative)
        : /^[a-f0-9]{64}-[a-f0-9]{8}$/.test(previous?.release)
          ? await safePath(root, previous.release)
          : undefined;
    let reused = false,
      response: Response,
      hashes: Record<string, string>,
      directory: string;
    if (
      previous?.id === id &&
      priorDirectory &&
      previous.response?.compiler_version === identity.compiler_version &&
      previous.response?.account_scope === identity.account_scope &&
      previous.hashes &&
      [
        previous.response.service_file_path,
        previous.response.route_file_path,
        previous.response.schema_file_path,
      ].every((file) => !file || Object.hasOwn(previous.hashes, file)) &&
      (await intact(priorDirectory, previous.hashes))
    ) {
      reused = true;
      response = previous.response;
      hashes = previous.hashes;
      directory = priorDirectory;
      if (previous.directory !== targetRelative) {
        staged = await fs.mkdtemp(path.join(root, ".stage-"));
        await fs.cp(priorDirectory, staged, { recursive: true });
      }
    } else {
      try {
        response = await jsonRequest(
          options,
          "/generator/logic-node-preview",
          token,
          snapshot.request,
        );
      } catch (error) {
        if (
          (
            await readGenerationSnapshot(
              options.folder,
              snapshot.casePath,
              read,
            )
          ).sourceHash !== snapshot.sourceHash
        )
          throw new Error(
            "Source or case changed during generation. Discarded obsolete errors; generate again.",
          );
        if (error instanceof GenerationDiagnosticError) error.resolve(snapshot);
        throw error;
      }
      validateIdentity(response);
      if (
        response.compiler_version !== identity.compiler_version ||
        response.account_scope !== identity.account_scope
      )
        throw new Error(
          "The backend changed during generation. Generate again.",
        );
      validateFiles(response);
      validateSourceMap(response.source_map, snapshot, response.files);
      hashes = Object.fromEntries(
        Object.entries(response.files).map(([file, source]) => [
          file,
          generationHash(source),
        ]),
      );
      staged = await fs.mkdtemp(path.join(root, ".stage-"));
      for (const [file, source] of Object.entries(response.files)) {
        const target = await safePath(staged, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, source, { mode: 0o600 });
      }
      directory = await safePath(options.folder, targetRelative);
    }
    options.signal?.throwIfAborted();
    const latest = await readGenerationSnapshot(
      options.folder,
      snapshot.casePath,
      read,
    );
    if (latest.sourceHash !== snapshot.sourceHash)
      throw new Error(
        "Source or configuration changed during generation. Generate again; the previous result is intact.",
      );
    if ((await options.token()) !== token)
      throw new Error("Your Avora session changed. Generate again.");
    if (staged) {
      const { files: _files, ...metadata } = response;
      directory = await publishApplication(
        options.folder,
        staged,
        {
          id,
          directory: targetRelative,
          hashes,
          response: metadata,
          sourceHash: snapshot.sourceHash,
          casePath: snapshot.casePath,
        },
        previous,
      );
      staged = undefined;
      // Retire old hidden snapshots after the stable application is committed.
      for (const name of await fs.readdir(root)) {
        if (/^[a-f0-9]{64}-[a-f0-9]{8}$/.test(name))
          await fs
            .rm(path.join(root, name), { recursive: true, force: true })
            .catch(() => {});
      }
    }
    return {
      sourceMap: validateSourceMap(response.source_map, snapshot),
      id,
      directory,
      reused,
      sourceHash: snapshot.sourceHash,
      compilerVersion: identity.compiler_version,
      serviceFile: response.service_file_path
        ? path.join(directory, response.service_file_path)
        : undefined,
      routeFile: response.route_file_path
        ? path.join(directory, response.route_file_path)
        : undefined,
      schemaFile: response.schema_file_path
        ? path.join(directory, response.schema_file_path)
        : undefined,
      requestPath: response.request_path,
    };
  } finally {
    if (staged) await fs.rm(staged, { recursive: true, force: true });
    await lock.close();
    await fs.unlink(lockPath);
  }
}
