# Connect Repository

Clone a Git repository, register its local location, prepare dependencies, and run it from one command.

## Task

Connect a repository URL to Avora CLI for repeatable update, run, and verify commands.

## Prerequisites

- Git is installed.
- Your current SSH key or credential helper can access the repository.
- The target directory is writable.

## Find This in Your Terminal

```bash
avora connect <repo-url>
```

## Steps

1. Run `connect` with an HTTPS or SSH repository URL.
2. The CLI derives the local project name from the repository. Use `--name` to override it.
3. By default, the clone is created under `./pulled-projects/PROJECT_NAME`. Use `--path` to choose another parent directory.
4. If the destination already contains the same Git repository, confirm a fast-forward-only pull or add `--update`.
5. The CLI prepares dependencies and runs the project unless you add `--no-run`.

```bash
avora connect git@github.com:org/app.git --name app --no-run
avora connect https://github.com/org/app.git --path ./projects --update
```

## Expected Result

The repository is cloned or updated, registered as a Git project, and optionally started with a detected or explicit run command.

## Next Step

Use [Sync Repository](./cli-git-sync.md), [Run Project](./cli-run.md), or [Verify Project](./cli-verify.md).

## Troubleshooting

- If authentication fails, test the same repository URL with `git clone` and repair your Git credentials.
- If the destination has a different remote, choose another path or repository name. The CLI refuses to update a mismatched remote.
- If the pull cannot fast-forward, resolve the branch history with Git before retrying.
