# Avora VS Code Extension

Use the Avora extension to pull backend projects, author local custom nodes, sync private drafts, and run node tests in VS Code.

The extension connects your Avora account to a local development workflow. It can pull a complete workspace, update an existing pull safely, start supported projects, and generate an isolated FastAPI preview for a custom logic node.

*Avora VS Code extension overview: See the Avora extension workflow for browsing projects, working with generated code, and testing from VS Code.* [Watch video](https://docs.avora.dev/videos/docs/extension-overview.mp4)

## Get the Extension

Install Avora from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Avora.avora-dev) or the [Open VSX Registry](https://open-vsx.org/extension/avora/avora-dev).

VS Code-compatible editors such as Cursor or Antigravity can use different extension registries depending on the editor version. Search for **Avora** in that editor's Extensions view first, then use the supported Marketplace or Open VSX listing.

## What This Section Covers

The Extension documentation covers installation, account access, project pull and update workflows, local node authoring, private draft sync, published logic node testing, local folder behavior, settings, and recovery.

You can use the extension to:

- Browse Avora workspaces and your published logic nodes in the Activity Bar.
- Pull generated workspace code into a predictable local folder.
- Detect remote changes and update an existing pull with recovery snapshots.
- Start a generated FastAPI or Node project in a VS Code terminal.
- Import, configure, generate, run, and call a published logic node preview.
- Keep generated files read-only while preserving local runtime folders.
- Create and edit local custom nodes, manage dependencies and logos, sync private drafts, and run saved test cases.

## Before You Continue

Install Visual Studio Code 1.90 or later and make sure you can sign in to an Avora account. The extension defaults to a locally running Avora backend and frontend; configure different URLs first if your Avora environment is hosted elsewhere.

Running generated code may also require Python, Node.js, and the dependencies declared by that project.

## Recommended Order

1. [Install and open the extension](./extension-install-open.md).
2. [Sign in from VS Code](./extension-sign-in.md).
3. [List and pull a project](./extension-projects-list-select.md).
4. [Author a local custom node](./extension-node-authoring.md) or [test a published logic node](./extension-logic-node-testing.md).
5. Review [URLs](./extension-settings-urls.md), folders, and recovery.

## Pages in This Group

- [Install](./extension-install-open.md) — Install Avora from the Marketplace and find its Activity Bar views.
- [Sign In](./extension-sign-in.md) — Connect an Avora account and refresh the sidebar data.
- [Status and Account](./extension-status-account-actions.md) — Use the Avora status item, account menu, and contextual run action.

## Command Palette Reference

Open the Command Palette and type **Avora** to find the available commands.

| Command | Purpose |
| --- | --- |
| `Avora: Login` / `Avora: Logout` | Start or end the saved Avora session. |
| `Avora: Account Actions` | Open account, project, URL, refresh, and settings actions. |
| `Avora: Set Backend URL` | Change the API endpoint used by the extension. |
| `Avora: Set Frontend URL` | Change the web app used by the embedded node tester. |
| `Avora: Open Settings` | Open the extension settings page. |
| `Avora: New Node Testing` | Open a blank published-node tester. |
| `Avora: Open Published Logic Node` | Choose a published node and open it in the tester. |
| `Avora: List Projects` | Choose a workspace and open its project action menu. |
| `Avora: Select Current Project` | Open one of the projects already pulled on this device. |
| `Avora: Pull Project Code` | Generate and download a workspace locally. |
| `Avora: Update Pulled Project` | Refresh an existing managed pull. |
| `Avora: Run Project` | Pull when needed, then run the selected project. |
| `Avora: Run Current Directory` | Run the managed project or node preview open in VS Code. |
| `Avora: Refresh Projects` | Reload the account, projects, and published nodes. |
| `Avora: Create Local Node` / `Avora: Open Local Node` | Create or open an editable custom node project. |
| `Avora: Open Node Draft` / `Avora: Sync Node Draft` | Open or save a linked private draft. |
| `Avora: Try Node` / `Avora: Run Node Test` | Configure a saved case and test its behavior. |
| `Avora: Edit Node Appearance` | Import portable logos and choose the heading color. |

## Related Documentation

- [Avora CLI](./cli.md) for a terminal-first local workflow.
- [Publish, Share, and Clone](./share-logic-nodes.md) for creating the node test snapshot used by the extension.
- [Code Generation](./code-generation.md) for the generated backend before it reaches VS Code.
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Avora.avora-dev) for Visual Studio Code.
- [Open VSX Registry](https://open-vsx.org/extension/avora/avora-dev) for open-source and Open VSX-compatible editors.
