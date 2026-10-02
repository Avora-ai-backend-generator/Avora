# Generate Test Code

Turn the configured node preview into a small FastAPI project in one dedicated local directory.

## Task

Generate or refresh local files for the current node, workspace, target group, variant, and input configuration.

## Prerequisites

- The tester is open from the VS Code extension.
- Workspace, target, variant, and required node fields are valid.
- A writable node test directory is configured.

## Find This in the Tester

Use **Set Dir** when no test directory exists, then select **Update** in the toolbar.

## Steps

1. Choose a dedicated folder with **Set Dir**. Avoid a folder containing unrelated files.
2. Confirm the tester has no blocking issue.
3. Select **Update**.
4. The extension validates the workspace again and requests a logic-node preview from the generator.
5. Generated files are normalized and written to the configured directory.
6. The extension records the preview in `.avora/logic-node-preview-meta.json` and applies the read-only setting.
7. Review the **Updated** or **Up to date** result and file count, then select **Open** if you want the folder as the current VS Code workspace.

The tester intentionally reuses one directory. Each changed generation replaces managed files, preserves configured runtime folders, clears old project snapshots, and resets `.avora/runtime.db` so the next test starts with a clean fallback database.

## Expected Result

A runnable FastAPI preview exists in the selected directory, and the extension recognizes it as the preferred node test run target.

## Next Step

[Run and test the preview API](./extension-logic-node-run-test.md).

## Troubleshooting

- If the folder contains unmanaged files, choose another folder unless you intentionally want the tester to use it.
- If generation is blocked, open **Issues** and fix workspace or node errors.
- If the result is **Up to date**, the current generated files already match the preview request.
