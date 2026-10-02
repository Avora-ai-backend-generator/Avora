const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  validateSourceMap,
  mapSourceDiagnostic,
  GenerationDiagnosticError,
} = require("../dist/sourceDiagnostics");
const hash = (text) => createHash("sha256").update(text).digest("hex");

function fixture() {
  const tag = "/*__HLV1_FIELD__|type=config|id=divisor__*/";
  const source =
    '/*__HLV1_START__|type=config|id=repeat__*/\r\n    emoji = "🐈"\r\n    result /= ' +
    tag +
    "\r\n/*__HLV1_STOP__|type=config|id=repeat__*/";
  const start = source.indexOf("result"),
    field = source.indexOf(tag);
  const snapshot = {
    template: { source, path: "templates/fastapi.py.avora" },
    request: { framework: "fastapi", variant_id: "main" },
    sourceHash: "snapshot",
    casePath: "tests/cases/main/zero.avora-test.json",
  };
  const files = {
    "app/services/node.py":
      "def run():\n    result /= 2\n    result /= 0\n    return response\n",
  };
  const map = {
    version: 1,
    framework: "fastapi",
    variantId: "main",
    templateHash: hash(source),
    files: {
      "app/services/node.py": [2, 3].flatMap((line, repeatIndex) => [
        {
          line,
          column: 4,
          endColumn: 14,
          origin: {
            start,
            end: field,
            kind: "literal",
            sectionId: "repeat",
            repeatIndex,
          },
        },
        {
          line,
          column: 14,
          endColumn: 15,
          origin: {
            start: field,
            end: field + tag.length,
            kind: "field",
            sectionId: "repeat",
            repeatIndex,
          },
        },
      ]),
    },
  };
  return {
    snapshot,
    map: validateSourceMap(map, snapshot, files),
    files,
    field,
    tag,
    start,
  };
}
test("exact literal and repeated field positions use UTF16 authored offsets", () => {
  const f = fixture();
  const literal = mapSourceDiagnostic(f.snapshot, f.map, {
    message: "broken",
    generated: { path: "app/services/node.py", line: 2, column: 4 },
  });
  assert.equal(literal.authored.start, f.start);
  assert.equal(literal.authored.end, f.start + 1);
  const field = mapSourceDiagnostic(f.snapshot, f.map, {
    message: "ZeroDivisionError",
    generated: { path: "app/services/node.py", line: 3, column: 14 },
  });
  assert.equal(field.authored.repeatIndex, 1);
  assert.equal(field.authored.start, f.field);
  assert.equal(
    f.snapshot.template.source.slice(field.authored.start, field.authored.end),
    f.tag,
  );
  assert.equal(field.generated.line, 3);
  assert.equal(field.casePath, f.snapshot.casePath);
});
test("missing exact columns use section ownership; wrapper lines never blame user source", () => {
  const f = fixture();
  const section = mapSourceDiagnostic(f.snapshot, f.map, {
    message: "broken",
    generated: { path: "app/services/node.py", line: 3 },
  });
  assert.equal(section.authored.kind, "section");
  assert.equal(section.authored.start, 0);
  assert.equal(section.authored.end, f.snapshot.template.source.length);
  for (const map of [f.map, undefined]) {
    const wrapper = mapSourceDiagnostic(f.snapshot, map, {
      message: "wrapper error",
      generated: { path: "app/services/node.py", line: 4, column: 4 },
    });
    assert.equal(wrapper.authored, undefined);
    assert.equal(wrapper.generated.line, 4);
  }
});
test("foreign, damaged or unsafe source maps cannot create source locations", () => {
  const f = fixture();
  for (const change of [
    (m) => (m.templateHash = "0".repeat(64)),
    (m) => (m.variantId = "other"),
    (m) => (m.files["../secret.py"] = []),
    (m) => (m.files["app/services/node.py"][0] = null),
    (m) => (m.files["app/services/node.py"][0].endColumn = 999),
    (m) => m.files["app/services/node.py"][0].origin.start++,
  ]) {
    const map = structuredClone(f.map);
    change(map);
    assert.throws(() => validateSourceMap(map, f.snapshot, f.files));
  }
  assert.equal(validateSourceMap(undefined, f.snapshot), undefined);
});
test("compile errors carry safe public source positions and the failed snapshot identity", () => {
  const f = fixture();
  const error = new GenerationDiagnosticError("invalid field", f.map, [
    {
      message: "unknown field",
      origin: { start: f.field, end: f.field + f.tag.length, kind: "field" },
    },
  ]).resolve(f.snapshot);
  assert.equal(error.sourceHash, "snapshot");
  assert.equal(
    error.diagnostics[0].authored.hash,
    hash(f.snapshot.template.source),
  );
  assert.equal(error.diagnostics[0].authored.path, f.snapshot.template.path);
});
