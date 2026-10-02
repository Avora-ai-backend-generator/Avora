# Author Custom Nodes in VS Code

The Avora extension supports editable local custom node projects alongside generated backend pulls and published-node testing. Local projects use `avora.node.json`, tagged source, dependency files, saved cases, and the shared [Node SDK](../sdk.md).

## Create or open a node

Run **Avora: Create Local Node** to scaffold a project without an account, or **Avora: Open Local Node** to open an existing folder. **Avora: Open Node Draft** materializes a private draft after you connect your account.

New projects contain placeholder code. Open the structure and source, define the behavior, and write expected case results before treating the node as working.

## Edit structure, source, and dependencies

| Command | Use |
| --- | --- |
| `Avora: Open Node Structure` | Edit the manifest's visual contract |
| `Avora: Preview Node Structure` | Inspect the node's visual structure |
| `Avora: Open Template Source` | Edit the tagged `.avora` source |
| `Avora: Insert Template Tag` | Insert tags from the actual structure IDs |
| `Avora: Template Actions` | Open actions for the current template |
| `Avora: Suggest Code` | Request a source suggestion |
| `Avora: Open Dependencies Table` | Edit the mapped dependency declaration source through its table |
| `Avora: Edit Node Appearance` | Import light/dark logos or choose a heading color |

The manifest is the structure source, and `dependencies/fastapi/requirements.txt` is the dependency source. Keep stable IDs and HLV1 tags. Template source is editable even though generated backend pulls are managed as read-only snapshots.

Python template tooling maps supported completion, hover, and diagnostics to the authored source using a verified generated service and prepared interpreter. If structure, configuration, dependencies, or scratch context changes, Prepare again. The temporary editor projection is not executable generated code.

## Configure and run a case

1. Run **Avora: Try Node** to choose a saved case and edit its configuration, inputs, and expected result.
2. Run **Avora: Generate Node** to generate the selected case through your authenticated Avora server.
3. Run **Avora: Prepare Node** to prepare managed Python and locked dependencies.
4. Run **Avora: Run Node Test**, or use the node's Testing view action.
5. Inspect the response and mapped source diagnostics. Use **Avora: Open Generated Service** when a generated file helps explain a failure.

The Testing view reports **Passed**, **Failed**, **Not tested**, or **Outdated**. A case without an expectation cannot pass. Source and case changes invalidate prior results. Use **Avora: Generate Test Cases** to review a starter case plan; add your own expectations before claiming behavior is verified.

The first runtime supports pure FastAPI nodes with empty or enum-only context. Database fixtures and full LogicFlow runtime contexts are not part of this execution adapter. Generated code runs locally with your user permissions.

## Link and sync a private draft

Connect through [browser sign-in](../extension-sign-in.md). **Avora: Sync Node Draft** links an unlinked local project or updates its linked private draft. **Avora: Open Node in Avora** opens the web editor. **Avora: Edit Structure in Avora** hands structure editing to the browser.

Sync uses the expected draft revision. If another client has changed the draft, resolve the conflict against the current remote revision; do not overwrite the IDs by hand. Source, test artifacts, mapped dependencies, and logo assets travel with the authoring payload.

Sync saves a private draft. Publication is a separate action in [Publish, Share, and Clone](../share-logic-nodes.md).

## Keep authored files visible

Commit the manifest, templates, dependency source, cases, scratch context, logo assets, and `avora.lock`. **Avora: Show/Hide Runtime Files** controls the visibility of disposable generated output and `.avora/` state. Keep local environment values in an ignored `.env.local` file.

Backend generation requires a connected account. Local scaffolding and file editing work offline; Prepare and Test can reuse already matching local generation and environments.
