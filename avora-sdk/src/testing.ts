/** Saved-case orchestration. This module executes generated code only on explicit request. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { parse as parseEnv } from "dotenv";
import {
  parseProjectDocument,
  safeArtifactPath,
  type NodeScenario,
  type WorkspaceContext,
} from "./index";
import {
  currentGeneration,
  generationHash,
  readGenerationSnapshot,
  readGenerationSource,
  safePath,
} from "./generation";
import {
  prepareNode,
  type PrepareOptions,
  type PreparedNode,
} from "./environment";
import { atomicRuntimeFile, withRuntimeLock } from "./localRuntime";
import {
  runFastApi,
  RuntimeDiagnosticError,
  type RuntimeFailure,
  type RuntimeResponse,
} from "./fastapiRunner";
import {
  GenerationDiagnosticError,
  mapSourceDiagnostic,
  type SourceDiagnostic,
  type SourceMap,
} from "./sourceDiagnostics";
import type {
  NodeAssertion,
  NodeTestReport,
  NodeTestState,
} from "../types/run";
export type {
  NodeTestReport,
  NodeTestState,
  NodeAssertion,
} from "../types/run";

export type TestNodeOptions = PrepareOptions & {
  onState?: (state: NodeTestState) => void;
  onPrepared?: (prepared: PreparedNode) => Promise<void>;
  startupTimeout?: number;
  requestTimeout?: number;
};
const ADAPTER_VERSION = "fastapi-scratch-sqlite-v2";
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function localEnvironment(
  folder: string,
): Promise<Record<string, string>> {
  const file = await safePath(folder, ".env.local");
  let source: string;
  try {
    if ((await fs.stat(file)).size > 64_000)
      throw new Error(".env.local exceeds 64 KB.");
    source = await fs.readFile(file, "utf8");
  } catch (error: any) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
  // App variables are opt-in through this file, never the shell or exported workspace.
  // Runtime and database routing remain owned by the disposable test adapter.
  return Object.fromEntries(
    Object.entries(parseEnv(source)).filter(
      ([key]) =>
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) &&
        !/^(DATABASE|POSTGRES|MONGODB|MYSQL|REDIS|RESET_DB|PYTHON|UV_|PIP_|AVORA_|LD_|DYLD_|NODE_|VIRTUAL_ENV)/i.test(
          key,
        ) &&
        !/^(PATH|HOME|USERPROFILE|SYSTEMROOT|WINDIR|TEMP|TMP|TMPDIR|SSL_CERT_FILE|SSL_CERT_DIR)$/i.test(
          key,
        ),
    ),
  );
}
async function testSnapshot(
  options: Pick<TestNodeOptions, "folder" | "casePath" | "read" | "python">,
) {
  const read =
    options.read ||
    ((file: string) => readGenerationSource(options.folder, file));
  const generation = await readGenerationSnapshot(
    options.folder,
    options.casePath,
    read,
  );
  const scenario = parseProjectDocument(
    await read(generation.casePath),
    "scenario",
  ).value as NodeScenario;
  const context = parseProjectDocument(await read(scenario.context), "context")
    .value as WorkspaceContext;
  const environment = await localEnvironment(options.folder);
  const configurationHash = generationHash([
    ADAPTER_VERSION,
    options.python || "3.11",
    environment,
  ]);
  const scenarioHash = generationHash([
    scenario.framework,
    scenario.variantId,
    scenario.configuration,
    scenario.inputs,
    scenario.expect,
  ]);
  const contextHash = generationHash(context.graph);
  return {
    generation,
    scenario,
    context,
    environment,
    configurationHash,
    scenarioHash,
    contextHash,
    fingerprint: generationHash([
      generation.sourceHash,
      scenarioHash,
      contextHash,
      configurationHash,
    ]),
  };
}
function assertSupported(snapshot: Awaited<ReturnType<typeof testSnapshot>>) {
  if (snapshot.scenario.framework !== "fastapi")
    throw new Error("Run test currently supports FastAPI nodes only.");
  if (snapshot.context.graph.nodes.some((node) => node.type !== "enumNode"))
    throw new Error(
      "Run test currently supports pure nodes with an empty or enum-only scratch context. Database fixtures and full LogicFlows come later.",
    );
}
const reportPath = (casePath: string) =>
  `.avora/reports/${generationHash(casePath)}.json`;
function isReport(value: any, casePath: string): value is NodeTestReport {
  return (
    value?.formatVersion === 1 &&
    value.casePath === casePath &&
    typeof value.id === "string" &&
    typeof value.message === "string" &&
    typeof value.startedAt === "string" &&
    Number.isFinite(value.durationMs) &&
    ["passed", "failed", "not_tested", "outdated"].includes(value.status) &&
    Array.isArray(value.assertions) &&
    value.assertions.every(
      (item: any) =>
        typeof item?.label === "string" && typeof item.passed === "boolean",
    )
  );
}
async function lockFingerprint(folder: string) {
  return generationHash(
    JSON.parse(await fs.readFile(await safePath(folder, "avora.lock"), "utf8")),
  );
}
async function matchesSnapshot(options: TestNodeOptions, fingerprint: string) {
  try {
    return (await testSnapshot(options)).fingerprint === fingerprint;
  } catch {
    return false;
  }
}

export function compareNodeResult(
  expect: NodeScenario["expect"],
  actual: RuntimeResponse,
): NodeAssertion[] {
  const assertions: NodeAssertion[] = [];
  const add = (label: string, expected: unknown, value: unknown) =>
    assertions.push({
      label,
      expected,
      actual: value,
      passed: generationHash(expected) === generationHash(value),
    });
  if (expect?.error) {
    add("HTTP error status", expect.error.status, actual.status);
    if (Object.hasOwn(expect.error, "body"))
      add("Error body", expect.error.body, actual.body);
  } else {
    assertions.push({
      label: "HTTP success",
      expected: "200–299",
      actual: actual.status,
      passed: actual.status >= 200 && actual.status < 300,
    });
    if (expect && Object.hasOwn(expect, "output"))
      add("Output", expect.output, actual.body);
  }
  return assertions;
}

/** Offline schema/tag validation; does not claim Python type or behavioral correctness. */
export async function checkNode(
  options: Pick<TestNodeOptions, "folder" | "casePath" | "read" | "python">,
) {
  try {
    const snapshot = await testSnapshot(options);
    assertSupported(snapshot);
    return {
      status: "valid" as const,
      casePath: snapshot.generation.casePath,
      fingerprint: snapshot.fingerprint,
      checks: [
        "source schemas",
        "template tags",
        "case references",
        "local execution scope",
      ],
      warnings: Object.keys(snapshot.scenario.expect || {}).length
        ? []
        : [
            "No expectation is set. A run can show output but cannot pass a behavioral test.",
          ],
      diagnostics: [],
    };
  } catch (error) {
    return {
      status: "invalid" as const,
      casePath: options.casePath,
      checks: [],
      warnings: [],
      diagnostics: [{ message: errorMessage(error) }],
    };
  }
}

/** Read-only freshness check. Never generates, installs packages or executes a node. */
export async function readNodeTestState(
  options: Pick<TestNodeOptions, "folder" | "casePath" | "read" | "python">,
): Promise<NodeTestState> {
  let report: NodeTestReport | undefined;
  try {
    const snapshot = await testSnapshot(options);
    const file = await safePath(
      options.folder,
      reportPath(snapshot.generation.casePath),
    );
    if ((await fs.stat(file)).size > 12_000_000)
      throw new Error("Test report exceeds 12 MB.");
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    if (!isReport(value, snapshot.generation.casePath))
      return { status: "not_tested" };
    report = value;
    if (report.fingerprint !== snapshot.fingerprint)
      return {
        status: "outdated",
        report,
        message: "Source, case or runtime settings changed. Run test again.",
      };
    if (report.generationId) {
      const generation = await currentGeneration(
        options.folder,
        snapshot.generation.casePath,
        options.read,
      );
      const selected = JSON.parse(
        await fs.readFile(
          await safePath(options.folder, ".avora/environment.json"),
          "utf8",
        ),
      );
      if (
        generation?.id !== report.generationId ||
        selected.environmentId !== report.environmentId ||
        (await lockFingerprint(options.folder)) !== report.lockFingerprint
      )
        return {
          status: "outdated",
          report,
          message:
            "Generated code or the selected environment changed. Run test again.",
        };
    }
    return { status: report.status, report, message: report.message };
  } catch {
    // Broken source must invalidate a previous success, too. Its new snapshot
    // may be unreadable, but the saved report remains useful for comparison.
    if (
      !report &&
      options.casePath &&
      safeArtifactPath(options.casePath, "scenario")
    ) {
      try {
        const file = await safePath(
          options.folder,
          reportPath(options.casePath),
        );
        if ((await fs.stat(file)).size <= 12_000_000) {
          const previous = JSON.parse(await fs.readFile(file, "utf8"));
          if (isReport(previous, options.casePath)) report = previous;
        }
      } catch {}
    }
    return { status: report ? "outdated" : "not_tested", report };
  }
}

export async function testNode(
  options: TestNodeOptions,
): Promise<NodeTestReport> {
  const folder = await fs.realpath(options.folder);
  const started = Date.now();
  const report: NodeTestReport = {
    formatVersion: 1,
    id: randomUUID(),
    casePath: options.casePath || "",
    status: "not_tested",
    phase: "check",
    message: "Checking the case…",
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    assertions: [],
  };
  let environment: Record<string, string> = {};
  let sourceSnapshot: Awaited<ReturnType<typeof testSnapshot>> | undefined;
  let sourceMap: SourceMap | undefined;
  const runtimeDiagnostic = (failure: RuntimeFailure): SourceDiagnostic[] => {
    if (!sourceSnapshot) return [];
    const mapped = [...failure.frames]
      .reverse()
      .map((generated) =>
        mapSourceDiagnostic(sourceSnapshot!.generation, sourceMap, {
          message: failure.message,
          generated,
        }),
      );
    const issue =
      mapped.find((d) => d.authored) ||
      mapped[0] ||
      mapSourceDiagnostic(sourceSnapshot.generation, sourceMap, {
        message: failure.message,
      });
    return [{ ...issue, related: failure.frames }];
  };
  const state = (message: string) => {
    report.message = message;
    options.progress?.(message);
    options.onState?.({ status: "not_tested", active: true, message });
  };
  try {
    return await withRuntimeLock(
      folder,
      ".avora/test",
      options.signal,
      state,
      async (signal) => {
        try {
          const snapshot = await testSnapshot({ ...options, folder });
          sourceSnapshot = snapshot;
          report.casePath = snapshot.generation.casePath;
          report.label = snapshot.scenario.label || snapshot.scenario.id;
          report.fingerprint = snapshot.fingerprint;
          environment = snapshot.environment;
          assertSupported(snapshot);
          signal.throwIfAborted();
          report.phase = "prepare";
          state("Preparing the current case…");
          const prepared = await prepareNode({
            ...options,
            folder,
            casePath: report.casePath,
            signal,
            progress: state,
          });
          await options.onPrepared?.(prepared);
          // Generation and execution share a lease; preparation is outside this
          // lease because it can itself request generation. Check the gap below.
          await withRuntimeLock(
            folder,
            ".avora/application",
            signal,
            state,
            async (executionSignal) => {
              const current = await currentGeneration(
                folder,
                report.casePath,
                options.read,
              ).catch(() => undefined);
              if (
                current?.id !== prepared.generation.id ||
                !(await matchesSnapshot(
                  { ...options, folder },
                  snapshot.fingerprint,
                ))
              ) {
                report.status = "outdated";
                throw new Error(
                  "Source or case changed during preparation. Run test again.",
                );
              }
              report.generationId = current.id;
              sourceMap = current.sourceMap;
              report.environmentId = prepared.environmentId;
              report.lockFingerprint = await lockFingerprint(folder);
              report.identity = {
                sourceFingerprint: current.sourceHash,
                scenarioFingerprint: snapshot.scenarioHash,
                contextFingerprint: snapshot.contextHash,
                compilerVersion: current.compilerVersion,
                dependencyFingerprint: prepared.lockHash,
                runtimeProfileId: prepared.environmentId,
                privateConfigurationFingerprint: snapshot.configurationHash,
              };
              const { failure, ...actual } = await runFastApi({
                folder,
                prepared,
                inputs: snapshot.scenario.inputs,
                environment,
                signal: executionSignal,
                startupTimeout: options.startupTimeout,
                requestTimeout: options.requestTimeout,
                progress: state,
                phase: (phase) => {
                  report.phase = phase;
                },
              });
              report.actual = actual;
              if (failure) report.diagnostics = runtimeDiagnostic(failure);
              report.phase = "assertions";
              report.assertions = compareNodeResult(
                snapshot.scenario.expect,
                report.actual,
              );
              const failed = report.assertions.some(
                (assertion) => !assertion.passed,
              );
              const hasExpectation =
                !!snapshot.scenario.expect &&
                Object.keys(snapshot.scenario.expect).length > 0;
              report.status = failed
                ? "failed"
                : hasExpectation
                  ? "passed"
                  : "not_tested";
              report.message = failed
                ? failure?.message ||
                  "The actual result did not match the expectation."
                : hasExpectation
                  ? "All assertions passed."
                  : "Executed successfully. Add an expected output or error to test its behavior.";
              report.phase = "complete";
              const selected = await fs
                .readFile(
                  await safePath(folder, ".avora/environment.json"),
                  "utf8",
                )
                .then(
                  (text) => JSON.parse(text),
                  () => ({}),
                );
              if (
                !(await matchesSnapshot(
                  { ...options, folder },
                  snapshot.fingerprint,
                )) ||
                (
                  await currentGeneration(
                    folder,
                    report.casePath,
                    options.read,
                  ).catch(() => undefined)
                )?.id !== current.id ||
                selected.environmentId !== report.environmentId ||
                (await lockFingerprint(folder).catch(() => "")) !==
                  report.lockFingerprint
              ) {
                report.status = "outdated";
                report.message =
                  "Source, case or environment changed during the run. Run test again.";
              }
            },
          );
        } catch (error) {
          if (signal.aborted) {
            report.status = "not_tested";
            report.phase = "cancelled";
            report.message = "Test cancelled.";
          } else {
            if (report.status !== "outdated") report.status = "failed";
            report.message = errorMessage(error);
            if (error instanceof GenerationDiagnosticError)
              report.diagnostics = error.diagnostics;
            if (error instanceof RuntimeDiagnosticError)
              report.diagnostics = runtimeDiagnostic(error.failure);
          }
        }
        if (
          sourceSnapshot &&
          !(await matchesSnapshot(
            { ...options, folder },
            sourceSnapshot.fingerprint,
          ))
        ) {
          report.status = "outdated";
          report.message =
            "Source or case changed during this run. Discarded obsolete errors; run again.";
        }
        if (report.status !== "failed") delete report.diagnostics;
        // Persist before releasing the project run lock so newer runs always win.
        report.durationMs = Date.now() - started;
        for (const secret of Object.values(environment).filter(
          (value) => value.length >= 4,
        )) {
          report.message = report.message.split(secret).join("[redacted]");
          for (const issue of report.diagnostics || [])
            issue.message = issue.message.split(secret).join("[redacted]");
        }
        if (safeArtifactPath(report.casePath, "scenario"))
          await atomicRuntimeFile(
            folder,
            reportPath(report.casePath),
            JSON.stringify(report, null, 2) + "\n",
          );
        options.onState?.({
          status: report.status,
          report,
          message: report.message,
        });
        return report;
      },
    );
  } catch (error) {
    report.status = options.signal?.aborted ? "not_tested" : "failed";
    report.phase = options.signal?.aborted ? "cancelled" : report.phase;
    report.message = options.signal?.aborted
      ? "Test cancelled."
      : errorMessage(error);
    report.durationMs = Date.now() - started;
    options.onState?.({
      status: report.status,
      report,
      message: report.message,
    });
    return report;
  }
}
