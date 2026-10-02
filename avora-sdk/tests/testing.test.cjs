const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {createLocalProject, parseProjectDocument, patchScenarioSource} = require('../dist');
const {generateNode, currentGeneration} = require('../dist/generation');
const {testNode, checkNode, readNodeTestState, compareNodeResult} = require('../dist/testing');
const environment = require('../dist/environment');
const adapter = require('../dist/fastapiRunner');
const {delay} = require('../dist/localRuntime');
const casePath = 'tests/cases/example.avora-test.json';

async function fixture(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'avora-test-'));
  t.after(() => fs.rm(folder, {recursive:true, force:true}));
  const project = createLocalProject('Test node', 'node-test');
  const scenario = JSON.parse(project.files[casePath]);
  scenario.expect = {output:{message:'Hello'}};
  project.files[casePath] = JSON.stringify(scenario);
  for (const [file, contents] of Object.entries({...project.files,'avora.node.json':JSON.stringify(project.manifest)})) {
    await fs.mkdir(path.dirname(path.join(folder,file)),{recursive:true}); await fs.writeFile(path.join(folder,file),contents);
  }
  const generate = () => generateNode({folder, token:async()=> 'test',fetch:async()=>Response.json({
    compiler_version:'a'.repeat(64),account_scope:'b'.repeat(64),request_path:'/logic-node-template-test',
    files:{'requirements.txt':'fastapi\n','app/main.py':'# generated test app\n'},
  })});
  await generate();
  await fs.writeFile(path.join(folder,'avora.lock'),JSON.stringify({formatVersion:1,profiles:{}}));
  let prepares = 0;
  t.mock.method(environment,'prepareNode',async options => {
    prepares++;
    let generation = await currentGeneration(folder,casePath,options.read);
    if (!generation && options.generate) {await options.generate(options.signal);generation=await currentGeneration(folder,casePath,options.read);}
    if (!generation) throw new Error('Generation needed');
    const prepared={generation,environmentId:'prepared',lockHash:'lock',runtime:{version:'3.11'},interpreter:'test-python',directory:folder,reused:true};
    await fs.writeFile(path.join(folder,'.avora/environment.json'),JSON.stringify(prepared));
    return prepared;
  });
  const run = t.mock.method(adapter,'runFastApi',async()=>({status:201,body:{message:'Hello'}}));
  const update = async changes => {Object.assign(scenario,changes); await fs.writeFile(path.join(folder,casePath),JSON.stringify(scenario));};
  return {folder,scenario,project,generate,run,update,options:{folder,casePath,generate},prepares:()=>prepares};
}

test('one run checks exact JSON expectations, persists a report and reuses the same application for changed expectations',async t=>{
  const f=await fixture(t);
  const first=await testNode(f.options);
  assert.equal(first.status,'passed');assert.equal((await readNodeTestState(f.options)).status,'passed');
  await f.update({expect:{output:{message:'Different'}}});
  assert.equal((await readNodeTestState(f.options)).status,'outdated');
  const failed=await testNode(f.options);
  assert.equal(failed.status,'failed');assert.equal(failed.generationId,first.generationId);
  assert.deepEqual(JSON.parse(JSON.stringify(failed.assertions[1])),{label:'Output',expected:{message:'Different'},actual:{message:'Hello'},passed:false});
  assert.equal(f.run.mock.callCount(),2);
});
test('no expectation cannot pass; HTTP failures cannot be mistaken for untested success',async t=>{
  const f=await fixture(t);await f.update({expect:{}});
  assert.equal((await testNode(f.options)).status,'not_tested');
  f.run.mock.mockImplementation(async()=>({status:500,body:{detail:'broken'}}));
  assert.equal((await testNode(f.options)).status,'failed');
  await f.update({expect:{error:{status:500,body:{detail:'broken'}}}});
  assert.equal((await testNode(f.options)).status,'passed');
});
test('comparisons preserve JSON types, array order and null; object ordering is irrelevant',()=>{
  assert.ok(compareNodeResult({output:{b:null,a:[1,false]}},{status:200,body:{a:[1,false],b:null}}).every(x=>x.passed));
  assert.equal(compareNodeResult({output:1},{status:200,body:'1'})[1].passed,false);
  assert.equal(compareNodeResult({output:[1,2]},{status:200,body:[2,1]})[1].passed,false);
});
test('startup failure and cancellation return structured outcomes; the runner never leaves a success',async t=>{
  const f=await fixture(t);
  f.run.mock.mockImplementation(async options=>{options.phase('start');throw new Error('Import failed');});
  const fail=await testNode(f.options);assert.equal(fail.status,'failed');assert.equal(fail.phase,'start');
  const abort=new AbortController();
  f.run.mock.mockImplementation(async options=>{abort.abort();options.signal.throwIfAborted();});
  const cancelled=await testNode({...f.options,signal:abort.signal});
  assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.status,'not_tested');
});
test('source/configuration edits and malformed case JSON invalidate success',async t=>{
  const f=await fixture(t);await testNode(f.options);
  await f.update({configuration:{...f.scenario.configuration,lineValues:{message:'Changed'}}});
  assert.equal((await readNodeTestState(f.options)).status,'outdated');
  await testNode(f.options);
  await fs.writeFile(path.join(f.folder,casePath),'{');
  assert.equal((await readNodeTestState(f.options)).status,'outdated');
});
test('edits during execution cannot publish a passing result for the new source',async t=>{
  const f=await fixture(t);
  f.run.mock.mockImplementation(async()=>{await f.update({inputs:{newValue:2}});return {status:201,body:{message:'Hello'}};});
  assert.equal((await testNode(f.options)).status,'outdated');
});
test('runtime settings stay local; protected database/process variables are excluded and effective changes invalidate reports',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.folder,'.env.local'),'API_KEY=private-value\nDATABASE_URL=postgresql://live\nPYTHONPATH=/outside\n');
  f.run.mock.mockImplementation(async options=>{assert.deepEqual(options.environment,{API_KEY:'private-value'});return {status:201,body:{message:'Hello'}};});
  await testNode(f.options);
  await fs.writeFile(path.join(f.folder,'.env.local'),'API_KEY=changed\n');
  assert.equal((await readNodeTestState(f.options)).status,'outdated');
});
test('generation waits until execution releases its application lease',async t=>{
  const f=await fixture(t);let unblock,started;
  const running=new Promise(resolve=>{started=resolve;});
  f.run.mock.mockImplementation(async()=>{started();await new Promise(resolve=>{unblock=resolve;});return {status:201,body:{message:'Hello'}};});
  const testPromise=testNode(f.options);await running;
  let generated=false;const next=f.generate().then(()=>{generated=true;});
  await delay(100);assert.equal(generated,false);
  unblock();assert.equal((await testPromise).status,'passed');await next;assert.equal(generated,true);
});
test('check is offline and rejects unsupported scope and invalid expectation shapes before execution',async t=>{
  const f=await fixture(t);
  assert.equal((await checkNode(f.options)).status,'valid');assert.equal(f.prepares(),0);assert.equal(f.run.mock.callCount(),0);
  for(const expect of [{output:1,error:{status:500}},{error:{status:200}},{error:'oops'}]) {
    assert.ok(parseProjectDocument(JSON.stringify({...f.scenario,expect}),'scenario').diagnostics.length);
  }
  const context=JSON.parse(f.project.files['tests/context/workspace.json']);context.graph.nodes=[{id:'db',type:'entityNode'}];
  await fs.writeFile(path.join(f.folder,'tests/context/workspace.json'),JSON.stringify(context));
  assert.equal((await checkNode(f.options)).status,'invalid');assert.equal((await testNode(f.options)).status,'failed');assert.equal(f.prepares(),0);
});
test('visual expectation edits preserve source metadata and case identity',async t=>{
  const f=await fixture(t);const source=JSON.stringify({...f.scenario,extensionData:{keep:true}},null,2);
  const edited=JSON.parse(patchScenarioSource(source,{expect:{output:null}},f.project.manifest));
  assert.equal(edited.id,f.scenario.id);assert.deepEqual(edited.extensionData,{keep:true});assert.deepEqual(edited.expect,{output:null});
});
test('structured runtime failures survive JSON reports; edits discard them and environment secrets stay redacted',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.folder,'.env.local'),'API_KEY=private-token\n');
  f.run.mock.mockImplementation(async()=>({status:500,body:{detail:'failed'},failure:{message:'RuntimeError: private-token',frames:[{path:'app/main.py',line:1,column:0}]}}));
  const report=await testNode(f.options);
  assert.equal(report.status,'failed');assert.equal(report.diagnostics[0].authored,undefined);
  assert.equal(report.diagnostics[0].generated.path,'app/main.py');assert.equal(report.diagnostics[0].message,'RuntimeError: [redacted]');
  assert.deepEqual((await readNodeTestState(f.options)).report.diagnostics,report.diagnostics);
  f.run.mock.mockImplementation(async()=>{await f.update({inputs:{changed:true}});throw new adapter.RuntimeDiagnosticError({message:'late error',frames:[{path:'app/main.py',line:1}]});});
  const stale=await testNode(f.options);assert.equal(stale.status,'outdated');assert.equal(stale.diagnostics,undefined);
});
