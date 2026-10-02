# Avora CLI

Use the Avora CLI to bring an Avora workspace into your terminal, prepare it for local development, run it, and verify the generated project.

The CLI supports both guided terminal workflows and direct commands. Start with the interactive menu when learning the tool, then use individual commands when you want a repeatable workflow or machine-readable output.

## What This Section Covers

The CLI documentation covers installation, sign-in, workspace pulls, Git repositories, local runs, verification reports, and recovery from common setup problems.

You can use the CLI to:

- Sign in to an Avora account and list available workspaces.
- Pull generated workspace code into a local folder.
- Open, update, and run a previously pulled project.
- Connect or synchronize a separate Git repository.
- Run lint, type-check, test, and build checks.
- Produce JSON reports for scripts and AI-assisted debugging.
- Create local custom nodes, edit logos, generate cases, and run node tests with [node authoring commands](./cli-node-authoring.md).

## Before You Continue

Install Node.js 22 or later with npm. Workspace pulls also require an Avora account and access to the Avora API. Depending on the project you run, you may also need Git, Python 3, or the `unzip` command.

Download the CLI archive from **Avora → Settings → Connectors**, or link the local `avora-cli` package in a development checkout. See [installation](./cli-install-run.md); the release archive bundles its SDK dependency.

## Recommended Order

1. [Install and run the CLI](./cli-install-run.md).
2. [Learn the help screen and interactive menu](./cli-help-menu.md).
3. [Sign in to Avora](./cli-login-logout.md).
4. [List and pull a workspace](./cli-workspaces-projects.md).
5. [Run and verify the project](./cli-run.md).

## Pages in This Group

- [Install the CLI](./cli-install-run.md) — Install the release archive or link a development checkout.
- [Interactive Menu](./cli-help-menu.md) — Use the guided command palette and learn its keyboard controls.
- [Sign In](./cli-login-logout.md) — Authenticate safely and understand what logout clears.
- [API & State](./cli-api-state.md) — Choose an API endpoint and control where CLI state is stored.

## Related Documentation

- [VS Code Extension](./extension.md) for the editor-based pull and run workflow.
- [Code Generation](./code-generation.md) for generating and exporting code in Avora.
- [Deployment](./deployment.md) for moving a reviewed backend beyond local development.
