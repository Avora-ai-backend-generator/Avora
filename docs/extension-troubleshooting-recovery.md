# Recover from Failures

Use the extension's validation messages, output logs, metadata, and snapshots to return a project or node preview to a known state.

## Task

Identify the failing stage and choose the safest recovery path without deleting working local runtime data.

## Prerequisites

Keep the affected folder available and avoid manually changing files under `.avora` until you understand the failure.

## Find This in VS Code

Open **View → Output** and select **Avora**. Also review VS Code notifications, the tester's **Issues** panel, and metadata under the project's `.avora` folder.

## Steps

1. **Connection or login failure:** verify the backend URL, log out, sign in again, and refresh.
2. **Workspace blocked:** read the validation locations in the notification or Avora output, fix those nodes in Avora, then retry the pull or preview.
3. **Wrong or unmanaged destination:** choose another folder unless the existing content is safe to replace.
4. **Local changes detected:** commit or copy important work, then approve **Create Snapshot and Overwrite** only when ready.
5. **Update write failure:** keep the folder in place. The extension restores the snapshot automatically and records `lastSyncStatus: failed` with the error in pull metadata.
6. **Dependency warning:** reinstall dependencies before restarting the project.
7. **Run failure:** confirm the entry file, runtime, dependencies, environment values, and port 8001.
8. **Node tester failure:** use **Issues** and the automatic local preview diagnostic, then regenerate after fixing the source node or workspace.

For a full project, recovery copies are under `.avora/snapshots/<timestamp>`. The node tester is different: it is a disposable single-directory preview, resets its fallback database during generation, and does not retain project-style snapshots. Regenerate it from the source node instead.

## Expected Result

You can distinguish remote validation, generation, local drift, write, dependency, runtime, and API-test failures and use the matching recovery path.

## Next Step

Return to [List and Select Projects](./extension-projects-list-select.md) or [Logic Node Testing](./extension-logic-node-testing.md).

## Troubleshooting

- If metadata exists but the project is no longer recognized, confirm the stored workspace ID matches the project and generated files are still present.
- If automatic restore did not complete, copy the newest timestamped project snapshot to a safe location before making manual repairs.
- If the Avora output lacks enough detail, reproduce the failing action once and capture the newest labeled log lines.
