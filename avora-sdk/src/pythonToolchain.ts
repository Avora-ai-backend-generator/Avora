import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { UV_VERSION, UV_WHEELS } from "./uvRelease";
import { safePath } from "./generation";
import {
  withRuntimeLock,
  atomicRuntimeFile,
  runRuntime,
  runtimeEnvironment,
  type RuntimeProgress,
} from "./localRuntime";

export { UV_VERSION } from "./uvRelease";
const sha256 = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const defaultToolRoot = () =>
  path.join(os.homedir(), ".avora", "node-runtime");
export function uvWheelName(
  platform = process.platform,
  architecture = process.arch,
  musl = false,
): string {
  const suffix =
    platform === "darwin"
      ? (
          { x64: "macosx_10_12_x86_64", arm64: "macosx_11_0_arm64" } as Record<
            string,
            string
          >
        )[architecture]
      : platform === "win32"
        ? ({ x64: "win_amd64", arm64: "win_arm64" } as Record<string, string>)[
            architecture
          ]
        : platform === "linux"
          ? architecture === "arm64"
            ? "manylinux_2_17_aarch64.manylinux2014_aarch64.musllinux_1_1_aarch64"
            : architecture === "x64"
              ? musl
                ? "musllinux_1_1_x86_64"
                : "manylinux_2_17_x86_64.manylinux2014_x86_64"
              : undefined
          : undefined;
  const name = `uv-${UV_VERSION}-py3-none-${suffix}.whl`;
  if (!suffix || !UV_WHEELS[name])
    throw new Error(
      "Local preparation supports macOS, Windows and Linux on x64/arm64. This platform has no supported uv toolchain.",
    );
  return name;
}
export async function ensureUv(
  root: string,
  signal?: AbortSignal,
  progress?: RuntimeProgress,
): Promise<string> {
  const musl =
    process.platform === "linux" &&
    !(process.report.getReport() as any).header.glibcVersionRuntime;
  const wheel = UV_WHEELS[uvWheelName(process.platform, process.arch, musl)];
  const relative = `tools/uv-${UV_VERSION}-${process.platform}-${process.arch}`;
  await fs.mkdir(root, { recursive: true });
  return withRuntimeLock(
    root,
    "tool-install",
    signal,
    progress,
    async (locked) => {
      const directory = await safePath(root, relative);
      const executable = await safePath(
        root,
        `${relative}/${process.platform === "win32" ? "uv.exe" : "uv"}`,
      );
      try {
        const marker = JSON.parse(
          await fs.readFile(
            await safePath(root, `${relative}/ready.json`),
            "utf8",
          ),
        );
        if (
          marker.wheel === wheel.sha256 &&
          marker.binary === sha256(await fs.readFile(executable))
        )
          return executable;
      } catch {}
      progress?.("Downloading the local dependency tool…");
      const response = await fetch(wheel.url, {
        signal: AbortSignal.any([locked, AbortSignal.timeout(120_000)]),
        redirect: "error",
      });
      if (!response.ok || !response.body)
        throw new Error(
          "Could not download uv from PyPI. Check your connection and retry Prepare.",
        );
      const parts: Uint8Array[] = [];
      let size = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > wheel.size) {
            await reader.cancel();
            throw new Error(
              "The downloaded uv archive has an unexpected size.",
            );
          }
          parts.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const archive = Buffer.concat(parts);
      if (archive.length !== wheel.size || sha256(archive) !== wheel.sha256)
        throw new Error(
          "The downloaded dependency tool failed its checksum. Retry Prepare.",
        );
      const binaryName = `uv-${UV_VERSION}.data/scripts/${process.platform === "win32" ? "uv.exe" : "uv"}`;
      const files = unzipSync(archive, {
        filter: (file) =>
          file.name === binaryName ||
          file.name.includes(".dist-info/licenses/"),
      });
      const binary = files[binaryName];
      if (!binary || binary.length > 100_000_000)
        throw new Error("The dependency tool archive is invalid.");
      locked.throwIfAborted();
      await fs.mkdir(directory, { recursive: true });
      const temporary = executable + ".download";
      await safePath(root, `${relative}/${path.basename(temporary)}`);
      await fs.writeFile(temporary, binary, { mode: 0o755 });
      await fs.rename(temporary, executable);
      for (const [file, contents] of Object.entries(files)) {
        if (file.includes(".dist-info/licenses/"))
          await atomicRuntimeFile(
            root,
            `${relative}/${path.basename(file)}`,
            Buffer.from(contents).toString("utf8"),
          );
      }
      await atomicRuntimeFile(
        root,
        `${relative}/ready.json`,
        JSON.stringify({ wheel: wheel.sha256, binary: sha256(binary) }),
      );
      return executable;
    },
  );
}
export type PythonIdentity = {
  version: string;
  implementation: string;
  platform: string;
  machine: string;
  abi: string;
  bits: number;
};
export type PythonRuntime = { executable: string; identity: PythonIdentity };
export async function resolvePython(
  uv: string,
  root: string,
  requested = "3.11",
  signal?: AbortSignal,
  progress?: RuntimeProgress,
): Promise<PythonRuntime> {
  const env = runtimeEnvironment(root);
  const run = (args: string[]) =>
    runRuntime(uv, args, { cwd: root, env, signal });
  let executable: string;
  if (path.isAbsolute(requested)) executable = requested;
  else {
    if (!/^3\.(1[0-9])(?:\.\d+)?$/.test(requested))
      throw new Error(
        "Choose a Python version such as 3.11, or an absolute interpreter path.",
      );
    try {
      executable = await run([
        "python",
        "find",
        "--managed-python",
        "--no-python-downloads",
        requested,
      ]);
    } catch {
      signal?.throwIfAborted();
      progress?.(`Preparing Python ${requested}…`);
      await run(["python", "install", requested]);
      executable = await run([
        "python",
        "find",
        "--managed-python",
        "--no-python-downloads",
        requested,
      ]);
    }
  }
  progress?.("Checking the selected Python runtime…");
  const identity: PythonIdentity = JSON.parse(
    await runRuntime(
      executable,
      [
        "-I",
        "-S",
        "-c",
        "import json,sys,sysconfig,platform,struct; print(json.dumps(dict(version=platform.python_version(),implementation=sys.implementation.name,platform=sysconfig.get_platform(),machine=platform.machine(),abi=sysconfig.get_config_var('SOABI') or '',bits=struct.calcsize('P')*8)))",
      ],
      { cwd: root, env, signal, timeout: 15_000 },
    ),
  );
  const [major, minor] = identity.version.split(".").map(Number);
  if (major !== 3 || minor < 10 || identity.implementation !== "cpython")
    throw new Error(
      "The generated FastAPI application requires CPython 3.10 or newer.",
    );
  return { executable: await fs.realpath(executable), identity };
}
