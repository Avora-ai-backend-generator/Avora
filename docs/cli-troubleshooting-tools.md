# Local Tools

Repair local setup failures that prevent a pull, Git sync, dependency installation, run, or verification command from completing.

## Task

Identify the missing executable or dependency manager and confirm it works before retrying Avora CLI.

## Prerequisites

Permission to install tools on the local machine and access to the project's dependency sources.

## Find This in Your Terminal

Check only the tools required by your workflow:

```bash
node --version
npm --version
git --version
unzip -v
python3 --version
```

## Steps

1. If `avora` does not start, repair Node.js, npm, or the local npm link.
2. If workspace extraction fails, install `unzip`.
3. If repository commands fail, install Git and verify repository authentication.
4. If Python setup fails, confirm `python3 -m venv` works and that pip can reach the required packages.
5. If Node setup fails, run `npm install` inside the project and resolve its first reported error.
6. Retry the original Avora command after the direct tool command succeeds.

## Expected Result

The required executable is available on `PATH`, project dependencies install successfully, and the original pull, run, or verify command advances past setup.

## Next Step

Return to [Run Project](./cli-run.md) or [Verify Project](./cli-verify.md).

## Troubleshooting

- A newly installed executable may require opening a new terminal before `PATH` updates.
- Python virtual-environment creation can require an additional OS package on some Linux distributions.
- Dependency install errors belong to the generated or connected project; run the reported package command directly for full diagnostics.
