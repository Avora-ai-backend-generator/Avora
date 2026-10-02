const { test } = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("../dist");
const { readGenerationSnapshot } = require("../dist/generation");
test("legacy declarations migrate once, retain import mappings and preserve draft identity", () => {
  const payload = {
    node_config: { variants: [{ id: "main" }] },
    code_bundle: {
      fastapi: {
        variants: { main: { code: "pass" } },
        dependencies: [
          {
            id: "yaml",
            name: "PyYAML",
            version: "6.0.2",
            importLine: "import yaml",
            extra: { keep: true },
          },
        ],
      },
    },
    unknown: { keep: true },
  };
  const legacy = sdk.materializeDraft({
    draft_id: "b".repeat(32),
    revision: 7,
    payload,
  });
  const before = structuredClone(legacy.manifest);
  const moved = sdk.migrateDependencyFiles(legacy.manifest);
  assert.deepEqual(legacy.manifest, before);
  assert.equal(moved.manifest.revision, 7);
  assert.equal(moved.manifest.formatVersion, 3);
  assert.equal(
    moved.manifest.payload.code_bundle.fastapi.dependencies,
    undefined,
  );
  assert.match(moved.files[sdk.dependencyPath], /PyYAML==6.0.2/);
  const files = { ...legacy.files, ...moved.files };
  const wire = sdk.assembleDraft(moved.manifest, files);
  assert.deepEqual(
    wire.code_bundle.fastapi.dependencies,
    payload.code_bundle.fastapi.dependencies,
  );
  const restored = sdk.materializeDraft({
    draft_id: "b".repeat(32),
    revision: 8,
    payload: wire,
  });
  assert.equal(restored.files[sdk.dependencyPath], files[sdk.dependencyPath]);
  assert.deepEqual(sdk.assembleDraft(restored.manifest, restored.files), wire);
  assert.deepEqual(sdk.migrateDependencyFiles(moved.manifest).files, {});
});
test("table patches preserve comments, markers, metadata, CRLF and unsupported source", () => {
  const source =
    '# keep this\r\nrequests>=2; python_version >= "3.10"  # note\r\n-r extra.txt\r\n';
  const patched = sdk.patchDependencies(source, {
    action: "update",
    line: 1,
    name: "requests",
    version: ">=2.32,<3",
  });
  assert.equal(
    patched,
    '# keep this\r\nrequests>=2.32,<3; python_version >= "3.10"  # note\r\n-r extra.txt\r\n',
  );
  assert.equal(sdk.parseDependencies(patched).diagnostics.length, 1);
  assert.throws(() => sdk.dependenciesToDeclarations(patched), /named PyPI/);
  const removed = sdk.patchDependencies(patched, { action: "remove", line: 1 });
  assert.match(removed, /# note\r\n-r extra.txt/);
  assert.throws(
    () =>
      sdk.patchDependencies(source, {
        action: "update",
        line: 2,
        name: "other",
        version: "",
      }),
    /changed/,
  );
  assert.throws(() =>
    sdk.patchDependencies(source, {
      action: "add",
      name: "pkg\n-r malicious",
      version: "",
    }),
  );
});
test("source edits and table edits feed the same generation request without uploading unrelated authoring data", async () => {
  const project = sdk.createLocalProject("Dependencies", "dep-test");
  project.files[sdk.dependencyPath] = sdk.patchDependencies(
    project.files[sdk.dependencyPath],
    { action: "add", name: "pendulum", version: ">=3,<4" },
  );
  const read = async (file) =>
    file === "avora.node.json"
      ? JSON.stringify(project.manifest)
      : project.files[file];
  const first = await readGenerationSnapshot("/unused", undefined, read);
  assert.deepEqual(first.request.code_bundle.fastapi.dependencies, [
    { name: "pendulum", version: ">=3,<4" },
  ]);
  project.files[sdk.dependencyPath] += "# a comment\n";
  assert.equal(
    (await readGenerationSnapshot("/unused", undefined, read)).sourceHash,
    first.sourceHash,
  );
  project.files[sdk.dependencyPath] = project.files[sdk.dependencyPath].replace(
    ">=3,<4",
    "==3.1.0",
  );
  assert.notEqual(
    (await readGenerationSnapshot("/unused", undefined, read)).sourceHash,
    first.sourceHash,
  );
  assert.doesNotMatch(
    JSON.stringify(first.request),
    /dependencyFiles|Node libraries/,
  );
});
test("missing files, duplicate declarations and invalid metadata are rejected before generation", () => {
  const project = sdk.createLocalProject("Dependencies", "dep-test");
  const missingMapping = structuredClone(project.manifest);
  delete missingMapping.dependencyFiles;
  assert.ok(sdk.manifestIssues(missingMapping).some(issue => issue.code === "schema.required"));
  assert.throws(
    () =>
      sdk.assembleDraft(project.manifest, {
        ...project.files,
        [sdk.dependencyPath]: undefined,
      }),
    /dependency file/,
  );
  project.manifest.payload.code_bundle.fastapi.dependencies = [];
  assert.ok(
    sdk
      .manifestIssues(project.manifest)
      .some((i) => i.message.includes("duplicate declarations")),
  );
  assert.throws(
    () => sdk.assembleDraft(project.manifest, project.files),
    /duplicate/,
  );
  assert.throws(
    () =>
      sdk.dependenciesToDeclarations(
        'PyYAML # avora: {"fields":{"name":"replace"}}',
      ),
    /metadata/,
  );
  assert.throws(
    () => sdk.dependenciesToDeclarations("foo # avora: {broken"),
    /metadata/,
  );
});
