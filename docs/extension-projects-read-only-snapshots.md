# Files and Snapshots

Know which local files Avora manages, what an update preserves, and where recovery information is stored.

## Task

Use managed pulls without losing intentional local runtime state or misunderstanding what the next update can replace.

## Prerequisites

A workspace has been pulled by the extension.

## Find This in VS Code

Open the pulled project and inspect its `.avora` directory. Managed source files are read-only when `avora.readOnlyPulledCode` is enabled.

## Steps

1. Treat generated source as output from the Avora workspace, not as the primary editing surface.
2. Read `.avora/pull-meta.json` when you need the workspace ID, last path, hashes, manifest, generator settings, read-only state, or last sync result.
3. Before replacing managed content, the extension creates `.avora/snapshots/<timestamp>` when existing managed files are present.
4. The extension excludes `.avora` and preserved root-level runtime folders from replacement and snapshot copying.
5. Built-in preserved folders include `.venv`, `venv`, `node_modules`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, and `.tox`.
6. If a write fails after replacement starts, the extension restores the snapshot automatically.

Setting `avora.readOnlyPulledCode` to `false` makes files editable, but a later update can still overwrite local changes after the drift warning. Use source control for changes you need to retain.

## Expected Result

Generated files remain clearly managed, runtime state survives updates, and the most recent pre-update code can be recovered from a timestamped snapshot.

## Next Step

Configure [additional preserved runtime folders](./extension-settings-preserve.md) or learn how to [recover from failures](./extension-troubleshooting-recovery.md).

## Troubleshooting

- If a file cannot be edited, change the read-only setting only when local editing is intentional.
- If a runtime folder disappears, add its root-level name to the preserve list before the next update.
- If metadata was deleted, pull into a new folder rather than reconstructing it by hand.
