# Find Projects

Search the CLI registry for Avora workspace pulls and connected Git repositories.

## Task

Find a saved project by name, repository, path, workspace ID, or source.

## Prerequisites

At least one project has been registered by `open`, `pull`, `connect`, or `sync`.

## Find This in Your Terminal

List every tracked project:

```bash
avora find
```

Filter the list:

```bash
avora find api
```

## Steps

1. Run `avora find` without a query to inspect all records.
2. Add a search term to match the project name, repository, path, or identity.
3. Review the source label: `avora` for generated workspaces or `git` for repositories.
4. Use the displayed name or path with `run`, `update`, or `verify`.

Quote a query that contains spaces so the shell passes it as one value.

## Expected Result

Each match shows its identity, repository or workspace reference, local path, saved run command, and last pull or sync time.

## Next Step

Continue with [Run Project](./cli-run.md) or [Update](./cli-workspaces-update.md).

## Troubleshooting

- If no records appear, create one with `avora pull` or `avora connect`.
- If a displayed path no longer exists, pull or connect the project again to a valid location.
- If you switched `AVORA_CLI_HOME`, point it back to the directory containing the expected `projects.json`.
