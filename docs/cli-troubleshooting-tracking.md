# Project Tracking

Recover when the CLI cannot resolve a project, points to a moved folder, or reads a different state file than expected.

## Task

Locate the active registry, validate its project paths, and recreate stale records safely.

## Prerequisites

- Access to the expected project folder.
- Knowledge of any custom `AVORA_CLI_HOME` setting.
- A backup of important local changes before pulling again.

## Find This in Your Terminal

List the records visible to the current shell:

```bash
avora find
```

## Steps

1. Confirm the value of `AVORA_CLI_HOME` and use the same value as the shell that created the record.
2. Run `avora find` and inspect the source, identity, and path.
3. If the project moved, pass its new directory directly to `avora run /new/path` or reconnect it.
4. For an Avora workspace, use `avora projects` to confirm the remote ID, then pull it to the intended parent folder.
5. For a Git project, run `avora sync` inside the repository or reconnect its URL.
6. If `projects.json` is malformed, move it aside, let the CLI create a fresh file, then sign in and recreate project records.

## Expected Result

`avora find` shows a valid local path, and `run`, `update`, or `verify` can resolve the project by name, identity, path, or current directory.

## Next Step

Return to the workflow that originally failed and retry it with the resolved name or absolute path.

## Troubleshooting

- Duplicate names can make a project ambiguous. Use its workspace ID or absolute path.
- Deleting a local folder does not remove its saved registry entry; reconnect or repull to a valid path.
- Changing `AVORA_CLI_HOME` intentionally creates or selects a different registry.
