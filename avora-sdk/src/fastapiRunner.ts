/** Public process adapter for a generated app. No generation logic or private assets. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { PreparedNode } from "./environment";
import {
  delay,
  runRuntime,
  runtimeEnvironment,
  type RuntimeProgress,
} from "./localRuntime";
import { safePath } from "./generation";
import { safeGeneratedPath, type GeneratedLocation } from "./sourceDiagnostics";

// Bind port 0 in the child and keep the socket open: no find-free-port race.
// CWD is disposable, so generated dotenv/database defaults cannot select a real DB.
const bootstrap = `import json, os, socket, sys, threading, traceback, linecache, hashlib
root = os.path.realpath(sys.argv[1])
def local_frame(filename, lineno, column=None, byte_column=False):
    filename = os.path.realpath(filename)
    if not filename.startswith(root + os.sep) or not filename.endswith(".py"):
        return None
    frame = {"path": os.path.relpath(filename, root).replace(os.sep, "/"), "line": lineno}
    with open(filename, "rb") as source: frame["hash"] = hashlib.sha256(source.read()).hexdigest()
    if column is not None:
        line = linecache.getline(filename, lineno)
        prefix = line.encode("utf-8")[:column].decode("utf-8", errors="ignore") if byte_column else line[:column]
        frame["column"] = len(prefix.encode("utf-16-le")) // 2
    return frame
def capture_failure(exc):
    try:
        for _ in range(8):
            children = getattr(exc, "exceptions", ())
            cause = exc.__cause__
            if children: exc = children[0]
            elif cause: exc = cause
            else: break
        frames = []
        for frame in traceback.extract_tb(exc.__traceback__):
            value = local_frame(frame.filename, frame.lineno, getattr(frame, "colno", None), True)
            if value: frames.append(value)
        if isinstance(exc, SyntaxError) and exc.filename:
            value = local_frame(exc.filename, exc.lineno or 1, max(0, (exc.offset or 1)-1))
            if value: frames.append(value)
        with open("failure.json.tmp", "w") as file:
            json.dump({"message": (type(exc).__name__ + ": " + str(exc))[:2000], "frames": frames[-30:]}, file)
        os.replace("failure.json.tmp", "failure.json")
    except Exception:
        pass
def report_unhandled(kind, exc, tb):
    capture_failure(exc)
    sys.__excepthook__(kind, exc, tb)
sys.excepthook = report_unhandled
class CaptureFailures:
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        try:
            await self.app(scope, receive, send)
        except Exception as exc:
            capture_failure(exc)
            raise
def watch_parent():
    sys.stdin.buffer.read()
    os._exit(1)
threading.Thread(target=watch_parent, daemon=True).start()
sys.path.insert(0, sys.argv[1])
import uvicorn
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))
with open("server.json", "x") as f:
    json.dump({"port": sock.getsockname()[1]}, f)
from app.main import app
app.add_middleware(CaptureFailures)
from app.core.database import Base
if Base.metadata.tables:
    raise RuntimeError("Database node tests require the later database-fixtures step. Use a pure node and scratch context for now.")
uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False)).run(sockets=[sock])
`;

export type RuntimeFailure = { message: string; frames: GeneratedLocation[] };
export type RuntimeResponse = {
  status: number;
  body: unknown;
  failure?: RuntimeFailure;
};
export class RuntimeDiagnosticError extends Error {
  constructor(readonly failure: RuntimeFailure) {
    super(failure.message);
    this.name = "RuntimeDiagnosticError";
  }
}
async function readFailure(
  scratch: string,
): Promise<RuntimeFailure | undefined> {
  try {
    const file = await safePath(scratch, "failure.json");
    if ((await fs.stat(file)).size > 64000) return;
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      typeof value.message !== "string" ||
      !Array.isArray(value.frames) ||
      value.frames.length > 30
    )
      return;
    const frames = value.frames.filter(
      (frame: any) =>
        safeGeneratedPath(frame?.path) &&
        Number.isSafeInteger(frame.line) &&
        frame.line > 0 &&
        (frame.column === undefined ||
          (Number.isSafeInteger(frame.column) && frame.column >= 0)),
    );
    return { message: value.message.slice(0, 2000), frames };
  } catch {
    return;
  }
}
export type FastApiRunOptions = {
  folder: string;
  prepared: PreparedNode;
  inputs: Record<string, unknown>;
  environment: Record<string, string>;
  signal: AbortSignal;
  progress?: RuntimeProgress;
  phase?: (phase: "start" | "ready" | "request") => void;
  startupTimeout?: number;
  requestTimeout?: number;
};

async function responseJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4_000_000) {
        await reader.cancel();
        throw new Error("Test response exceeds 4 MB.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const text = Buffer.concat(parts).toString("utf8");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The generated API returned a non-JSON response.");
  }
}

export async function runFastApi(
  options: FastApiRunOptions,
): Promise<RuntimeResponse> {
  const root = await safePath(options.folder, ".avora/runs");
  await fs.mkdir(root, { recursive: true });
  const scratch = await fs.mkdtemp(path.join(root, "run-"));
  await fs.chmod(scratch, 0o700);
  const stop = new AbortController();
  const signal = AbortSignal.any([options.signal, stop.signal]);
  const revision = randomUUID();
  let processDone: Promise<void> | undefined;
  let exited = false,
    failure: unknown;
  const assertRunning = () => {
    options.signal.throwIfAborted();
    if (exited)
      throw (
        failure ||
        new Error(
          "The generated application stopped before completing the test.",
        )
      );
  };
  try {
    options.phase?.("start");
    options.progress?.("Starting the generated application locally…");
    processDone = runRuntime(
      options.prepared.interpreter,
      ["-B", "-c", bootstrap, options.prepared.generation.directory],
      {
        cwd: scratch,
        signal,
        label: "Node application",
        keepAlive: true,
        timeout:
          (options.startupTimeout || 30_000) +
          (options.requestTimeout || 30_000) +
          10_000,
        env: {
          ...runtimeEnvironment(scratch),
          ...options.environment,
          PYTHONDONTWRITEBYTECODE: "1",
          PYTHONUNBUFFERED: "1",
          DATABASE_URL: `sqlite:///${path.join(scratch, "test.sqlite").split(path.sep).join("/")}`,
          RESET_DB_ON_START: "false",
          AVORA_PREVIEW_REVISION: revision,
        },
      },
    ).then(
      () => {
        exited = true;
      },
      (error) => {
        exited = true;
        failure = error;
      },
    );
    let base = "";
    const deadline = Date.now() + (options.startupTimeout || 30_000);
    let ready = false;
    options.phase?.("ready");
    options.progress?.("Waiting for the application to be ready…");
    while (Date.now() < deadline) {
      assertRunning();
      if (!base) {
        try {
          const info = JSON.parse(
            await fs.readFile(path.join(scratch, "server.json"), "utf8"),
          );
          if (Number.isInteger(info.port) && info.port > 0 && info.port < 65536)
            base = `http://127.0.0.1:${info.port}`;
        } catch (error: any) {
          if (error.code !== "ENOENT" && !(error instanceof SyntaxError))
            throw error;
        }
      }
      if (base) {
        try {
          const response = await fetch(`${base}/__avora/ready`, {
            signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
            redirect: "error",
          });
          const value: any = await responseJson(response);
          if (
            response.ok &&
            value.status === "ready" &&
            value.revision === revision
          ) {
            ready = true;
            break;
          }
        } catch {
          assertRunning();
        }
      }
      await delay(100, signal);
    }
    assertRunning();
    if (!ready)
      throw new Error(
        "Application startup timed out. Check generated Python errors and use a pure node with a scratch context.",
      );
    options.phase?.("request");
    const requestSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(options.requestTimeout || 30_000),
    ]);
    const schemaResponse = await fetch(`${base}/openapi.json`, {
      signal: requestSignal,
      redirect: "error",
    });
    if (!schemaResponse.ok)
      throw new Error("Could not read the generated API contract.");
    const schema: any = await responseJson(schemaResponse);
    const suffix = options.prepared.generation.requestPath;
    const routes = Object.keys(schema.paths || {}).filter(
      (route) =>
        typeof suffix === "string" &&
        (route === suffix || route.endsWith(`/api/v1${suffix}`)) &&
        schema.paths[route].post,
    );
    if (
      routes.length !== 1 ||
      !routes[0].startsWith("/api/v1/") ||
      routes[0].includes("..")
    )
      throw new Error(
        "The generated test endpoint is missing or ambiguous. Generate again.",
      );
    const operation = schema.paths[routes[0]].post;
    if (operation.parameters?.length)
      throw new Error(
        "This test endpoint needs unsupported request parameters.",
      );
    let bodySchema =
      operation.requestBody?.content?.["application/json"]?.schema;
    if (bodySchema?.$ref?.startsWith("#/components/schemas/"))
      bodySchema = schema.components?.schemas?.[bodySchema.$ref.slice(21)];
    const properties = bodySchema?.properties || {};
    const unknown = Object.keys(options.inputs).filter(
      (key) => !Object.hasOwn(properties, key),
    );
    if (unknown.length)
      throw new Error(
        `Unknown runtime input: ${unknown.join(", ")}. Use the input keys in the generated request schema.`,
      );
    options.progress?.("Sending inputs and checking the result…");
    const response = await fetch(base + routes[0], {
      method: "POST",
      signal: requestSignal,
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: operation.requestBody ? JSON.stringify(options.inputs) : undefined,
    });
    const body = await responseJson(response);
    assertRunning();
    return {
      status: response.status,
      body,
      ...(response.status >= 500
        ? { failure: await readFailure(scratch) }
        : {}),
    };
  } catch (error) {
    const failure = await readFailure(scratch);
    if (failure && !options.signal.aborted)
      throw new RuntimeDiagnosticError(failure);
    throw error;
  } finally {
    stop.abort();
    await processDone;
    await fs.rm(scratch, { recursive: true, force: true });
  }
}
