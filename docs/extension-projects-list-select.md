# List and Select Projects

Find an account workspace, see whether it has a valid local pull, and choose the action you want to perform.

## Task

Use the Projects view or Command Palette to choose a workspace or reopen a project already pulled on this device.

## Prerequisites

- You are signed in to Avora.
- The configured backend is reachable.

## Find This in VS Code

Open the Avora Activity Bar icon, then use the **Projects** view. A library-folder icon marks a cloud project; an active-folder icon marks a project with valid local metadata and usable generated files.

## Steps

1. Open **Projects** and use its refresh action when the list is stale.
2. Select a project to run it. If it has not been pulled, the extension pulls it first.
3. To choose an action without immediately running, open the project context menu and select **Project Actions**.
4. Choose **Pull Code** for a new or alternate destination.
5. For an existing pull, choose **Update Pulled Code** or **Open Local Folder**.
6. To switch directly among known local pulls, run `Avora: Select Current Project`.

The extension remembers each workspace-to-folder mapping in VS Code global state. It accepts that mapping only when the folder still contains matching `.avora/pull-meta.json` metadata and usable content.

## Expected Result

The selected project opens, runs, pulls, or updates from the path associated with its Avora workspace ID.

## Next Step

[Pull generated code](./extension-projects-pull-code.md) for a new project or [run a pulled project](./extension-projects-run-project.md).

## Troubleshooting

- If no projects appear, confirm the account owns or can access a workspace, then refresh.
- If a pulled project appears as cloud-only, verify its saved folder and `.avora/pull-meta.json` still exist.
- If clicking a project starts an unexpected pull, use **Project Actions** to inspect the saved path first.
