# Update Project Code

Refresh a managed local project from its Avora workspace while preserving selected runtime folders and creating a recovery snapshot.

## Task

Apply the latest workspace graph and generator output to an existing pull.

## Prerequisites

- The project was previously pulled by this extension.
- Its saved folder still contains matching `.avora/pull-meta.json` metadata.
- Back up or commit any local edits you intend to keep.

## Find This in VS Code

Use **Project Actions → Update Pulled Code**, `Avora: Update Pulled Project`, or `Avora: Update Current Project` while the pulled folder is open.

## Steps

1. Select the existing pulled project.
2. If the local `.env` differs from the workspace environment, choose either **Import Local .env to Workspace**, **Overwrite Local .env from Workspace**, or cancel.
3. The extension validates the workspace, fetches its graph, and downloads a newly generated archive.
4. If the generated ZIP hash is unchanged, the extension refreshes metadata and reports that the project is up to date.
5. If managed local files drifted from the last manifest, review the warning and choose **Create Snapshot and Overwrite** to continue.
6. The extension snapshots existing managed code, preserves runtime folders, replaces generated files, reapplies read-only permissions, and writes the new metadata.
7. Reinstall dependencies when the extension reports a changed dependency manifest.

Dependency warnings cover files such as `requirements.txt`, `pyproject.toml`, `package.json`, and common lockfiles.

## Expected Result

The local code matches the latest generated output while preserved runtime folders remain in place. A failed write restores the pre-update snapshot automatically.

## Next Step

[Run the updated project](./extension-projects-run-project.md) and review [read-only files and snapshots](./extension-projects-read-only-snapshots.md).

## Troubleshooting

- If the project is reported as not pulled, open the original folder and verify the metadata file.
- If the update is cancelled at the environment prompt, resolve the `.env` difference and retry.
- If the workspace is blocked, use the issue details in **Output → Avora** to repair it first.
