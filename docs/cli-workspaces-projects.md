# List Workspaces

List the workspaces available to the signed-in Avora account and see whether each one is already tracked locally.

## Task

Find the name or ID of the workspace you want to pull.

## Prerequisites

- You are signed in with `avora login`.
- The configured Avora API is reachable.

## Find This in Your Terminal

```bash
avora projects
```

## Steps

1. Run `avora projects`.
2. Review each workspace's name, ID, last update time, and pulled location.
3. Copy the name or ID for use with `pull` or `open`.
4. For machine-readable output, add `--json`.

   ```bash
   avora projects --json
   ```

## Expected Result

The standard view lists newest workspaces first. A workspace already registered by the CLI shows its local path; otherwise it shows **not pulled yet**. JSON mode prints the workspace response without the formatted terminal view.

## Next Step

[Pull Code](./cli-workspaces-pull.md) or use [Open & Run](./cli-workspaces-open.md) for the combined workflow.

## Troubleshooting

- **Not logged in:** run `avora login`.
- **No projects found:** confirm that the account has access to at least one Avora workspace.
- **Could not list projects:** verify the API URL and network connection, then sign in again if the session has expired.
