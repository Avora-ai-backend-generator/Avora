# Install the CLI

Install Node.js 22 or later, then download the CLI archive from **Avora → Settings → Connectors**.

## Install a release archive

The current download is `avora-cli-0.9.1.tgz`. From the folder containing it:

```bash
npm install -g ./avora-cli-0.9.1.tgz
avora --help
avora login
```

You can also install the archive directly from your Avora environment's download URL. For the hosted app:

```bash
npm install -g https://app.avora.dev/downloads/avora-cli-0.9.1.tgz
```

The default API is `https://mcp.avora.dev/api/v1`. Browser sign-in lets you approve permissions and select workspaces. Use `--api` for another environment. The CLI archive bundles its SDK dependency; an npm registry release is separate.

## From a development checkout

Build the adjacent SDK before linking the local CLI:

```bash
cd /path/to/Avora-app/avora-sdk
npm ci
npm run build
cd ../avora-cli
npm ci
npm link
avora --help
```

This development checkout includes `avora-cli/` and `avora-sdk/`. The public SDK repository distributes the standalone SDK and documentation.

## Use the menu or commands

Run `avora` to open the interactive menu, or `avora --help` for commands. A non-interactive terminal prints help instead of opening the menu.

If `avora` is unavailable after installation, check npm's global binary directory on `PATH`. Use a user-owned npm prefix when the global location is not writable.

Continue with [Interactive Menu](./cli-help-menu.md), [Sign In](./cli-login-logout.md), or [Node Authoring](./cli-node-authoring.md).
