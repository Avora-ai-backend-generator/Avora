const { test } = require('node:test');
const assert = require('node:assert/strict');
const sdk = require('../dist');

test('local projects need no account and round-trip scenario/context/unknown metadata', () => {
  const project = sdk.createLocalProject('My node', 'local-123');
  assert.equal(project.manifest.draftId, undefined);
  assert.equal(project.manifest.revision, undefined);
  assert.deepEqual(sdk.manifestIssues(project.manifest), []);
  project.manifest.payload.futureMetadata = { retain: ['all', 'values'] };
  const casePath = 'tests/cases/example.avora-test.json';
  const scenario = JSON.parse(project.files[casePath]);
  scenario.configuration.lineValues.message = 'Try value';
  scenario.futureAssertion = { custom: true };
  project.files[casePath] = JSON.stringify(scenario);
  const payload = sdk.assembleDraft(project.manifest, project.files);
  assert.equal(payload.node_config.variants[0].lines[0].fields[0].defaultValue, 'Hello');
  const restored = sdk.materializeDraft({ draft_id: 'a'.repeat(32), revision: 8, payload });
  assert.equal(restored.manifest.formatVersion, 3);
  assert.equal(restored.manifest.projectId, 'local-123');
  assert.deepEqual(sdk.assembleDraft(restored.manifest, restored.files), payload);
  assert.deepEqual(JSON.parse(restored.files[casePath]).futureAssertion, { custom: true });
});

test('v1 migration retains stable IDs and reconstructs the original wire payload', () => {
  const payload = { node_config: { variants: [{ id: 'old-id' }] }, code_bundle: { fastapi: { variants: { 'old-id': { code: 'pass' } } } }, opaque: { untouched: true } };
  const project = sdk.materializeDraft({ draft_id: 'b'.repeat(32), revision: 3, payload });
  const copy = structuredClone(project.manifest);
  const migrated = sdk.upgradeManifest(project.manifest);
  assert.deepEqual(project.manifest, copy);
  assert.equal(migrated.projectId, 'b'.repeat(32));
  assert.equal(migrated.revision, 3);
  assert.deepEqual(sdk.assembleDraft(migrated, project.files), payload);
});

test('JSON syntax, source ranges, structure references and unsupported versions are diagnosed', () => {
  const project = sdk.createLocalProject('Validation', 'example');
  const manifest = project.manifest;
  manifest.payload.node_config.variants[0].lines[0].fields[0].defaultValueFieldId = 'missing-field';
  const source = JSON.stringify(manifest, null, 2);
  const issue = sdk.parseProjectDocument(source, 'manifest').diagnostics.find(i => i.code === 'reference.missing');
  assert.ok(issue);
  assert.equal(source.slice(issue.start, issue.end), '"missing-field"');
  assert.equal(sdk.parseProjectDocument('{"formatVersion":', 'manifest').value, undefined);
  manifest.formatVersion = 99;
  assert.ok(sdk.manifestIssues(manifest).some(i => i.code === 'schema.enum'));
  manifest.formatVersion = 2;
  manifest.templates[0].path = '../private.py.avora';
  assert.ok(sdk.manifestIssues(manifest).some(i => i.code === 'schema.pattern'));
});

test('scenario references identify the exact broken variant and context values', () => {
  const project = sdk.createLocalProject('Validation', 'example');
  const scenario = JSON.parse(project.files['tests/cases/example.avora-test.json']);
  assert.deepEqual(sdk.parseProjectDocument(JSON.stringify(scenario), 'scenario', project.manifest).diagnostics, []);
  scenario.variantId = 'deleted';
  scenario.context = 'tests/context/missing.json';
  const source = JSON.stringify(scenario);
  const issues = sdk.parseProjectDocument(source, 'scenario', project.manifest).diagnostics;
  assert.equal(issues.length, 2);
  assert.ok(issues.some(i => source.slice(i.start, i.end) === '"deleted"'));
  assert.ok(issues.some(i => source.slice(i.start, i.end) === '"tests/context/missing.json"'));
});

test('source artifact traversal, duplicate paths and missing files are rejected', () => {
  const project = sdk.createLocalProject('Validation', 'example');
  for (const path of ['../.env', 'tests/context/../../secret.json', 'tests/context/.env.local', '/tmp/test.json']) assert.equal(sdk.safeArtifactPath(path), false);
  const duplicate = structuredClone(project.manifest);
  duplicate.artifacts.push(duplicate.artifacts[0]);
  assert.throws(() => sdk.assembleDraft(duplicate, project.files));
  delete project.files[project.manifest.artifacts[0].path];
  assert.throws(() => sdk.assembleDraft(project.manifest, project.files));
});

test('visual case patches preserve identity, assertions, metadata and reusable defaults', () => {
  const project = sdk.createLocalProject('Patch', 'patch');
  const scenario = JSON.parse(project.files['tests/cases/example.avora-test.json']);
  scenario.expect = { output: { ok: true } };
  scenario.extra = { unchanged: [1, 2] };
  scenario.configuration.extra = 'keep';
  const source = JSON.stringify(scenario, null, '\t') + '\n';
  const patched = sdk.patchScenarioSource(source, {
    configuration: { ...scenario.configuration, lineValues: { message: 'Case override' } },
    inputs: { enabled: true, count: 3, payload: { ids: [1, 2] } },
  }, project.manifest);
  const next = JSON.parse(patched);
  assert.equal(next.id, scenario.id);
  assert.deepEqual(next.expect, scenario.expect);
  assert.deepEqual(next.extra, scenario.extra);
  assert.equal(next.configuration.extra, 'keep');
  assert.ok(patched.includes('\n\t"formatVersion"'));
  assert.equal(project.manifest.payload.node_config.variants[0].lines[0].fields[0].defaultValue, 'Hello');
  assert.throws(() => sdk.patchScenarioSource(source, { id: 'overwrite' }, project.manifest), /Invalid case/);
  assert.throws(() => sdk.patchScenarioSource('{', { inputs: {} }, project.manifest), /Fix the case/);
  assert.throws(() => sdk.patchScenarioSource(source, { configuration: { lineValues: { message: {} } } }, project.manifest));
  const diagnostics = sdk.scenarioFieldDiagnostics(patched, [{ fieldId: 'message', message: 'Invalid field', level: 'error' }]);
  assert.equal(patched.slice(diagnostics[0].start, diagnostics[0].end), '"Case override"');
});

test('cases need a template for their selected variant and framework together', () => {
  const project = sdk.createLocalProject('Variants', 'variants');
  project.manifest.payload.node_config.variants.push({ id: 'other', lines: [] });
  const scenario = JSON.parse(project.files['tests/cases/example.avora-test.json']);
  scenario.variantId = 'other';
  const issues = sdk.parseProjectDocument(JSON.stringify(scenario), 'scenario', project.manifest).diagnostics;
  assert.ok(issues.some(issue => issue.message.includes('No fastapi template')));
});
