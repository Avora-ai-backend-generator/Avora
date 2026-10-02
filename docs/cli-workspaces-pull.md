# Pull Code

Generate the selected Avora workspace and extract its code into a tracked local project folder.

## Task

Pull a workspace by selection, name, or ID and choose whether the CLI should prepare and run it immediately.

## Prerequisites

- You are signed in to Avora.
- The workspace is valid enough for code generation.
- The `unzip` command is installed.
- The target parent directory is writable.

## Find This in Your Terminal

Choose from the account list:

```bash
avora pull --select
```

*CLI project selector: Terminal showing the Avora CLI project selector with workspace names, IDs, and update dates.*

Or provide a name or ID:

```bash
avora pull my-workspace
```

## Steps

1. Run `avora projects` when you need to confirm the workspace name.
2. Run `avora pull --select --no-run` for a guided first pull.
3. Choose the workspace. The CLI requests its graph and a generated project archive.
4. The archive is extracted to `~/avora-projects/WORKSPACE_NAME` by default.
5. Use `--path <directory>` to choose a different parent folder.
6. Remove `--no-run` when you want dependency preparation and startup to happen after the pull.

Useful forms:

```bash
avora pull workspace-id --no-run
avora pull workspace-name --path ./generated --no-run
avora pull --select --update --yes
```

`--update` accepts replacement of an existing pull. `--yes` also accepts prompts and, when selection is required, chooses the newest workspace automatically.

## Expected Result

The generated files are extracted under the selected parent directory, and the workspace ID, name, local path, API URL, pull time, and optional run command are recorded in CLI state.

> **Protect local edits.** Pulling into an existing project can overwrite generated files with matching names. Commit or copy important local changes before updating.

## Next Step

Use [Run Project](./cli-run.md) or [Verify Project](./cli-verify.md).

## Troubleshooting

- If no project is selected, rerun with `--select` in an interactive terminal or provide an exact name or ID.
- If generation fails, fix validation problems in the Avora workspace and pull again.
- If extraction fails, install `unzip` and confirm write access to the destination.
