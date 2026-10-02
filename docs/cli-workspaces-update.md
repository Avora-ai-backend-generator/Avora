# Update

Refresh an Avora workspace that is already tracked locally without automatically starting it.

## Task

Replace matching generated files with the latest workspace output and prepare any required dependencies.

## Prerequisites

- The workspace was previously pulled and remains registered in CLI state.
- You are signed in to the same Avora backend.
- Important local edits are committed or backed up.

## Find This in Your Terminal

```bash
avora update workspace-name
```

When your current folder belongs to a tracked workspace, you can omit the name:

```bash
avora update
```

## Steps

1. Stop any process using files that will be replaced.
2. Commit or copy local edits you need to keep.
3. Run `avora update` with a tracked workspace name, ID, path, or from inside its folder.
4. Confirm the update, or use `--yes` in a controlled automation workflow.
5. Review the success message and resolve any dependency preparation errors.

## Expected Result

The CLI downloads a newly generated archive into the existing project path, updates the last-pulled time, and prepares the project. It does not start the project after the `update` command.

## Next Step

Run [Run Project](./cli-run.md), then [Verify Project](./cli-verify.md).

## Troubleshooting

- If the CLI cannot resolve the remote workspace, run `avora projects` and compare its name and ID with the local record.
- If login is required, sign in again before updating.
- If an important local file was overwritten, restore it from version control or your backup; the CLI does not create extension-style snapshots.
