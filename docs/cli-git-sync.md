# Sync Repository

Clone or refresh a repository URL, or update the Git repository that contains your current terminal directory.

## Task

Use one command for initial clone and later fast-forward synchronization.

## Prerequisites

- Git is installed and authenticated for the target repository.
- Existing project changes are committed, stashed, or intentionally retained.

## Find This in Your Terminal

With a repository URL:

```bash
avora sync git@github.com:org/app.git
```

From inside an existing Git project:

```bash
cd /path/to/project
avora sync
```

## Steps

1. Supply a URL for a new or named clone, or omit it inside an existing Git working tree.
2. Confirm the update when the local repository already exists.
3. The CLI runs `git pull --ff-only` so it will not create a merge commit.
4. Dependency preparation and auto-run follow unless `--no-run` is supplied.
5. Use `--cmd` when automatic run-command detection is not suitable.

## Expected Result

The repository is current with its configured remote, the tracked record has a new synchronization time, and the project runs unless auto-run was disabled.

## Next Step

Use [Find Projects](./cli-git-find.md) to inspect the registry or [Verify Project](./cli-verify.md) to check the result.

## Troubleshooting

- If `sync` has no URL and reports that it requires one, run it from inside a Git repository.
- If fast-forward pull fails, inspect `git status` and your branch history.
- If the current repository is untracked, the CLI can still resolve its Git root and register it after a successful sync.
