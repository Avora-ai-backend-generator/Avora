const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createLocalProject } = require("../dist");
const { generateNode, readGenerationSnapshot } = require("../dist/generation");
const identity = {
  compiler_version: "a".repeat(64),
  account_scope: "b".repeat(64),
};
const files = {
  "app/main.py": "pass\n",
  "app/services/test.py": "result = 1\n",
};
async function fixture(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "avora-generation-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const project = createLocalProject("Test", "test");
  for (const [file, text] of Object.entries({
    ...project.files,
    "avora.node.json": JSON.stringify(project.manifest),
  })) {
    await fs.mkdir(path.dirname(path.join(folder, file)), { recursive: true });
    await fs.writeFile(path.join(folder, file), text);
  }
  let posts = 0,
    change,
    failure,
    remoteIdentity = identity;
  const requests = [];
  const options = {
    folder,
    token: async () => "test-token",
    fetch: async (url, init) => {
      if (!init.body) return Response.json(remoteIdentity);
      posts++;
      requests.push(JSON.parse(init.body));
      if (change) await change();
      if (failure) return Response.json({ detail: "Failed" }, { status: 500 });
      return Response.json({
        ...remoteIdentity,
        files,
        service_file_path: "app/services/test.py",
        request_path: "/logic-node-template-test",
      });
    },
  };
  return {
    folder,
    project,
    options,
    requests,
    posts: () => posts,
    change: (fn) => (change = fn),
    fail: () => (failure = true),
    identity: (v) => (remoteIdentity = v),
  };
}
test("generation reuses matching source, excludes runtime inputs and secrets, invalidates compiler/account changes", async (t) => {
  const f = await fixture(t);
  const ctx = path.join(f.folder, "tests/context/workspace.json");
  const context = JSON.parse(await fs.readFile(ctx));
  context.settings.env_variables = [{ key: "TOKEN", value: "private-secret" }];
  context.settings.database_url = "production-url";
  await fs.writeFile(ctx, JSON.stringify(context));
  await fs.writeFile(
    path.join(f.folder, ".env.local"),
    "MUST_NEVER_UPLOAD=secret",
  );
  const first = await generateNode(f.options);
  assert.equal(first.reused, false);
  assert.equal((await generateNode(f.options)).reused, true);
  const caseFile = path.join(f.folder, "tests/cases/example.avora-test.json");
  const scenario = JSON.parse(await fs.readFile(caseFile));
  scenario.inputs = { token: "runtime-secret" };
  scenario.expect = { output: "private-assertion" };
  await fs.writeFile(caseFile, JSON.stringify(scenario));
  assert.equal((await generateNode(f.options)).reused, true);
  assert.equal(f.posts(), 1);
  assert.doesNotMatch(
    JSON.stringify(f.requests),
    /private-secret|production-url|runtime-secret|private-assertion|MUST_NEVER/,
  );
  f.identity({ ...identity, compiler_version: "c".repeat(64) });
  assert.equal((await generateNode(f.options)).reused, false);
  f.identity({ ...identity, account_scope: "d".repeat(64) });
  assert.equal((await generateNode(f.options)).reused, false);
});
test("edited generated files are rebuilt; failed and stale requests preserve the last result", async (t) => {
  const f = await fixture(t);
  const first = await generateNode(f.options);
  await fs.writeFile(first.serviceFile, "tampered");
  const second = await generateNode(f.options);
  assert.equal(second.reused, false);
  const pointer = path.join(f.folder, ".avora/generated/current.json");
  const before = await fs.readFile(pointer, "utf8");
  const template = path.join(f.folder, "templates/fastapi.py.avora");
  await fs.appendFile(template, "\n# first change");
  f.change(() => fs.appendFile(template, "\n# changed during generation"));
  await assert.rejects(generateNode(f.options), /changed during generation/);
  assert.equal(await fs.readFile(pointer, "utf8"), before);
  f.change(null);
  f.fail();
  await assert.rejects(generateNode(f.options), /Generation failed/);
  assert.equal(await fs.readFile(pointer, "utf8"), before);
});
test("rejects traversal, source/output symlinks and concurrent generation", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    readGenerationSnapshot(f.folder, "../secret"),
    /Register/,
  );
  const bad = {
    ...f.options,
    fetch: async (url, init) =>
      Response.json(
        init.body
          ? { ...identity, files: { "../escape.py": "pass" } }
          : identity,
      ),
  };
  await assert.rejects(generateNode(bad), /Unsafe generated/);
  const target = path.join(f.folder, "templates/fastapi.py.avora");
  await fs.rename(target, target + ".real");
  await fs.symlink(target + ".real", target);
  await assert.rejects(generateNode(f.options), /symlink/);
  await fs.unlink(target);
  await fs.rename(target + ".real", target);
  let release;
  f.change(() => new Promise((resolve) => (release = resolve)));
  const running = generateNode(f.options);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
  await assert.rejects(generateNode(f.options), /already running/);
  release();
  await running;
});

test('generated service has one stable real path across changes; legacy hidden cache migrates without recompiling',async t=>{
  const f=await fixture(t);
  const first=await generateNode(f.options);
  assert.equal(first.directory,path.join(await fs.realpath(f.folder),'generated','fastapi'));
  const pointer=path.join(f.folder,'.avora/generated/current.json');
  const old=JSON.parse(await fs.readFile(pointer));
  const release=first.id+'-1234abcd';
  await fs.rename(first.directory,path.join(f.folder,'.avora/generated',release));
  delete old.directory; delete old.publication; old.release=release;
  await fs.writeFile(pointer,JSON.stringify(old));
  const migrated=await generateNode(f.options);
  assert.equal(migrated.serviceFile,first.serviceFile);
  assert.equal(f.posts(),1);
  await fs.appendFile(path.join(f.folder,'templates/fastapi.py.avora'),'\n# edit');
  const changed=await generateNode(f.options);
  assert.equal(changed.serviceFile,first.serviceFile);
  assert.notEqual(changed.id,first.id);
  assert.deepEqual((await fs.readdir(path.join(f.folder,'.avora/generated'))).sort(),['current.json']);
});
test('interrupted publication recovers the last complete app; unowned visible folders are protected',async t=>{
  const {recoverPublication,publishApplication}=require('../dist/generatedWorkspace');
  const f=await fixture(t);
  const first=await generateNode(f.options);
  const pointer=path.join(f.folder,'.avora/generated/current.json');
  const previous=JSON.parse(await fs.readFile(pointer));
  await assert.rejects(publishApplication(f.folder,path.join(f.folder,'missing-stage'),{...previous},previous),/ENOENT/);
  assert.equal(await fs.readFile(first.serviceFile,'utf8'),files['app/services/test.py']);
  const backup='.avora/generated/.backup-11111111-1111-1111-1111-111111111111';
  await fs.rename(first.directory,path.join(f.folder,backup));
  await fs.mkdir(first.directory);
  await fs.writeFile(path.join(first.directory,'partial'),'partial');
  await fs.writeFile(path.join(f.folder,'.avora/generated/publication.json'),JSON.stringify({target:'generated/fastapi',backup,hadTarget:true,previous,publication:'interrupted'}));
  await recoverPublication(f.folder);
  assert.equal(await fs.readFile(first.serviceFile,'utf8'),files['app/services/test.py']);
  await assert.rejects(publishApplication(f.folder,path.join(f.folder,'missing-stage'),{directory:'generated/fastapi'},null),/unrecognized/);
});
test('failed generation maps its snapshot and discards errors if source changes before the response',async t=>{
  const {GenerationDiagnosticError}=require('../dist/sourceDiagnostics');
  const {createHash}=require('node:crypto');
  const f=await fixture(t);let change=false;
  const options={...f.options,fetch:async (url,init)=>{
    if(!init.body) return Response.json(identity);
    const request=JSON.parse(init.body),source=request.code_bundle.fastapi.variants.main.code;
    assert.equal(request.source_map_version,1);
    if(change) await fs.appendFile(path.join(f.folder,'templates/fastapi.py.avora'),'\n# later edit');
    return Response.json({detail:'Syntax error',source_map:{version:1,framework:'fastapi',variantId:'main',templateHash:createHash('sha256').update(source).digest('hex'),files:{}},source_diagnostics:[{message:'invalid syntax',origin:{start:0,end:1,kind:'literal'}}]},{status:400});
  }};
  await assert.rejects(generateNode(options),error=>error instanceof GenerationDiagnosticError && error.diagnostics[0].authored.path==='templates/fastapi.py.avora');
  change=true;
  await assert.rejects(generateNode(options),error=>!(error instanceof GenerationDiagnosticError) && /changed during generation/.test(error.message));
});
