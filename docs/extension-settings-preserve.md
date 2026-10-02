# Preserve Runtime Folders

Protect root-level local environments, dependency installs, caches, and other generated runtime state when Avora replaces managed source files.

## Task

Add project-specific runtime directory names to the extension's built-in preservation list.

## Prerequisites

- You know which root-level folders are recreated locally and should not come from Avora generation.
- The folder names do not contain source files that must be refreshed from the workspace.

## Find This in VS Code

Open `Avora: Open Settings` and edit `avora.preserveLocalRuntimeFolders` as an array of root-level folder names.

## Steps

1. Review the built-in preserved folders: `.venv`, `venv`, `node_modules`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, and `.tox`.
2. Add only additional root-level names, for example `.direnv` or a tool-specific cache folder.
3. Save the setting before the next project update or node preview generation.
4. Run the update and confirm the folder remains unchanged.

Example setting:

```json
{
  "avora.preserveLocalRuntimeFolders": [".direnv", ".cache-local"]
}
```

Preserved folders are excluded from manifest drift checks, read-only changes, replacement, and project recovery snapshots. Preservation applies only when the name is at the generated project's root.

## Expected Result

The listed runtime folders survive managed updates while generated source and dependency manifests can still refresh.

## Next Step

Review [Read-only Files and Snapshots](./extension-projects-read-only-snapshots.md) and [Update Pulled Code](./extension-projects-update-code.md).

## Troubleshooting

- If a nested cache is removed, preserve its root-level parent or move the runtime state to a root folder.
- If generated source stops updating, remove source directories from the preservation list.
- If a dependency manifest changes, reinstall dependencies even though the installed runtime folder was preserved.
