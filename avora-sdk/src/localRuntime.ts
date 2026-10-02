/** Public local process/filesystem support. No Avora compiler or server assets. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import lockfile = require("proper-lockfile");
import { safePath } from "./generation";

export type RuntimeProgress = (message: string) => void;
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}
export async function withRuntimeLock<T>(
  folder: string,
  name: string,
  signal: AbortSignal | undefined,
  progress: RuntimeProgress | undefined,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const target = await safePath(folder, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const compromised = new AbortController();
  const combined = AbortSignal.any([
    compromised.signal,
    ...(signal ? [signal] : []),
  ]);
  let release: (() => Promise<void>) | undefined;
  const deadline = Date.now() + 900_000;
  let reported = false;
  while (!release) {
    combined.throwIfAborted();
    await safePath(folder, name + ".lock");
    try {
      release = await lockfile.lock(target, {
        realpath: false,
        stale: 120_000,
        update: 10_000,
        retries: 0,
        onCompromised: (error) => compromised.abort(error),
      });
    } catch (error: any) {
      if (error.code !== "ELOCKED") throw error;
      if (Date.now() > deadline)
        throw new Error(
          "Another Avora operation is still running. Cancel or wait for it, then retry.",
        );
      if (!reported) {
        progress?.("Waiting for another Avora operation…");
        reported = true;
      }
      await delay(250, combined);
    }
  }
  try {
    return await work(combined);
  } finally {
    await release().catch(() => {});
  }
}
export async function atomicRuntimeFile(
  folder: string,
  relative: string,
  contents: string,
): Promise<void> {
  const target = await safePath(folder, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = target + ".tmp-" + randomUUID();
  try {
    await fs.writeFile(temporary, contents, { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
export function runtimeEnvironment(toolRoot: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  // Ignore project .env files, shell Python paths, pip/uv configuration and index overrides.
  for (const key of [
    "PATH",
    "HOME",
    "USERPROFILE",
    "SYSTEMROOT",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "TMPDIR",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ])
    if (process.env[key]) environment[key] = process.env[key];
  return {
    ...environment,
    UV_CACHE_DIR: path.join(toolRoot, "downloads"),
    UV_PYTHON_INSTALL_DIR: path.join(toolRoot, "python"),
    UV_NO_CONFIG: "1",
    UV_NO_PROGRESS: "1",
    UV_DEFAULT_INDEX: "https://pypi.org/simple",
    PYTHONNOUSERSITE: "1",
  };
}
export type RunRuntimeOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeout?: number;
  label?: string;
  /** A child watchdog can detect parent death through EOF on this pipe. */
  keepAlive?: boolean;
};
export async function runRuntime(
  command: string,
  args: string[],
  options: RunRuntimeOptions,
): Promise<string> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const processChild = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: [options.keepAlive ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      stopping: Error | undefined,
      killTimer: ReturnType<typeof setTimeout> | undefined;
    const terminate = (reason: Error) => {
      if (stopping) return;
      stopping = reason;
      if (!processChild.pid) return;
      if (process.platform === "win32") {
        const killer = spawn(
          "taskkill.exe",
          ["/PID", String(processChild.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => processChild.kill());
      } else {
        try {
          process.kill(-processChild.pid, "SIGTERM");
        } catch {}
        killTimer = setTimeout(() => {
          try {
            process.kill(-processChild.pid!, "SIGKILL");
          } catch {}
        }, 1000);
      }
    };
    const abort = () => terminate(new Error(`${options.label || "Preparation"} cancelled.`));
    const timeout = setTimeout(
      () =>
        terminate(
          new Error(
            `${options.label || "Dependency preparation"} timed out.`,
          ),
        ),
      options.timeout || 300_000,
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const cleanup = () => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", abort);
    };
    processChild.stdout!.on("data", (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-262144);
    });
    processChild.stderr!.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-16000);
    });
    processChild.on("error", (error) => {
      cleanup();
      reject(error);
    });
    processChild.on("close", (code) => {
      // A terminating parent can exit before its descendants. Finish the whole
      // process group before releasing the installation lock.
      if (stopping && process.platform !== "win32" && processChild.pid) {
        try {
          process.kill(-processChild.pid, "SIGKILL");
        } catch {}
      }
      cleanup();
      if (stopping) {
        reject(stopping);
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `${options.label || "Dependency tool"} failed: ${
              stderr
                .slice(-3500)
                .replace(/(https?:\/\/)[^\s/]+@/g, "$1[redacted]@")
                .trim() || "Check the selected Python interpreter and retry."
            }`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
  });
}
