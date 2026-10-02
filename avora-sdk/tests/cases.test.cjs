const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  createLocalProject,
  parseProjectDocument,
  safeArtifactPath,
} = require("../dist");
const { sampleNodeCases } = require("../dist/caseSamples");
const { planNodeCases, applyNodeCasePlan } = require("../dist/caseGeneration");
const { checkNode, readNodeTestState } = require("../dist/testing");
const contextPath = "tests/context/workspace.json";
function example() {
  const project = createLocalProject("Sampler", "sampler-test");
  const variant = project.manifest.payload.node_config.variants[0];
  variant.lines = [
    {
      id: "mode-line",
      lineType: "required",
      fields: [
        {
          id: "mode",
          kind: "select",
          label: "Mode",
          canCustom: false,
          options: [
            { value: "text", label: "Text" },
            { value: "numeric", label: "Numeric" },
          ],
          defaultValue: "text",
        },
      ],
    },
    {
      id: "extra",
      lineType: "required",
      fields: [{ id: "factor", kind: "input", fieldType: "number" }],
    },
    {
      id: "optional",
      lineType: "optional",
      fields: [{ id: "note", kind: "input", fieldType: "string" }],
    },
    {
      id: "repeat",
      lineType: "optional-multiple",
      max: 2,
      fields: [
        { id: "term", kind: "input", fieldType: "number", defaultValue: "4" },
      ],
      appendElements: {
        inputs: {
          defaults: [
            { id: "term-input", key: "term", type: "number", isEnabled: true },
          ],
        },
      },
    },
  ];
  variant.elements.inputs.defaults = [
    { id: "text", key: "text", type: "string", isEnabled: true },
  ];
  variant.conditions = [
    {
      id: "numeric-mode",
      label: "Numeric mode",
      condition: {
        type: "group",
        id: "and",
        logicalOperator: "AND",
        conditions: [
          {
            type: "condition",
            id: "mode-is-numeric",
            target: { type: "field", fieldId: "mode" },
            operator: "equals",
            value: "numeric",
          },
        ],
      },
      behaviors: [
        { actionType: "line", changeType: "show", lineId: "extra" },
        { actionType: "element", changeType: "hide", packId: "base" },
        { actionType: "element", changeType: "show", packId: "numeric" },
      ],
    },
  ];
  variant.elementPacks = [
    {
      id: "numeric",
      title: "Numeric",
      elements: {
        inputs: {
          defaults: [
            { id: "value", key: "value", type: "number", isEnabled: true },
          ],
        },
      },
    },
  ];
  const context = JSON.parse(project.files[contextPath]);
  return { project, variant, context };
}
async function fixture(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "avora-cases-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const { project } = example();
  for (const [file, content] of Object.entries({
    ...project.files,
    "avora.node.json": JSON.stringify(project.manifest, null, 2),
  })) {
    await fs.mkdir(path.dirname(path.join(folder, file)), { recursive: true });
    await fs.writeFile(path.join(folder, file), content);
  }
  const read = async (file) =>
    JSON.parse(await fs.readFile(path.join(folder, file), "utf8"));
  const write = async (file, value) =>
    fs.writeFile(
      path.join(folder, file),
      JSON.stringify(value, null, 2) + "\n",
    );
  return { folder, read, write };
}
test("samples visible inputs, conditional fields, optional rows and bounded repeated rows", () => {
  const { project, variant, context } = example();
  const result = sampleNodeCases(project.manifest, contextPath, context);
  const baseline = result.samples[0].scenario;
  assert.deepEqual({ ...baseline.inputs }, { text: "sample" });
  assert.equal(baseline.configuration.lineValues.factor, undefined);
  const numeric = result.samples.find(
    (s) => s.scenario.configuration.lineValues.mode === "numeric",
  ).scenario;
  assert.deepEqual({ ...numeric.inputs }, { value: 1 });
  assert.equal(numeric.configuration.lineValues.factor, "1");
  const repeated = result.samples.find(
    (s) => s.scenario.configuration.lineValues.repeat_count === "2",
  ).scenario;
  assert.equal(repeated.configuration.lineValues.term_0, "4");
  assert.equal(repeated.configuration.lineValues.term_1, "4");
  assert.equal(repeated.inputs.term1, 1);
  assert.equal(repeated.inputs.term2, 1);
  assert.ok(
    result.samples.some(
      (s) => !s.scenario.configuration.deletedLineIds.includes("optional"),
    ),
  );
  assert.ok(
    result.samples.every(
      (s) =>
        !("expect" in s.scenario) && !("inputs" in s.scenario.configuration),
    ),
  );
  for (const sample of result.samples)
    assert.equal(
      parseProjectDocument(
        JSON.stringify(sample.scenario),
        "scenario",
        project.manifest,
      ).diagnostics.length,
      0,
    );
  variant.lines.find((l) => l.id === "repeat").max = 1;
  assert.ok(
    sampleNodeCases(project.manifest, contextPath, context).samples.every(
      (s) => s.scenario.configuration.lineValues.repeat_count !== "2",
    ),
  );
});
test("AND witnesses reach conditional selections, while contradictory/static options are skipped", () => {
  const { project, variant, context } = example();
  variant.lines[0].fields.push({
    id: "second",
    kind: "select",
    canCustom: false,
    defaultValue: "a",
    options: [{ value: "a" }, { value: "b" }],
  });
  variant.conditions[0].condition.conditions.push({
    type: "condition",
    id: "second-b",
    target: { type: "field", fieldId: "second" },
    operator: "equals",
    value: "b",
  });
  variant.lines[1].fields.push({
    id: "inside",
    kind: "select",
    canCustom: false,
    defaultValue: "x",
    options: [{ value: "x" }, { value: "y" }],
  });
  const result = sampleNodeCases(project.manifest, contextPath, context);
  assert.ok(
    result.samples.some(
      (s) =>
        s.scenario.configuration.lineValues.mode === "numeric" &&
        s.scenario.configuration.lineValues.second === "b" &&
        s.scenario.configuration.lineValues.inside === "y",
    ),
  );
  variant.conditions[0].condition.conditions.push({
    type: "condition",
    id: "impossible",
    target: { type: "field", fieldId: "second" },
    operator: "equals",
    value: "c",
  });
  assert.ok(
    sampleNodeCases(project.manifest, contextPath, context).samples.every(
      (s) => s.scenario.configuration.lineValues.second !== "c",
    ),
  );
});
test("deterministic bounded coverage, fair baselines and no duplicate states", () => {
  const { project, variant, context } = example();
  variant.lines[0].fields[0].options = Array.from({ length: 1000 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));
  variant.lines[0].fields[0].defaultValue = "0";
  const other = structuredClone(variant);
  other.id = "another";
  project.manifest.payload.node_config.variants.push(other);
  project.manifest.templates[0].variantIds.push(other.id);
  project.manifest.payload.code_bundle.fastapi.variants.another = {
    ...project.manifest.payload.code_bundle.fastapi.variants.main,
    variantId: "another",
  };
  const result = sampleNodeCases(project.manifest, contextPath, context, 8);
  assert.equal(result.samples.length, 8);
  assert.equal(
    new Set(result.samples.slice(0, 2).map((s) => s.scenario.variantId)).size,
    2,
  );
  assert.deepEqual(
    result,
    sampleNodeCases(project.manifest, contextPath, context, 8),
  );
  assert.equal(new Set(result.samples.map((s) => s.path)).size, 8);
  assert.match(result.warnings.join(" "), /budget/);
  assert.throws(
    () => sampleNodeCases(project.manifest, contextPath, context, 1),
    /baselines/,
  );
});
test("conditions combining an optional line and a select generate a compatible witness", () => {
  const { project, variant, context } = example();
  variant.conditions[0].condition.conditions.push({
    type: "condition",
    id: "optional-visible",
    target: { type: "line", lineId: "optional" },
    operator: "isAppearing",
    value: "",
  });
  assert.ok(
    sampleNodeCases(project.manifest, contextPath, context).samples.some(
      (s) =>
        s.scenario.configuration.lineValues.mode === "numeric" &&
        !s.scenario.configuration.deletedLineIds.includes("optional") &&
        s.scenario.inputs.value === 1,
    ),
  );
});
test("fixtures are reused; unresolved entity inputs are explicitly marked for review", () => {
  const { project, variant, context } = example();
  variant.elements.inputs.defaults = [
    { key: "customer", type: "Customer" },
    { key: "rows", type: "[number]" },
  ];
  let result = sampleNodeCases(project.manifest, contextPath, context);
  assert.equal(result.samples[0].scenario.inputs.customer, null);
  assert.match(result.samples[0].warnings.join(" "), /customer.*fixture/);
  context.caseFixtures = {
    types: { Customer: { id: 7 } },
    inputs: { rows: [3, 5] },
  };
  result = sampleNodeCases(project.manifest, contextPath, context);
  assert.deepEqual(
    { ...result.samples[0].scenario.inputs },
    { customer: { id: 7 }, rows: [3, 5] },
  );
});
test("nested and legacy paths work; traversal and excessive nesting remain rejected", () => {
  assert.equal(
    safeArtifactPath("tests/cases/main/example.avora-test.json"),
    true,
  );
  assert.equal(safeArtifactPath("tests/cases/example.avora-test.json"), true);
  for (const file of [
    "tests/cases/../example.avora-test.json",
    "tests/cases/a/b/example.avora-test.json",
    "tests/cases/A/example.avora-test.json",
  ])
    assert.equal(safeArtifactPath(file), false);
});
test("preview does not write cases; apply registers cases; reruns are idempotent and preserve expectations", async (t) => {
  const { folder, read, write } = await fixture(t);
  let plan = await planNodeCases({ folder });
  const first = plan.entries[0].path;
  await assert.rejects(fs.readFile(path.join(folder, first)), {
    code: "ENOENT",
  });
  const result = await applyNodeCasePlan(plan);
  assert.ok(result.written.length > 2);
  const authored = await read(first);
  authored.expect = { output: { ok: true } };
  authored.inputs.text = "authored";
  authored.notes = "Keep me";
  await write(first, authored);
  plan = await planNodeCases({ folder });
  assert.ok(plan.entries.every((e) => e.status === "unchanged"));
  await applyNodeCasePlan(plan);
  assert.deepEqual(await read(first), authored);
  assert.ok(
    (await read("avora.node.json")).artifacts.some(
      (a) => a.path === "tests/cases/example.avora-test.json",
    ),
  );
  const checked = await checkNode({ folder, casePath: first });
  assert.equal(checked.status, "valid");
  const state = await readNodeTestState({ folder, casePath: first });
  assert.equal(state.status, "not_tested");
});
test("three-way regeneration updates untouched fields and preserves independent edits; conflicts never overwrite", async (t) => {
  const { folder, read, write } = await fixture(t);
  let plan = await planNodeCases({ folder });
  await applyNodeCasePlan(plan);
  const first = plan.entries[0].path;
  const authored = await read(first);
  authored.inputs.text = "authored";
  authored.expect = { output: 12 };
  await write(first, authored);
  const manifest = await read("avora.node.json");
  manifest.payload.node_config.variants[0].title = "Renamed";
  await write("avora.node.json", manifest);
  plan = await planNodeCases({ folder });
  assert.equal(plan.entries[0].status, "update");
  await applyNodeCasePlan(plan);
  assert.equal((await read(first)).inputs.text, "authored");
  assert.deepEqual((await read(first)).expect, { output: 12 });
  const current = await read(first);
  current.label = "My label";
  await write(first, current);
  manifest.payload.node_config.variants[0].title = "Renamed again";
  await write("avora.node.json", manifest);
  plan = await planNodeCases({ folder });
  assert.equal(plan.entries[0].status, "review");
  await applyNodeCasePlan(plan);
  assert.deepEqual(await read(first), current);
});
test("lost baseline preserves edited cases; stale previews and path collisions cannot overwrite", async (t) => {
  const { folder, read, write } = await fixture(t);
  let plan = await planNodeCases({ folder });
  await applyNodeCasePlan(plan);
  const first = plan.entries[0].path;
  const authored = await read(first);
  authored.inputs.text = "mine";
  await write(first, authored);
  await fs.unlink(path.join(folder, ".avora/cases/index.json"));
  plan = await planNodeCases({ folder });
  assert.equal(plan.entries[0].status, "review");
  await write("avora.node.json", {
    ...(await read("avora.node.json")),
    note: "changed",
  });
  await assert.rejects(applyNodeCasePlan(plan), /Sources changed/);
  assert.deepEqual(await read(first), authored);
});
test("failed multi-file apply rolls back only its writes and keeps an external edit", async (t) => {
  const { folder, read, write } = await fixture(t);
  const plan = await planNodeCases({ folder });
  const before = await read("avora.node.json");
  let writes = 0;
  await assert.rejects(
    applyNodeCasePlan(plan, {
      beforeWrite: async (file) => {
        // The second visit is during the write phase, after the preview CAS scan.
        if (file === plan.entries[1].path && ++writes === 2) {
          await write("avora.node.json", { ...before, note: "external" });
          throw new Error("Interrupted");
        }
      },
    }),
    /Interrupted/,
  );
  await assert.rejects(fs.readFile(path.join(folder, plan.entries[0].path)), {
    code: "ENOENT",
  });
  assert.equal((await read("avora.node.json")).note, "external");
  assert.equal((await planNodeCases({ folder })).entries[0].status, "add");
});
test("unregistered file collisions and interrupted transactions preserve authored files", async (t) => {
  const { folder, read, write } = await fixture(t);
  const plan = await planNodeCases({ folder }),
    file = plan.entries[0].path;
  await fs.mkdir(path.dirname(path.join(folder, file)), { recursive: true });
  await fs.writeFile(path.join(folder, file), "authored content");
  assert.equal((await planNodeCases({ folder })).entries[0].status, "review");
  await fs.unlink(path.join(folder, file));
  // Simulate a crash after writing one case, before registering it in the manifest.
  const writeCase = plan.writes.find((w) => w.path === file);
  await fs.writeFile(path.join(folder, file), writeCase.after);
  await fs.mkdir(path.join(folder, ".avora/cases"), { recursive: true });
  await write(".avora/cases/transaction.json", {
    version: 1,
    writes: plan.writes,
  });
  assert.equal((await planNodeCases({ folder })).entries[0].status, "add");
  await assert.rejects(fs.readFile(path.join(folder, file)), {
    code: "ENOENT",
  });
  assert.equal(
    (await read("avora.node.json")).artifacts.some((a) => a.path === file),
    false,
  );
});
