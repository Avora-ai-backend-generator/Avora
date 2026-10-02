# Logic Node Testing

Generate a small local FastAPI project around one custom logic node, run it, and call its preview endpoint from the embedded tester.

## What This Section Covers

The tester accepts one of your published nodes or a node test snapshot copied from Avora. It combines that node with a selected workspace, entity or request group, variant, and test values before generating local code.

## What You Can Accomplish

- Open a published logic node directly from the extension sidebar.
- Paste a compact test snapshot, a snapshot ID, or a full node JSON export.
- Configure variants, lines, inputs, outputs, errors, and workspace context.
- Validate the node and workspace before code generation.
- Reuse one local test directory for fast iteration.
- Start the generated preview and send a typed API request from the tester.
- Read actionable workspace, preview, and Python startup diagnostics.

## Before You Continue

Sign in, prepare a workspace with at least one entity or request group, and install Python plus the generated preview dependencies. A published node must include a valid visual configuration and code bundle.

## Recommended Order

1. Open a published node or paste a test snapshot.
2. Choose the workspace and target entity or request group.
3. Select a variant and fill its configurable values.
4. Set a dedicated local node test directory.
5. Update local code, run the preview, and send a test request.
6. Use Issues and diagnostics to correct the source node or workspace.

## Pages in This Group

- [Open Published Node](./extension-logic-node-open.md) — Load one of your published templates directly into the tester.
- [Paste Snapshot](./extension-logic-node-paste.md) — Import a temporary snapshot or full node JSON from the clipboard.
- [Configure Test](./extension-logic-node-configure.md) — Choose context, variant, and inputs while resolving validation issues.
- [Generate Test Code](./extension-logic-node-generate.md) — Write the current preview to the dedicated test folder.
- [Run and Test API](./extension-logic-node-run-test.md) — Start the preview and send typed requests from VS Code.
- [Diagnostics](./extension-logic-node-diagnostics.md) — Interpret workspace, visual-node, and Python startup issues.

## Related Documentation

- [Publish, Share, and Clone](./share-logic-nodes.md) for creating test snapshots.
- [Node Builder](./visual-node-builder.md) and [Code Builder](./code-builder.md) for correcting a custom node.
