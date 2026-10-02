# Pull Project Code

Validate an Avora workspace, generate its backend, and save the downloaded code in a managed local folder.

## Task

Create the first local pull for a selected Avora workspace.

## Prerequisites

- You are signed in.
- The workspace has no blocking validation errors.
- The destination is writable and has enough space for the generated project.

## Find This in VS Code

Use **Project Actions → Pull Code**, `Avora: Pull Project Code`, or select a cloud-only project and allow the run workflow to pull it first.

## Steps

1. Choose the workspace to pull.
2. If a saved path already exists, choose **Use Saved Folder** or **Choose Another Folder**.
3. Otherwise, the extension resolves the destination in this order:
   - `avora.defaultPullRoot/<project-name>` when a pull root is configured.
   - `avora-projects/<project-name>` inside the first open VS Code workspace.
   - A folder you select when neither location is available.
4. The extension validates the workspace. Fix any blocking errors in Avora before continuing.
5. The extension fetches the current graph, generates a FastAPI project, downloads the ZIP, and extracts it to the destination.
6. Select **Open Folder** or **Reveal in Finder** when the pull completes.

If the target already contains unmanaged files, choose another folder or explicitly allow Avora to use it. Review the folder first because generated files can replace existing content.

## Expected Result

The generated backend is available locally, `.avora/pull-meta.json` records its source and manifest, and the Projects view recognizes it as pulled.

## Next Step

[Run the pulled project](./extension-projects-run-project.md). After changing the visual workspace, use [Update Pulled Code](./extension-projects-update-code.md).

## Troubleshooting

- If validation blocks generation, open **Output → Avora** for issue locations and fix them in the workspace.
- If the destination is wrong, cancel the folder prompt and configure [a default pull root](./extension-settings-folders.md).
- If generation fails before files are written, existing managed code remains unchanged.
