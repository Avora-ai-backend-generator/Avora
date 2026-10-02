# Local Project Folders

Choose predictable local locations for full workspace pulls and the single reusable logic node preview.

## Task

Separate generated projects from the dedicated tester folder and understand the fallback location rules.

## Prerequisites

Choose writable absolute directories that are not used for unrelated files.

## Find This in VS Code

Open `Avora: Open Settings` and search for **default pull root** or **logic node test directory**. The tester also offers **Set Dir** when its directory is missing.

## Steps

1. Set `avora.defaultPullRoot` when every pulled workspace should live under one parent directory.
2. Leave it empty to place pulls under `avora-projects` in the first open VS Code workspace.
3. If neither location is available, choose a pull root when prompted.
4. Set `avora.logicNodeTestDirectory` to a dedicated folder for node previews.
5. If the node test setting is empty, the extension can reuse an open folder marked as a node tester, prompt for a folder, or derive a fallback during generation:
   - `<defaultPullRoot>/logic-node-test` when a pull root exists.
   - `<open-workspace>/avora-node-test` otherwise.
6. Keep the node test directory separate from full pulled projects because each changed preview generation replaces its managed contents.

## Expected Result

Each workspace resolves to its remembered project folder, while all logic node iterations reuse one clearly identified test directory.

## Next Step

Configure [runtime-folder preservation](./extension-settings-preserve.md) before updating projects with local environments or dependency caches.

## Troubleshooting

- If the wrong project folder opens, remove or relocate it deliberately, then pull to the intended destination.
- If the tester keeps asking for a directory, set an absolute path and confirm VS Code can create its `.avora` marker.
- If a folder contains unrelated files, choose another destination when the extension warns you.
