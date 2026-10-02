# Open and Run

Use one command to sign in when necessary, select a workspace, pull or update its generated code, prepare dependencies, and start the project.

## Task

Open the quickest guided path from an Avora workspace to a running local backend.

## Prerequisites

- Avora CLI is installed.
- Your Avora account can access the workspace.
- Local tools required by the generated project are installed.

## Find This in Your Terminal

```bash
avora open
```

## Steps

1. Run `avora open`.
2. Sign in when no saved session exists.
3. Choose a workspace from the interactive list.
4. The CLI pulls new code or updates the existing tracked project.
5. It prepares Python or Node dependencies when detected.
6. It starts the detected run command.

You can target a workspace directly or adjust the workflow:

```bash
avora open my-workspace
avora open my-workspace --no-run
avora open my-workspace --cmd "npm run dev"
avora open my-workspace --path ./generated
```

## Expected Result

The local project is current, registered in CLI state, and running in the foreground. Stop the running process with your terminal's normal interrupt shortcut, usually Control+C.

## Next Step

Use [Verify a Project](./cli-verify.md) after the project starts successfully.

## Troubleshooting

- If no run command is detected, repeat the command with `--cmd "YOUR_COMMAND"`.
- If installation fails, follow [Local Tools](./cli-troubleshooting-tools.md).
- If the wrong workspace is chosen with `--yes`, omit that option and use the interactive selector or provide a name or ID.
