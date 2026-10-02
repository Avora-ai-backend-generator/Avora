# Avora

Avora is a visual backend development platform. Design data models and API requests, connect reusable business logic, and generate source code you can inspect and run.

[Website](https://avora.dev) · [Documentation](https://docs.avora.dev) · [Markdown guides](docs.md) · [SDK releases](https://github.com/Avora-ai-backend-generator/Avora/releases)

## Open-source Node SDK

[`@avora/node-sdk`](avora-sdk/README.md) provides TypeScript and JavaScript tools for local custom node authoring. It includes:

- Local project scaffolding and JSON Schema validation.
- Tagged template validation and mapped source diagnostics.
- Private draft materialization, assembly, and revision-aware API exchange.
- Authenticated generation and managed local Python dependency preparation.
- Saved cases, bounded starter case generation, and local FastAPI test reports.
- Portable light/dark logos, node colors, and browser connection adapters.

The SDK is MIT licensed, separately versioned, and independent of VS Code. This repository contains the SDK and documentation. Backend generation uses Avora's hosted compiler API; the application and compiler implementation are separate.

### Build and test

Use Node.js 22 or later:

```bash
git clone https://github.com/Avora-ai-backend-generator/Avora.git
cd Avora/avora-sdk
npm ci
npm test
npm pack
```

Install the resulting archive with `npm install /absolute/path/to/avora-node-sdk-<version>.tgz`, or use the versioned package from [GitHub Releases](https://github.com/Avora-ai-backend-generator/Avora/releases). See the [SDK guide](docs/developer-tools/sdk.md) for APIs and examples. GitHub distribution does not imply an npm registry release.

## Developer tools

| Tool | Workflow | Documentation |
| --- | --- | --- |
| Node SDK | Programmatic custom node authoring, generation, and local tests | [SDK](docs/developer-tools/sdk.md) |
| Avora CLI | Browser sign-in, backend pulls, local node creation, cases, and JSON reports | [CLI](docs/cli.md) · [Node commands](docs/developer-tools/cli-node-authoring.md) |
| VS Code extension | Backend projects, editable local nodes, draft sync, mapped diagnostics, and tests | [Extension](docs/extension.md) · [Node authoring](docs/developer-tools/extension-node-authoring.md) |
| Avora MCP | 22 tools for selected projects, private drafts, source, issues, previews, and reviewed changes | [Connection](docs/developer-tools/mcp.md) · [Tool reference](docs/developer-tools/mcp-tools.md) |

Install the extension from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Avora.avora-dev) or [Open VSX](https://open-vsx.org/extension/avora/avora-dev). Download the current CLI and VS Code archives from **Avora → Settings → Connectors**. The CLI also supports linking a development checkout. Guides describe the current implementation; an installed extension can lag until its next release.

## MCP availability

Read, private draft, generated source, issue, and preview tools work on Free and paid accounts within existing allowances. Workspace creation and reviewed canvas edits require Pro or Team. Browser authorization lets you choose permissions and projects, update access, and revoke the connection.

MCP uses Streamable HTTP and must be enabled on the Avora backend serving your environment. See [connection setup](docs/developer-tools/mcp.md) and [reviewed workspace edits](docs/developer-tools/mcp-workspace-edits.md).

## Documentation and contributions

Start with [docs.md](docs.md) or the complete [Markdown page index](docs/README.md). File SDK issues in this repository with a minimal node manifest, relevant source, expected behavior, and Node.js version. Keep credentials, environment values, and private workspace data out of examples.

To change the SDK, install dependencies in `avora-sdk/`, run `npm test`, and use `npm pack --dry-run` to inspect distribution contents.

[MIT license](LICENSE)
