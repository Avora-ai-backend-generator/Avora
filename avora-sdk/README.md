# @avora/node-sdk

Independent TypeScript/JavaScript SDK for Avora custom-node authoring. This directory is a separately versioned npm package; it does not import the frontend, backend, or VS Code. Source and installable package archives are distributed through the public Avora GitHub repository and its releases.

```sh
npm ci
npm test
npm pack --dry-run
```

The SDK preserves Avora's existing `node_config`, `code_bundle`, and HLV1 tags. It does not replace the production generator.

## Local projects (format 3)

```js
const { createLocalProject, parseProjectDocument, assembleDraft } = require('@avora/node-sdk');
const project = createLocalProject('My node', 'a-stable-project-id');
// The caller writes manifest as avora.node.json, and each entry in files.
// No account, draft ID, API call or interpreter is needed to create the project.
const diagnostics = parseProjectDocument(JSON.stringify(project.manifest), 'manifest').diagnostics;
const payload = assembleDraft(project.manifest, project.files);
```

Format 3 adds mapped dependency source files; formats 1 and 2 remain readable. Format 2 added `projectId` and `artifacts` (scenario/context file mappings). `draftId` and `revision` are optional together for an unlinked local project. Existing format 1 linked projects continue to work without rewriting their IDs. `upgradeManifest` offers an explicit, non-mutating migration.

```text
avora.node.json
templates/fastapi.py.avora
dependencies/fastapi/requirements.txt
generated/fastapi/  # real generated app, disposable
tests/cases/example.avora-test.json
tests/context/workspace.json
```

Structure defaults live in the manifest. Configured values and runtime inputs live in the scenario. The local Try node view edits these files; explicit `testNode` runs them through the prepared local application.

`configuration.lineValues` stores string values or string lists used by the existing node renderer. Runtime `inputs` retains JSON types. The configuration may also contain instance ports, optional/repeated-line state and error handling. Derived preview ports do not dirty a case just by opening it.

`patchScenarioSource(source, changes, manifest)` edits owned case properties while preserving source formatting, identity, assertions and unrelated metadata. It rejects invalid source and invalid references. Callers must additionally guard the document version and context version before applying a patch. `scenarioFieldDiagnostics` maps renderer findings into the case's configured field values.

Type-only consumers can import `NodeScenario`, `WorkspaceContext` and `ScenarioChanges` from `@avora/node-sdk/types/scenario`. These committed declarations are included in the standalone package and do not require prebuilt SDK runtime files for a frontend build.

`projectSchemas` is the shared JSON Schema source. `parseProjectDocument` reports strict JSON, schema and structural-reference errors with source ranges. Passing the manifest as its third argument also checks a scenario's variant, framework and context references. These checks are not a full simulation of conditional node behavior.

On draft exchange, artifact documents are carried under `payload.authoring = {formatVersion: 1, projectId, files}`. Materialization extracts those documents back into files. Other authoring/payload metadata is retained. File paths are restricted to the declared template and test-context locations; credentials and `.env.local` are not artifacts.

`NodeRunIdentity` reserves source, scenario, context, compiler, dependency and runtime-profile identity. Its private configuration fingerprint is local-only; `testNode` now fills these fields in its shared local report.

## Existing linked projects (format 1)

```text
avora.node.json              # formatVersion, draftId, revision, structure, dependencies and file mappings
 templates/fastapi.py.avora  # editable Python + HLV1 sections/field markers
 templates/nestjs.ts.avora   # editable TypeScript + HLV1 markers, when present
```

`materializeDraft(draft)` produces a manifest and editable files. `assembleDraft(manifest, files)` restores the exact API payload. Variants sharing code share one source file; older variants with distinct code receive separate files. Metadata, dependencies, imports, and unrelated payload properties are retained. Never edit `draftId`, `revision`, or the extension's `syncedHash` by hand.

```js
const { materializeDraft, assembleDraft, validateTemplate, getTagCatalog, NodeDraftClient } = require('@avora/node-sdk');
const client = new NodeDraftClient(apiUrl, async () => accessToken);
const draft = await client.get(draftId);
const {manifest, files} = materializeDraft(draft);
const file = manifest.templates[0];
const tags = getTagCatalog(manifest.payload.node_config);
const issues = validateTemplate(files[file.path], manifest.payload.node_config, file.variantIds);
// An agent can edit files and fix reported issues before saving a private revision.
const updated = await client.update(draftId, draft.revision, assembleDraft(manifest, files));
```

`validateTemplate` reports malformed, unbalanced, unknown, and missing variant tags using source offsets. Unknown tags are warnings because runtime-generated fields can depend on workspace data. `projectPython` creates a temporary syntax-only projection with field placeholders and an async action-body wrapper; `projectedOffset` maps compiler errors back to the template. **A successful syntax check does not validate types, installed packages, conditional expansion, or execution.** Defaults and runtime inputs are not guessed.

The framework registry currently identifies FastAPI/Python, Django/Python, NestJS/TypeScript, and Spring/Java. Syntax checking is implemented for Python only. Future language adapters can add their own projections/checkers while sharing the manifest, tag contract, and draft API. Framework-specific execution stays with Avora's existing generators.

## Agent workflow

1. Fetch or create a private draft with `NodeDraftClient`.
2. Materialize its files; read `avora.node.json` and `getTagCatalog` for valid IDs.
3. Edit the template source, preserving HLV1 sections. Edit `dependencies/fastapi/requirements.txt` when needed.
4. Validate and save with the expected revision. On `DraftConflictError`, reconcile against the newer draft or create a separate draft; never silently retry with a newer revision.

No credentials belong in the manifest. Publication stays in Avora. Local generation, dependency preparation, runtime tests, and editor language projections are described below.

## Generate a local case (Node.js)

```js
const { generateNode } = require('@avora/node-sdk/dist/generation');
const result = await generateNode({
  folder: '/absolute/path/to/my-node',
  casePath: 'tests/cases/example.avora-test.json',
  token: async () => accessToken,
});
console.log(result.serviceFile, result.reused);
```

This Node-only submodule keeps the browser entry point free of filesystem dependencies. It adapts authored files to the existing authenticated `/generator/logic-node-preview` API. The production compiler and internal templates remain on Avora's server. Generation neither syncs a draft nor publishes a node.

The API receives the structure, authored template/dependencies, configured case and scratch schema. Runtime `inputs`, assertions, unrelated authoring metadata and `.env.local` stay local. Context environment **names** are sent with empty values; saved workspace database URLs are never inherited. A scratch context currently accepts entity/enum schemas for FastAPI; a complete LogicFlow context comes later. Local execution supports pure nodes first.

Each explicit Generate checks the authenticated compiler version. Matching source, API/account scope and compiler identity reuse an intact local application. Template/configuration/context changes invalidate it; runtime input changes do not. Files are staged under `.avora/generated/` and published to one stable `generated/fastapi/` application folder. `current.json` identifies the completed source and its case. A publication journal and temporary backup support rollback/recovery around the directory swap. Failed, cancelled or stale requests keep the previous application. Existing hidden snapshots migrate on the next Generate, reusing an intact matching cache; historical copies are then removed. Unrecognized user-owned output folders are never replaced. Generated files are disposable: edits invalidate reuse. Runtime environments stay under `.avora/environments/`.

`readGenerationSnapshot` accepts an optional source reader so an editor can include unsaved native buffers. Clients must not execute a cached application without comparing its identity to current source. Source paths and returned paths cannot traverse folders or follow symlinks. One generation runs per project; an exclusive `.avora/generate.lock` also coordinates separate processes. After a process crash, remove that lock only after confirming no generation is running. Requests time out after 60 seconds. Server limits are 4 MB per request, 100 repeated rows and 16 MB of generated files; repeated template expansion has a separate conservative size bound.

The server syntax-checks emitted Python without importing or executing it. Successful generation does not prove installed dependencies, correct types or behavior.

## Prepare dependencies locally (Node.js)

```js
const { prepareNode } = require('@avora/node-sdk/dist/environment');
const { generateNode } = require('@avora/node-sdk/dist/generation');
const folder = '/absolute/path/to/my-node';
const casePath = 'tests/cases/example.avora-test.json';
const prepared = await prepareNode({
  folder, casePath, python: '3.11',
  generate: signal => generateNode({ folder, casePath, signal, token: async () => accessToken }),
  progress: message => console.error(message),
  // signal: an AbortSignal, read: optional editor buffer reader
});
console.log(prepared.interpreter, prepared.reused, prepared.workspaceFile);
```

`currentGeneration` verifies the selected generated snapshot locally. Prepare invokes the optional `generate` callback only when that snapshot is missing, changed or stale; otherwise no login or API call is needed. Without the callback it throws `GenerationRequiredError`. Runtime input changes do not invalidate source or installed dependencies.

Prepare reuses the open-source **uv** tool, as Avora's server runtime does. On first use it downloads a pinned official uv wheel, verifies its recorded SHA-256, extracts only the executable and licenses, and prepares managed CPython 3.11. An absolute CPython 3.10+ interpreter path or another Python version can be supplied. Supported tool distributions cover macOS, Linux and Windows on x64/arm64. Actual installation has been exercised on macOS arm64; Windows/Linux need release-platform checks.

- `avora.lock`: commit this portable JSON file. Separate runtime/platform/dependency profiles contain exact versions and wheel hashes. Existing matching locks are retained. To deliberately refresh versions, remove the affected profile and Prepare again.
- `.avora/environments/`: disposable local virtual environments. Identity includes runtime version, platform, architecture, ABI, lock and interpreter location. A readiness marker is written after install and `uv pip check`; reuse also checks the package inventory. Virtual environments are built at their final paths, preserving executable entry points.
- `.avora/environment.json`: atomically selects a checked environment for the generated case. Failed/cancelled installs and stale source preserve the previous selection; partial installs are removed. Concurrent processes coordinate through a heartbeat lock, with recovery after a stale lock expires.
- `.avora/generated-python.code-workspace`: opens the node project, including its generated application, with its actual Python interpreter and Python/Pylance recommendations. The VS Code adapter can use this prepared interpreter for mapped template completion.
- `~/.avora/node-runtime`: shared uv, managed Python and download caches. `toolRoot` can override this location for SDK hosts/tests.

First preparation or changed dependencies can require network access. Warm Prepare checks and reuses installed resources offline. Dependency tools ignore project `.env`, shell Python paths and pip/uv index configuration. This increment supports named **PyPI wheel packages**; local/URL dependencies, custom indexes and source builds are rejected with a recoverable error. Installation errors appear through the caller; an `AbortSignal` cancels waiting/download/install work and terminates child processes.

Completed environments remain available to open Python workspaces. Automatic eviction with active-runtime protection is reserved for execution/cache lifecycle work; close consumers before manually removing old environment folders. Prepare does not start the application, create a database or execute a test.

## Dependency Source / Table contract

`dependencies/fastapi/requirements.txt` is the authoritative declaration file for format 3 projects. `dependencyFiles` maps that path in `avora.node.json`; the equivalent embedded `payload.code_bundle.fastapi.dependencies` is removed. The SDK reconstructs those API fields during generation/sync. A duplicate editable list is an error.

`parseDependencies`, `patchDependencies` and `dependenciesToDeclarations` are public, browser-safe adapters. Supported entries are named PyPI requirements, extras, version constraints and optional environment markers; the server remains the final PEP 508 validator. Unsupported options, includes, URLs or multiline entries stay in Source, produce diagnostics and block generation; table edits never discard them. Comments, line endings and untouched text survive supported row edits.

`migrateDependencyFiles(manifest)` returns the migrated manifest plus files to write. Write new files before publishing the manifest. It preserves project/draft identity, revisions and unknown metadata; repeated migration is a no-op. New `createLocalProject` projects use format 3. Old SDKs should reject that format instead of omitting dependencies.

Existing dependency IDs, import statements and unknown metadata are retained in valid requirements comments. For a package whose import differs from its name, an agent can declare the mapping explicitly:

```text
PyYAML==6.0.2  # avora: {"fields":{"id":"yaml","importLine":"import yaml"}}
```

Python imports in template code remain ordinary imports. Table edits preserve these mapping comments. Draft exchange carries the source text under `authoring.dependencyFiles`, including comments; generation sends only assembled declarations. If a remote client changes the declarations without updating that saved source, materialization reports the mismatch instead of silently discarding either version.


## Run a saved case (Node.js)

```ts
import { testNode, checkNode, readNodeTestState } from "@avora/node-sdk/dist/testing";
const report = await testNode({ folder, casePath, generate, signal, progress });
```

`testNode` coordinates current generation, prepared dependencies, a disposable local FastAPI process, readiness, a JSON request and assertions. The existing API callback is used only if generation is missing/outdated. `checkNode` checks source schemas/tags/references and execution scope without running code. Neither local validation nor a successful generation certifies behavior.

- Cases use `expect.output` for an exact JSON response body, or `expect.error: {status, body?}` for an intended HTTP error. Object key order is ignored; types and array order matter. Empty expectations allow inspection but never report Passed.
- Reports use `passed`, `failed`, `not_tested`, `outdated`, with a separate execution phase (including cancellation), actual output and expected/actual assertions. Type-only clients import `types/run`. One latest report per case is stored under `.avora/reports/`.
- `readNodeTestState` compares the source/case, compiler selection, dependency lock, selected environment and effective local runtime configuration. It performs no execution/install/generation. Editing source while a run is active cannot validate the new source.
- The test adapter binds a random loopback port, verifies its readiness revision and stops the process tree on completion/cancellation. A parent-liveness pipe prevents the server remaining alive after a CLI/extension-host crash. Startup and request deadlines default to 30 seconds each.
- Execution holds the same application lease as generation, protecting stable output against replacement during a run. Per-project test runs serialize across CLI/windows. Ready environments remain reusable; automatic environment eviction is still deferred while editor consumers can reference them.
- SQLite, logs and temporary runtime files live under `.avora/runs/`, outside generated code. Completed runs remove their scratch directory; abrupt host crashes may leave an ignored scratch directory. Python bytecode is disabled for the generated application.
- Optional `.env.local` application variables are local only. Database/process-control overrides are ignored; the runtime sets a new SQLite path for each run. Shell secrets and exported workspace environment values are never inherited. Fingerprints remain local. Generated code runs with the user's permissions; this is not an OS sandbox.

First runtime: pure FastAPI nodes with empty/enum-only scratch context. Database fixtures, LogicFlows, persistent server sessions and automatic case-matrix generation are later steps. Standard input values use the generated request schema's keys. Run the optional real adapter tests with `AVORA_TEST_PYTHON=/absolute/prepared/python npm test`.

## Generate starter cases — 0.8

```js
const {planNodeCases, applyNodeCasePlan} = require('@avora/node-sdk/dist/caseGeneration');
const plan = await planNodeCases({folder, budget:24, contextPath:'tests/context/workspace.json'});
// Review plan.entries: add, update, unchanged, review, obsolete (kept).
const result = await applyNodeCasePlan(plan);
```

This local operation needs no API, Python or compiler. FastAPI mappings receive a baseline plus targeted static options, conditional-field witnesses, optional rows and repeat counts 1/2 (within each line's maximum). The default budget is 24; the hard limit is 100. Baselines are allocated first, with remaining cases shared between variants. Complex or incompatible combinations are skipped; this is representative coverage, not an exhaustive matrix. Other execution frameworks are reported as unsupported until their adapters exist.

Cases live in `tests/cases/<variant-id>/`; unsafe/long variant IDs use a stable sanitized folder. Existing flat cases remain valid. Each file holds a complete configuration and typed runtime inputs. Production generation still resolves the actual ports on the server: starter cases do not override them with a copied port list. The public UI rules are shared with the sampler (`src/structure*.ts` for browser bundlers, `dist/structure*.js` for Node). No private generator implementation is included.

Optional `caseFixtures` in the selected context provides samples without a database:

```json
{"caseFixtures":{"fields":{"entity":"Customer"},"inputs":{"customer":{"id":7}},"types":{"Customer":{"id":7}}}}
```

`fields` supplies string/string-array configuration selections; `inputs` supplies JSON by input key; `types` supplies JSON by type name. Input-specific fixtures take priority. Known primitives, arrays and context enums receive typed samples; unresolved entities/dynamic types are marked for review. Generic entity rows and workspace-dependent selections need supplied context/manual review. This does not add database execution support.

Generated files carry `generatedCase` identity. Prior generated baselines stay hidden in `.avora/cases/`. Regeneration merges independent changes while preserving user inputs, expectations and unknown metadata. Conflicting edits are proposed for review and not written. Never copy generation identity into a new manual case. Removed/out-of-budget cases are kept; remove obsolete registrations manually after review. If hidden baselines are lost, pristine cases can regenerate; edited cases require review.

Apply checks the preview's source snapshot, takes a project lock and journals its writes. Failed/interrupted applies recover without overwriting later external edits. The UI additionally guards unsaved buffers. Generated cases have no `expect`; they remain Not tested until run with an independently chosen expectation. Existing reports become Outdated through the same Step 5 source/case fingerprints.

## Authored-source diagnostics — 0.9

The generation request opts into `source_map_version: 1`. The existing private backend returns only positions in the supplied template and emitted Python files. It does not return compiler code, private template paths or Jinja assets. `GenerationResult.sourceMap` is optional for older servers; invalid or foreign maps are rejected. Failed generation can throw `GenerationDiagnosticError` with mapped `diagnostics` and the source snapshot identity.

`testNode` reports may include `diagnostics: SourceDiagnostic[]`. Each diagnostic keeps `casePath`, `message`, `code`, optional `authored`, `generated` and related generated frames:

- `authored`: relative template `path`, raw UTF-8 SHA-256 `hash`, zero-based UTF-16 `start`/`end`, `kind` (`literal`, `field`, `section`), optional `sectionId` and zero-based `repeatIndex`.
- `generated`: relative application `path`, one-based `line`, optional zero-based UTF-16 `column` and raw file `hash`.
- Literal columns are mapped exactly. Expanded values map to the entire field tag. A missing/external column on an owned line falls back to its enclosing section. Unowned wrapper lines never acquire invented source positions.

The local Python adapter captures generated-file frames for startup/runtime exceptions, without locals or external library paths. Public reports redact configured secret values in diagnostic messages. Failed runs become Outdated when their source changes; obsolete diagnostics are removed. Consumers must verify current content hashes and selected-case/run identity before displaying locations. Syntax/generation errors never execute the template on the backend.

## Local editor projections — 0.10

`readLanguageContext` loads a verified generated service, source map and prepared interpreter. Preparation retains the user-authored baseline, selected case, context fingerprint and Python selector in `.avora/environment.json`; no new everyday files are added. Context excludes literal template text but includes structure, configuration, dependencies and scratch schemas. Changed code can be projected locally; changed context, modified generated files or invalid environment/lock metadata require preparation again.

`projectLanguage(currentSource, baselineSource, generatedCode, sourceMap, file)` creates an in-memory editor overlay. It only replaces literal regions whose tag boundaries and indentation correspondence are provable. Fields/conditions/repeats are never compiled by this module; their server-generated expansion is retained. All repeated literal copies receive the same edit. The projection maps completion/hover/diagnostic ranges back to authored UTF-16 offsets, rejecting fields, wrappers and ranges crossing generated gaps. A changed tag or unmapped source region invalidates the overlay. These overlays are never saved as generated applications or used for tests.

The VS Code adapter owns the persistent Pyright process and native providers. The SDK remains independently publishable and contains no proprietary compiler, Jinja assets or bundled language server.

## Node appearance — 0.12

Node logos use manifest format 4. Formats 1–3 remain readable, and new projects without logos continue to use format 3. PNG and static, self-contained SVG imports become bounded PNG files under `assets/`; a default logo and optional dark-theme variant travel through draft exchange and materialize back to mapped files.

```js
const { addNodeLogo } = require('@avora/node-sdk/dist/logoNode');
await addNodeLogo('/absolute/path/to/my-node', '/absolute/path/to/logo.svg');
await addNodeLogo('/absolute/path/to/my-node', '/absolute/path/to/logo-dark.png', 'dark');
```

`appearanceIssues`, `hydrateAppearance`, `logoAssets`, `accentHex`, and `dominantColor` are browser-safe root exports. `dist/logoImport` provides the import/PNG adapter; browser hosts supply the SVG renderer. `dist/logoNode` reads local files and uses the packaged resvg WebAssembly renderer. Logo-derived color ignores transparent padding. Manual colors are preserved when replacing logos. Generation excludes branding data, so an appearance-only change does not invalidate executable generation or tests.

See the [appearance guide](../docs/developer-tools/custom-node-appearance.md) for CLI and extension actions.

## Native browser connection

```js
const { browserLogin, refreshNativeSession, revokeNativeSession } =
  require('@avora/node-sdk/dist/browserAuth');
const session = await browserLogin({
  apiBaseUrl: 'https://your-avora-api.example.com',
  clientName: 'My Avora Tool',
  openBrowser: async url => { /* open this authorization URL in your browser */ },
});
const renewed = await refreshNativeSession(session);
await revokeNativeSession(renewed);
```

The native adapter performs browser authorization with PKCE and validates the callback state, issuer, and resource. A caller supplies browser opening and secure storage, and must serialize session renewal/writes when sharing a stored session. `withNativeSessionLock` provides coordination. Sessions are bound to the approved server. CLI tokens use the system keyring; the VS Code adapter uses SecretStorage. Keep tokens out of manifests, source files, and logs.

## Public distribution

Source, tests, TypeScript declarations, and Markdown guides are published in the [public Avora repository](https://github.com/Avora-ai-backend-generator/Avora). Build with Node.js 22+ using `npm ci && npm run build`, then `npm pack` to produce a portable installation archive. Versioned archives are available in [GitHub Releases](https://github.com/Avora-ai-backend-generator/Avora/releases). An npm registry release is separate.

The full [SDK guide](../docs/developer-tools/sdk.md) and [documentation index](../docs.md) cover installation and supported workflows.
