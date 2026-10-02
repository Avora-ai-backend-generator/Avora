# Avora Node SDK

`@avora/node-sdk` is the TypeScript and JavaScript package behind Avora's local custom node tools. Use it to create node projects, validate their structure and tagged templates, exchange private drafts, and coordinate generation and local tests from your own tools.

The SDK is MIT licensed and available in the [public Avora repository](https://github.com/Avora-ai-backend-generator/Avora/tree/main/avora-sdk). It runs independently of VS Code and the Avora web app. Backend generation uses your authenticated Avora server.

## Install from GitHub

Use Node.js 22 or later. Clone the public repository and build the SDK:

```bash
git clone https://github.com/Avora-ai-backend-generator/Avora.git
cd Avora/avora-sdk
npm ci
npm run build
npm pack
```

Install the resulting `avora-node-sdk-<version>.tgz` in your JavaScript or TypeScript project with `npm install /absolute/path/to/avora-node-sdk-<version>.tgz`. Versioned package archives are also available from [GitHub Releases](https://github.com/Avora-ai-backend-generator/Avora/releases). GitHub is the distribution channel documented here; an npm registry release is separate.

## Create a local project

```js
const { randomUUID } = require('node:crypto');
const {
  createLocalProject,
  parseProjectDocument,
  assembleDraft,
} = require('@avora/node-sdk');

const { manifest, files } = createLocalProject('Scale Number', randomUUID());
const result = parseProjectDocument(JSON.stringify(manifest), 'manifest');
console.log(result.diagnostics);
// Write manifest to avora.node.json and each entry in files to its mapped path.
const payload = assembleDraft(manifest, files);
```

Creating and checking a project needs no account. The scaffold contains placeholder code; implement its behavior and add independent expected results before treating it as a working node. In the terminal, [Avora CLI node commands](../cli-node-authoring.md) write these files for you.

## Files and manifest versions

| File | Purpose |
| --- | --- |
| `avora.node.json` | Identity, node structure, variants, template and artifact mappings |
| `templates/*.avora` | Editable source containing Avora HLV1 tags |
| `dependencies/fastapi/requirements.txt` | Authoritative Python dependency declarations |
| `tests/cases/*.avora-test.json` | Configuration, runtime inputs, and expectations |
| `tests/context/workspace.json` | Scratch entities and enums used by generation |
| `assets/*.png` | Portable node logos, when present |
| `avora.lock` | Portable dependency lock; commit with authored files |
| `generated/fastapi/` and `.avora/` | Disposable generated application and local runtime state |

New scaffolds use format 3 with mapped dependency files. Adding a logo upgrades the manifest to format 4. Formats 1–3 remain readable. Format 2 introduced local project identity and scenario/context mappings. Keep `projectId`, linked `draftId`, and `revision` stable; use the SDK's migration helpers for older manifests.

Keep `.env.local` and `.avora/` out of version control. Logo assets and authored dependency files belong with the node's source.

## Choose the right entry point

| Import | APIs and use |
| --- | --- |
| `@avora/node-sdk` | `createLocalProject`, `parseProjectDocument`, `projectSchemas`, `getTagCatalog`, `validateTemplate`, `materializeDraft`, `assembleDraft`, `NodeDraftClient`; no Node filesystem imports |
| `@avora/node-sdk/dist/generation` | `generateNode`: authenticated generation of a selected local case |
| `@avora/node-sdk/dist/environment` | `prepareNode`: managed Python and locked dependencies |
| `@avora/node-sdk/dist/testing` | `checkNode`, `testNode`, `readNodeTestState`: validation, execution, reports |
| `@avora/node-sdk/dist/caseGeneration` | `planNodeCases`, `applyNodeCasePlan`: review and apply bounded starter cases |
| `@avora/node-sdk/dist/logoNode` | `addNodeLogo`, `prepareLogoUpdate`, `readAppearance`: Node.js logo import |
| `@avora/node-sdk/dist/browserAuth` | `browserLogin`, `refreshNativeSession`, `revokeNativeSession`: browser account connection |
| `@avora/node-sdk/types/scenario` and `types/run` | Type declarations for cases, context, and test reports |

The root entry point supports browser tooling. Generation, environment, testing, logo-file import, and browser login submodules use Node.js. Browser logo rendering requires the caller's renderer adapter.

## Generate, prepare, and test

```js
const { generateNode } = require('@avora/node-sdk/dist/generation');
const { prepareNode } = require('@avora/node-sdk/dist/environment');
const { testNode } = require('@avora/node-sdk/dist/testing');

async function runCase(folder, getAccessToken) {
  const casePath = 'tests/cases/example.avora-test.json';
  const generate = signal => generateNode({
    folder, casePath, signal, token: getAccessToken,
  });
  const generated = await generate();
  const prepared = await prepareNode({ folder, casePath, python: '3.11', generate });
  const report = await testNode({ folder, casePath, generate });
  return { generated, prepared, report };
}
```

Generation defaults to `https://mcp.avora.dev/api/v1` and requires a valid session. Pass `apiUrl` to `generateNode` for another environment and use a session approved for that backend. Prepare downloads managed Python tooling on first use and installs supported PyPI wheel dependencies. Testing runs a disposable local FastAPI application and compares its response with the case's expectations. These actions reuse matching generation and dependency state.

The first local execution adapter supports pure FastAPI nodes with empty or enum-only context. Generation can accept scratch entity schemas, but that does not add database fixture execution. Cases without expectations remain **Not tested**, and changed source or inputs make previous reports **Outdated**. Generated code runs with your local user permissions.

## Private drafts and conflicts

`materializeDraft` converts a private draft into mapped files; `assembleDraft` reconstructs the API payload while retaining metadata. Use `NodeDraftClient` to read or update a draft with its expected revision. On `DraftConflictError`, read the current draft and reconcile changes before another update.

Local generation and tests do not sync or publish a node. Use [the extension's draft workflow](../extension-node-authoring.md) to link and sync it, then [Publish, Share, and Clone](../share-logic-nodes.md) in Avora.

## More examples

The [SDK README](https://github.com/Avora-ai-backend-generator/Avora/blob/main/avora-sdk/README.md) describes source diagnostics, language projections, case generation, dependency migrations, logos, and native login. Browse the [Markdown documentation](https://github.com/Avora-ai-backend-generator/Avora/blob/main/docs.md) for the complete guide index.
