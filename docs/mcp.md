# Avora MCP

Connect a compatible AI client to Avora through Model Context Protocol. The integration has 22 tools for inspecting selected projects, working with private custom node drafts, generating source, reading issues, managing hosted previews, and proposing workspace changes for review.

## What you can do

| Workflow | Availability |
| --- | --- |
| Account connection, project and catalog reads, validation | Free, Pro, and Team |
| Read, create, and update your private custom node drafts | Free, Pro, and Team |
| Generate FastAPI source and read generated files | Free, Pro, and Team |
| Read saved graph issues or the latest browser Issues report | Free, Pro, and Team |
| Start, update, inspect, and stop hosted previews | Free and paid accounts, within existing preview allowances |
| Create a workspace with an initial graph | Pro and Team |
| Propose edits to an existing workspace and review them in Avora | Pro and Team |

Your plan and the permissions you grant are separate requirements. Sharing a project for reading does not authorize editing it or running a preview.

## Connect your AI client

Add a **Streamable HTTP** MCP server to your client's integration settings. Use the endpoint supplied by your Avora environment. For an environment hosted at the standard MCP domain, the endpoint is:

```text
https://mcp.avora.dev/mcp
```

The server must be enabled and deployed by that environment's administrator. If the endpoint is unavailable, ask for its current URL or use a development environment with MCP enabled.

Clients with remote HTTP MCP and browser authorization support can sign in through Avora. Client support and integration menus vary by version. In a client that provides an MCP server URL field, paste the endpoint and start authentication.

For local development, a client with a remote MCP command can use the development endpoint:

```text
http://localhost:8000/mcp
```

## Approve access

1. Start authentication in your AI client.
2. Sign in on Avora's browser page and inspect the application name.
3. Select the permissions and workspaces to share.
4. Approve the connection and return to the client.
5. Ask the assistant to call `avora_connection`, then `avora_list_projects`.

Use **Settings → Connectors → Connected applications → Manage access** to change permissions or selected projects. The next request uses the updated access; reconnecting is unnecessary. Disconnecting revokes the connection.

| Permission | Grants access to |
| --- | --- |
| `projects:read` | Selected project metadata, graph, catalog, validation, issues |
| `drafts:read` | Your private draft reads and draft validation |
| `drafts:write` | Private draft creation and edits; updates also need `drafts:read` |
| `code:read` | Generated source for selected projects; also needs `projects:read` |
| `previews:manage` | Your selected-project hosted previews; also needs `projects:read` |
| `projects:write` | Reviewed changes to selected projects; Pro/Team and `projects:read` |
| `projects:create` | New workspaces; Pro/Team and `projects:read` |

## Start with a focused request

Ask your assistant to list shared projects, inspect one project's saved graph, and read its issues. It should use IDs returned by Avora, start with summaries, and follow pagination before proposing a change.

For example: “Use Avora to inspect my orders project, explain its validation issues, and show the generated service file.” Add a separate request to start a preview when you want to run the generated backend.

## Continue

- [MCP Tool Reference](./mcp-tools.md): all 22 tools and their permissions.
- [Review Workspace Edits](./mcp-workspace-edits.md): proposals, acceptance, saved versions, and recovery.
- [Code, Issues, and Previews](./mcp-code-previews.md): source, preview status, and new project workflows.
- [Avora Node SDK](./sdk.md): programmatic local node authoring.
