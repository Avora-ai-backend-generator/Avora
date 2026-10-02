# Avora Documentation

Avora is a visual backend development platform for data models, API requests, reusable business logic, generated source, and backend previews.

Read the [online documentation](https://docs.avora.dev), explore the [product](https://avora.dev), or use the Markdown guides below. The public repository contains the MIT-licensed Node SDK and documentation. The hosted application, compiler, and deployment services are separate from the SDK.

## Developer tools

| Guide | What it covers |
| --- | --- |
| [Node SDK](docs/developer-tools/sdk.md) | GitHub installation, public APIs, manifests, generation, dependencies, tests, and draft exchange |
| [MCP connection](docs/developer-tools/mcp.md) | Browser authorization, selected projects, permissions, and plan availability |
| [MCP tool reference](docs/developer-tools/mcp-tools.md) | All 22 tools and pagination/limits |
| [MCP workspace review](docs/developer-tools/mcp-workspace-edits.md) | Proposed edits, accept/reject, saved versions, and retries |
| [MCP code and previews](docs/developer-tools/mcp-code-previews.md) | Generated source, saved/editor issues, preview lifecycle, and workspace creation |
| [CLI node authoring](docs/developer-tools/cli-node-authoring.md) | Scaffold, inspect, appearance, generation, preparation, cases, and tests |
| [VS Code node authoring](docs/developer-tools/extension-node-authoring.md) | Editable local nodes, language tooling, private draft sync, and Testing view |
| [Node appearance](docs/developer-tools/custom-node-appearance.md) | Logos, theme variants, custom colors, and portable assets |

## Source and downloads

The [SDK source](avora-sdk/README.md) contains detailed API examples and supported runtime boundaries. Use Node.js 22+ to build and test it:

```bash
git clone https://github.com/Avora-ai-backend-generator/Avora.git
cd Avora/avora-sdk
npm ci
npm test
npm pack
```

Install the resulting archive in your own project or download a versioned archive from [GitHub Releases](https://github.com/Avora-ai-backend-generator/Avora/releases). Source publishing and GitHub releases do not imply an npm registry release.

The VS Code extension is available from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Avora.avora-dev) and [Open VSX](https://open-vsx.org/extension/avora/avora-dev). The current CLI is distributed from a development checkout. The documentation describes the implemented versions; check your installed extension version when looking for newer commands.

## Platform guides

- [Platform overview](https://docs.avora.dev/)
- [Quick start](https://docs.avora.dev/quick-start)
- [Data modeling](https://docs.avora.dev/diagram-builder)
- [API requests](https://docs.avora.dev/request-builder)
- [Business logic](https://docs.avora.dev/logic-flow-builder)
- [Custom node builder](https://docs.avora.dev/visual-node-builder)
- [Code generation](https://docs.avora.dev/code-generation)
- [Deployment](https://docs.avora.dev/deployment)
- [Database](https://docs.avora.dev/database)
- [CLI](https://docs.avora.dev/cli)
- [VS Code extension](https://docs.avora.dev/extension)

The public repository also provides the complete [Markdown page index](https://github.com/Avora-ai-backend-generator/Avora/blob/main/docs/README.md), exported from the same content used by the site.
