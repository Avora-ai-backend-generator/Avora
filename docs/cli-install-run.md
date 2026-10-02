# Install the CLI

Link the local CLI package so the `avora` command is available from any terminal on your machine.

## Task

Install the current repository version of Avora CLI and confirm that its help output opens correctly.

## Prerequisites

- Node.js 22 or later and npm are installed.
- You have a local copy of the Avora repository.
- Your terminal can write to npm's global link location.

## Find This in Your Terminal

Open a terminal and move into the repository's `avora-cli` folder.

```bash
cd /path/to/Avora-app/avora-cli
```

## Steps

1. Build the adjacent SDK, then install the CLI dependencies.

   ```bash
   npm --prefix ../avora-sdk ci
   npm --prefix ../avora-sdk run build
   npm ci
   ```

2. Create the global development link.

   ```bash
   npm link
   ```

3. Confirm that the command is available.

   ```bash
   avora --help
   ```

4. Open the interactive menu from a terminal that supports keyboard input.

   ```bash
   avora
   ```

## Expected Result

`avora --help` prints the command list, options, and examples. Running `avora` in an interactive terminal opens the Avora command palette.

## Next Step

Continue with [Interactive Menu](./cli-help-menu.md), then [Sign In](./cli-login-logout.md).

## Troubleshooting

- If `avora` is not found, run `npm link` again from the `avora-cli` folder and make sure npm's global binary directory is on your `PATH`.
- If npm reports a permissions error, use a user-owned npm prefix rather than running the command with elevated privileges.
- If the menu does not open, run `avora --help`. Non-interactive terminals intentionally show help instead of the menu.
