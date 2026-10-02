# Custom Run Command

Replace automatic startup detection with the exact command required by a project.

## Task

Run a project with a custom command and save that command in its tracked record for later use.

## Prerequisites

- The project is already available locally.
- The command works when executed directly from the project root.

## Find This in Your Terminal

```bash
avora run project-name --cmd "your command"
```

## Steps

1. Test the intended startup command in the project directory.
2. Pass the complete command as one quoted value after `--cmd` or `-c`.
3. Use it with `run`, `open`, `pull`, `connect`, or `sync`.

```bash
avora run api --cmd "npm run start:dev"
avora open workspace-name --cmd "./scripts/dev.sh"
avora connect git@github.com:org/app.git --cmd "pnpm dev"
```

The CLI stores a successful selection in the project's local registry entry. A later `avora run project-name` can reuse it when no higher-priority detected command is available.

## Expected Result

The custom command starts in the project's root directory and receives values from the local `.env` file.

## Next Step

Use [Verify a Project](./cli-verify.md) to run quality checks independently of the startup command.

## Troubleshooting

- If only the first word is captured, quote the whole command.
- If a shell script is not executable, update its file permissions or invoke it through its shell.
- If automatic detection continues to take precedence on later runs, pass `--cmd` again; detected npm or Python entry points are checked before the saved command.
