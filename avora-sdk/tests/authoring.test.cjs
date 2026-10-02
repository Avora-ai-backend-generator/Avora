const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const sdk = require("../dist");
const tag = (kind, id, type = "config") => sdk.makeTag(kind, type, id);
const section = (id, code) =>
  `${tag("START", id)}\n${code}\n${tag("STOP", id)}`;
const config = {
  label: "Example",
  variants: [
    {
      id: "one",
      lines: [{ id: "line", fields: [{ kind: "input", id: "value" }] }],
    },
    { id: "two" },
  ],
};
const source =
  section("one", `return ${tag("FIELD", "value")}`) +
  "\n" +
  section("two", "return 2");
const draft = () => ({
  draft_id: "a".repeat(32),
  revision: 4,
  payload: {
    node_config: config,
    icon_name: "Box",
    code_bundle: {
      fastapi: {
        variants: {
          one: { code: source, header: "", snippets: [] },
          two: { code: source, header: "", snippets: [] },
        },
        dependencies: [
          { name: "httpx", version: "0.28.1", importLine: "import httpx" },
        ],
        customImports: "import math",
      },
    },
  },
});

test("materialization preserves full metadata and shared source without duplicating files", () => {
  const input = draft(),
    copy = structuredClone(input),
    project = sdk.materializeDraft(input);
  assert.deepEqual(input, copy);
  assert.deepEqual(Object.keys(project.files), ["templates/fastapi.py.avora"]);
  assert.equal(
    project.manifest.payload.code_bundle.fastapi.variants.one.code,
    undefined,
  );
  assert.deepEqual(
    sdk.assembleDraft(project.manifest, project.files),
    input.payload,
  );
  project.files["templates/fastapi.py.avora"] = source + "\n# AI edit";
  const restored = sdk.assembleDraft(project.manifest, project.files);
  assert.equal(
    restored.code_bundle.fastapi.variants.one.code,
    restored.code_bundle.fastapi.variants.two.code,
  );
  assert.deepEqual(
    restored.code_bundle.fastapi.dependencies,
    input.payload.code_bundle.fastapi.dependencies,
  );
});
test("legacy distinct variant sources round trip without overwriting either source", () => {
  const input = draft();
  input.payload.code_bundle.fastapi.variants.two.code = section(
    "two",
    "return 42",
  );
  const project = sdk.materializeDraft(input);
  assert.equal(Object.keys(project.files).length, 2);
  assert.deepEqual(
    sdk.assembleDraft(project.manifest, project.files),
    input.payload,
  );
});
test("manifest traversal, missing mapping, duplicate mapping and missing sources are rejected", () => {
  const { manifest, files } = sdk.materializeDraft(draft());
  for (const path of [
    "../private.py",
    "templates/../../private.py.avora",
    "/tmp/a.py.avora",
    "templates/a.py",
    "templates/sub/a.py.avora",
  ])
    assert.equal(sdk.safeTemplatePath(path), false);
  assert.throws(() =>
    sdk.assembleDraft(
      {
        ...manifest,
        templates: [{ ...manifest.templates[0], path: "../private.py" }],
      },
      files,
    ),
  );
  assert.throws(() => sdk.assembleDraft({ ...manifest, templates: [] }, files));
  assert.throws(() =>
    sdk.assembleDraft(
      {
        ...manifest,
        templates: [...manifest.templates, ...manifest.templates],
      },
      files,
    ),
  );
  assert.throws(() => sdk.assembleDraft(manifest, {}));
});
test("tags retain select options and recursively expose fields added by an option", () => {
  const options = [
    {
      value: "custom",
      label: "Custom",
      addFields: [{ kind: "input", id: "extra" }],
    },
  ];
  const catalog = sdk.getTagCatalog({
    variants: [
      {
        id: "one",
        lines: [
          { id: "line", fields: [{ kind: "select", id: "choice", options }] },
        ],
      },
    ],
  });
  assert.ok(catalog.find((t) => t.id === "extra"));
  assert.ok(
    catalog
      .find((t) => t.id === "choice")
      .placeholder.includes(encodeURIComponent(JSON.stringify(options))),
  );
});
test("legacy section IDs and element instances match the visual node contract", () => {
  const config = { variants: [{
    id: "one",
    elements: { errors: [{ id: "new_timeout_id", message: "Request Timeout" }], outputs: { defaults: [{ id: "items_id", key: "items" }] } },
    instances: [{ id: "single", elements: { outputs: { defaults: [{ id: "single_id", key: "object" }] } } }],
    elementPacks: [{ id: "pack", elements: {}, instances: [{ id: "count", elements: { outputs: { defaults: [{ id: "count_id", key: "item_length" }] } } }] }],
    lines: [{ id: "line", fields: [{ id: "current_field", label: "Field name", kind: "input" }] }],
  }] };
  const sections = [
    ["error", "error_1777498212519", "Request Timeout"],
    ["outputs", "items", "items"],
    ["outputs", "object", "object"],
    ["output", "item_length", "item_length"],
  ].map(([type, id, name]) => sdk.makeTag("START", type, id, name) + "\npass\n" + sdk.makeTag("STOP", type, id, name)).join("\n");
  assert.deepEqual(sdk.validateTemplate(section("one", sections), config, ["one"]), []);
  assert.ok(sdk.getTagCatalog(config).some(t => t.label === "item_length"));
  const orphan = sdk.makeTag("FIELD", "config", "deleted_field", "Field name");
  assert.ok(sdk.validateTemplate(orphan, config).some(d => d.code === "tag.unknown"));
  assert.ok(sdk.validateTemplate(sdk.makeTag("START", "outputs", "deleted_output"), config).some(d => d.code === "tag.unknown"));
});
test("tag diagnostics catch broken nesting, encoding, unknown IDs and absent variants", () => {
  assert.deepEqual(sdk.validateTemplate(source, config, ["one", "two"]), []);
  const invalid =
    tag("START", "one") +
    tag("STOP", "other") +
    "/*__HLV1_FIELD__|id=%Q|type=config__*/";
  const codes = sdk
    .validateTemplate(invalid, config, ["two"])
    .map((d) => d.code);
  for (const code of [
    "tag.nesting",
    "tag.encoding",
    "tag.unclosed",
    "tag.unknown",
    "variant.missing",
  ])
    assert.ok(codes.includes(code), code);
  assert.equal(
    sdk.parseTags("/*__HLV1_START__broken").diagnostics[0].code,
    "tag.malformed",
  );
});
test("Python projections handle fields, indentation, async action bodies and map syntax errors to source", () => {
  const good = section(
    "one",
    `    x = ${tag("FIELD", "value")}\n    if x:\n        return await self.load(x)`,
  );
  const projection = sdk.projectPython(good, ["one"])[0];
  const check = spawnSync(
    "python3",
    ["-c", 'import sys; compile(sys.stdin.read(), "template", "exec")'],
    { input: projection.code, encoding: "utf8" },
  );
  assert.equal(check.status, 0, check.stderr);
  const bad = section(
    "one",
    `x = ${tag("FIELD", "value")}\nif True\n    return x`,
  );
  const p = sdk.projectPython(bad, ["one"])[0];
  const result = spawnSync(
    "python3",
    [
      "-c",
      'import sys,json\ntry: compile(sys.stdin.read(),"template","exec")\nexcept SyntaxError as e: print(json.dumps([e.lineno,e.offset]))',
    ],
    { input: p.code, encoding: "utf8" },
  );
  const [line, column] = JSON.parse(result.stdout);
  const offset = sdk.projectedOffset(p, line, column);
  assert.ok(
    offset >= bad.indexOf("if True") && offset <= bad.indexOf("if True") + 7,
  );
});
test("draft client encodes IDs, authenticates and surfaces revision conflicts", async () => {
  const original = global.fetch;
  const calls = [];
  try {
    global.fetch = async (...args) => {
      calls.push(args);
      return Response.json({ detail: "conflict" }, { status: 409 });
    };
    const client = new sdk.NodeDraftClient(
      "https://example.test/api/v1/",
      async () => "test-token",
    );
    await assert.rejects(
      client.update("a/b", 3, draft().payload),
      sdk.DraftConflictError,
    );
    assert.equal(calls[0][0], "https://example.test/api/v1/node-drafts/a%2Fb");
    assert.equal(calls[0][1].headers.Authorization, "Bearer test-token");
    assert.equal(JSON.parse(calls[0][1].body).revision, 3);
  } finally {
    global.fetch = original;
  }
});
test("inline section markers do not introduce Python indentation or split identifiers", () => {
  const source = section(
    "one",
    `${tag("START", "line")}x = ${tag("FIELD", "value")}${tag("STOP", "line")}\nreturn x`,
  );
  const p = sdk.projectPython(source, ["one"])[0];
  const check = spawnSync(
    "python3",
    ["-c", 'import sys; compile(sys.stdin.read(),"template","exec")'],
    { input: p.code, encoding: "utf8" },
  );
  assert.equal(check.status, 0, check.stderr);
});
