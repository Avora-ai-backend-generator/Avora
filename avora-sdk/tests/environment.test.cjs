const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { createLocalProject } = require("../dist");
const { generateNode, currentGeneration } = require("../dist/generation");
const {
  prepareNode,
  normalizeRequirements,
  environmentIdentity,
} = require("../dist/environment");
const toolchain = require("../dist/pythonToolchain");
const local = require("../dist/localRuntime");
const runtime = {
  version: "3.11.16",
  implementation: "cpython",
  platform: "linux-x86_64",
  machine: "x86_64",
  abi: "cpython-311",
  bits: 64,
};
const executable = path.resolve("/test/python");
const locked = "idna==3.10 \\\n    --hash=sha256:" + "a".repeat(64) + "\n";
async function fixture(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "avora-prepare-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const project = createLocalProject("Prepare test", "prepare-test");
  for (const [file, text] of Object.entries({
    ...project.files,
    "avora.node.json": JSON.stringify(project.manifest),
  })) {
    await fs.mkdir(path.dirname(path.join(folder, file)), { recursive: true });
    await fs.writeFile(path.join(folder, file), text);
  }
  const generation = await generateNode({
    folder,
    token: async () => "test",
    fetch: async () =>
      Response.json({
        compiler_version: "a".repeat(64),
        account_scope: "b".repeat(64),
        files: {
          "requirements.txt": "idna>=3,<4\n",
          "app/main.py": 'raise RuntimeError("must never execute")\n',
        },
      }),
  });
  const calls = [];
  let failure = false,
    drift = false;
  t.mock.method(toolchain, "ensureUv", async () => "test-uv");
  t.mock.method(toolchain, "resolvePython", async () => ({
    identity: runtime,
    executable,
  }));
  t.mock.method(local, "runRuntime", async (command, args, options) => {
    options.signal?.throwIfAborted();
    calls.push(args);
    if (args[0] === "venv") {
      await fs.mkdir(args[1], { recursive: true });
      return "";
    }
    if (args[1] === "compile") {
      await fs.writeFile(args[args.indexOf("--output-file") + 1], locked);
      return "";
    }
    if (args[1] === "sync" && failure)
      throw new Error("Simulated interrupted installation");
    if (args[1] === "list")
      return JSON.stringify([
        { name: "idna", version: drift ? "3.9" : "3.10" },
      ]);
    return "";
  });
  return {
    folder,
    generation,
    calls,
    options: { folder, toolRoot: path.join(folder, "tools") },
    fail: () => {
      failure = true;
    },
    drift: () => {
      drift = true;
    },
  };
}
test("requirements accept named packages and hashes; reject paths, URLs and installer options", () => {
  assert.equal(
    normalizeRequirements("idna>=3,<4\n# comment\nidna>=3,<4"),
    "idna>=3,<4\n",
  );
  assert.equal(normalizeRequirements(locked, true), locked);
  for (const input of [
    "-r /secret",
    "pkg @ https://example.test/x.whl",
    "../pkg",
    "--index-url https://example.test",
    "pkg --extra-index-url https://example.test",
    "git+https://example.test/repo",
  ])
    assert.throws(() => normalizeRequirements(input), /named PyPI/);
});
test("runtime, OS, architecture, ABI, lock and interpreter separate environment identities", () => {
  const original = environmentIdentity(runtime, "lock", executable);
  for (const changed of [
    { ...runtime, version: "3.12.1" },
    { ...runtime, platform: "win-amd64" },
    { ...runtime, machine: "arm64" },
    { ...runtime, abi: "other" },
  ])
    assert.notEqual(environmentIdentity(changed, "lock", executable), original);
  assert.notEqual(
    environmentIdentity(runtime, "changed", executable),
    original,
  );
  assert.notEqual(
    environmentIdentity(runtime, "lock", executable + "2"),
    original,
  );
  for (const platform of ["darwin", "win32", "linux"])
    for (const arch of ["x64", "arm64"])
      assert.match(toolchain.uvWheelName(platform, arch), /\.whl$/);
});
test("locks once and publishes a checked environment; reuses offline without generation or installation", async (t) => {
  const f = await fixture(t);
  const first = await prepareNode(f.options);
  assert.equal(first.reused, false);
  const pointer = JSON.parse(
    await fs.readFile(path.join(f.folder, ".avora/environment.json")),
  );
  assert.equal(pointer.interpreter, first.interpreter);
  assert.equal(pointer.languageContext.template.source,await fs.readFile(path.join(f.folder,'templates/fastapi.py.avora'),'utf8'));
  assert.match(pointer.languageContext.contextHash,/^[a-f0-9]{64}$/);
  assert.ok(
    JSON.parse(await fs.readFile(path.join(first.directory, "ready.json")))
      .inventory,
  );
  const count = f.calls.length;
  const second = await prepareNode({
    ...f.options,
    generate: async () => {
      throw new Error("Offline: must not call generation");
    },
  });
  assert.equal(second.reused, true);
  assert.equal(first.directory, second.directory);
  assert.deepEqual(
    f.calls.slice(count).map((args) => args[1]),
    ["list", "check"],
  );
  const workspace = JSON.parse(await fs.readFile(second.workspaceFile));
  assert.equal(
    workspace.settings["python.defaultInterpreterPath"],
    first.interpreter,
  );
  assert.equal(workspace.folders[0].path, await fs.realpath(f.folder));
  const compile = f.calls.find((args) => args[1] === "compile"),
    install = f.calls.find((args) => args[1] === "sync");
  assert.ok(
    compile.includes("--generate-hashes") &&
      install.includes("--require-hashes") &&
      install.includes("--only-binary"),
  );
});
test("concurrent preparations share one installation and publish complete results", async (t) => {
  const f = await fixture(t);
  const results = await Promise.all([
    prepareNode(f.options),
    prepareNode(f.options),
  ]);
  assert.deepEqual(results.map((x) => x.reused).sort(), [false, true]);
  assert.equal(results[0].directory, results[1].directory);
  assert.equal(f.calls.filter((args) => args[1] === "sync").length, 1);
});
test("drift rebuilds; failed installation preserves prior selection and cleans partial directories", async (t) => {
  const f = await fixture(t);
  const first = await prepareNode(f.options);
  const pointer = await fs.readFile(
    path.join(f.folder, ".avora/environment.json"),
    "utf8",
  );
  f.drift();
  f.fail();
  await assert.rejects(prepareNode(f.options), /interrupted installation/);
  assert.equal(
    await fs.readFile(path.join(f.folder, ".avora/environment.json"), "utf8"),
    pointer,
  );
  assert.deepEqual(
    await fs.readdir(path.join(f.folder, ".avora/environments")),
    [path.basename(first.directory)],
  );
});
test("unsaved source changes during preparation cannot publish a stale environment", async (t) => {
  const f = await fixture(t);
  await prepareNode(f.options);
  const pointer = await fs.readFile(
    path.join(f.folder, ".avora/environment.json"),
    "utf8",
  );
  let changed = false;
  await assert.rejects(
    prepareNode({
      ...f.options,
      progress: () => {
        changed = true;
      },
      read: async (file) => {
        const text = await fs.readFile(path.join(f.folder, file), "utf8");
        return changed && file.endsWith(".avora")
          ? text + "\n# changed\n"
          : text;
      },
    }),
    /changed during preparation/,
  );
  assert.equal(
    await fs.readFile(path.join(f.folder, ".avora/environment.json"), "utf8"),
    pointer,
  );
});
test("offline source verification rejects modified generated files", async (t) => {
  const f = await fixture(t);
  assert.ok(await currentGeneration(f.folder));
  await fs.appendFile(
    path.join(f.generation.directory, "requirements.txt"),
    "unexpected==1\n",
  );
  assert.equal(await currentGeneration(f.folder), undefined);
  await assert.rejects(prepareNode(f.options), /Generate this case/);
});
test("cancelled lock wait never acquires; separate processes serialize", async (t) => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "avora-lock-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const modulePath = path.resolve(__dirname, "../dist/localRuntime");
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const {withRuntimeLock}=require(${JSON.stringify(modulePath)}); withRuntimeLock(${JSON.stringify(folder)},'prepare',undefined,undefined,async()=>{process.send('locked');await new Promise(resolve=>process.once('message',resolve));}).then(()=>process.exit(0));`,
    ],
    { stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("error", reject);
  });
  const abort = new AbortController();
  let entered = false;
  await assert.rejects(
    local.withRuntimeLock(
      folder,
      "prepare",
      abort.signal,
      () => abort.abort(),
      async () => {
        entered = true;
      },
    ),
  );
  assert.equal(entered, false);
  child.send("release");
  await new Promise((resolve) => child.once("exit", resolve));
  await local.withRuntimeLock(
    folder,
    "prepare",
    undefined,
    undefined,
    async () => {
      entered = true;
    },
  );
  assert.equal(entered, true);
});
test(
  "cancelling a runtime process kills descendants",
  { skip: process.platform === "win32" },
  async (t) => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "avora-cancel-"));
    t.after(() => fs.rm(folder, { recursive: true, force: true }));
    const pidFile = path.join(folder, "child.pid");
    const abort = new AbortController();
    const script = `const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:'ignore'});require('fs').writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000);`;
    const running = local.runRuntime(process.execPath, ["-e", script], {
      cwd: folder,
      env: process.env,
      signal: abort.signal,
    });
    let pid;
    for (let i = 0; i < 100; i++) {
      try {
        pid = Number(await fs.readFile(pidFile, "utf8"));
        break;
      } catch {
        await local.delay(10);
      }
    }
    assert.ok(pid);
    abort.abort();
    await assert.rejects(running, /cancelled/);
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(pid, 0);
        await local.delay(10);
      } catch {
        return;
      }
    }
    assert.fail("Descendant was left alive");
  },
);
