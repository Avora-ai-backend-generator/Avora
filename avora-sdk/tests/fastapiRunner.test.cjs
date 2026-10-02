const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { runFastApi, RuntimeDiagnosticError } = require("../dist/fastapiRunner");
const { createHash } = require("node:crypto");
const python = process.env.AVORA_TEST_PYTHON;

const main = `import asyncio, os
from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine, text
app = FastAPI()
engine = create_engine(os.environ["DATABASE_URL"])
assert ".avora/runs/" in os.environ["DATABASE_URL"]
assert "PRODUCTION_SECRET" not in os.environ
class Inputs(BaseModel):
    a: int
    b: int
@app.get("/__avora/ready")
def ready():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready", "revision": os.environ["AVORA_PREVIEW_REVISION"]}
@app.post("/api/v1/logic-node-template-test", status_code=201)
async def calculate(body: Inputs):
    if body.a == -999: await asyncio.sleep(60)
    return {"sum": body.a + body.b}
`;
async function fixture(t, source = main) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "avora-http-test-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const directory = path.join(folder, "generated/fastapi");
  for (const [file, value] of Object.entries({
    "app/main.py": source,
    "app/core/database.py":
      "from sqlalchemy.orm import declarative_base\nBase = declarative_base()\n",
    "app/__init__.py": "",
    "app/core/__init__.py": "",
    ".env": "DATABASE_URL=postgresql://must-not-use\n",
  })) {
    await fs.mkdir(path.dirname(path.join(directory, file)), {
      recursive: true,
    });
    await fs.writeFile(path.join(directory, file), value);
  }
  return {
    folder,
    prepared: {
      interpreter: python,
      generation: { directory, requestPath: "/logic-node-template-test" },
    },
    environment: {},
    inputs: { a: 2, b: 3 },
    signal: new AbortController().signal,
  };
}
test(
  "real FastAPI request binds JSON inputs, creates only a scratch DB and leaves generated code intact",
  { skip: !python },
  async (t) => {
    const f = await fixture(t);
    for (const [key, value] of Object.entries({
      PRODUCTION_SECRET: "never-inherit",
      DATABASE_URL: "postgresql://live",
    })) {
      const previous = process.env[key];
      process.env[key] = value;
      t.after(() => {
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      });
    }
    assert.deepEqual(await runFastApi(f), { status: 201, body: { sum: 5 } });
    assert.deepEqual(await fs.readdir(path.join(f.folder, ".avora/runs")), []);
    const files = await fs.readdir(f.prepared.generation.directory, {
      recursive: true,
    });
    assert.ok(
      !files.some(
        (file) => file.includes("__pycache__") || /sqlite|\.db$/.test(file),
      ),
    );
    await assert.rejects(
      runFastApi({ ...f, inputs: { wrong: 2 } }),
      /Unknown runtime input/,
    );
  },
);
test(
  "real import failure is actionable and cleans its runtime",
  { skip: !python },
  async (t) => {
    const f = await fixture(t, 'raise RuntimeError("broken-node-import")\n');
    await assert.rejects(runFastApi(f), (error) => {
      assert.ok(error instanceof RuntimeDiagnosticError);
      assert.match(error.message, /broken-node-import/);
      assert.deepEqual(
        error.failure.frames.map((f) => [f.path, f.line, f.column]),
        [["app/main.py", 1, 0]],
      );
      assert.equal(
        error.failure.frames[0].hash,
        createHash("sha256")
          .update('raise RuntimeError("broken-node-import")\n')
          .digest("hex"),
      );
      return true;
    });
    assert.deepEqual(await fs.readdir(path.join(f.folder, ".avora/runs")), []);
  },
);
test(
  "runtime HTTP failure includes only generated frames, UTF16 columns and current file hashes",
  { skip: !python },
  async (t) => {
    const source = main.replace(
      'return {"sum": body.a + body.b}',
      'emoji = "🐈"; value = 10 / body.b\n    return {"sum": value}',
    );
    const f = await fixture(t, source);
    await assert.rejects(
      runFastApi({ ...f, inputs: { a: 2, b: 0 } }),
      (error) => {
        assert.ok(error instanceof RuntimeDiagnosticError);
        assert.match(error.message, /ZeroDivisionError/);
        const frame = error.failure.frames.at(-1);
        assert.equal(frame.path, "app/main.py");
        assert.equal(
          frame.line,
          source.split("\n").findIndex((l) => l.includes("10 / body.b")) + 1,
        );
        assert.equal(frame.column, '    emoji = "🐈"; value = '.length);
        assert.equal(
          frame.hash,
          createHash("sha256").update(source).digest("hex"),
        );
        assert.ok(
          error.failure.frames.every(
            (frame) =>
              !frame.path.startsWith("/") &&
              !frame.path.includes("site-packages"),
          ),
        );
        return true;
      },
    );
    assert.deepEqual(await fs.readdir(path.join(f.folder, ".avora/runs")), []);
  },
);
test(
  "real HTTP cancellation and timeout stop the application before cleaning its DB",
  { skip: !python },
  async (t) => {
    const f = await fixture(t);
    const abort = new AbortController();
    await assert.rejects(
      runFastApi({
        ...f,
        signal: abort.signal,
        inputs: { a: -999, b: 1 },
        progress: (message) => {
          if (message.startsWith("Sending"))
            setTimeout(() => abort.abort(), 100);
        },
      }),
    );
    assert.deepEqual(await fs.readdir(path.join(f.folder, ".avora/runs")), []);
    await assert.rejects(
      runFastApi({ ...f, inputs: { a: -999, b: 1 }, requestTimeout: 150 }),
    );
    assert.deepEqual(await fs.readdir(path.join(f.folder, ".avora/runs")), []);
  },
);
