# Sign In

Connect the extension through Avora's browser authorization page. Your account password stays in the browser sign-in flow.

## Start the connection

Use **Login to Start** in the Avora sidebar, **Avora: Login** in the Command Palette, or **Avora: Account Actions → Connect**. The extension defaults to `https://mcp.avora.dev/api/v1`. Configure the backend URL first when using a development environment.

## Steps

1. Start login and keep VS Code open.
2. Sign in on the Avora browser page using a supported account method.
3. Inspect **Avora VS Code**, its requested permissions, and selected workspaces.
4. Approve and return to VS Code.
5. Run **Avora: Refresh Projects** if the sidebar needs refreshing.

The extension stores the session in VS Code SecretStorage. Tokens are refreshed through the browser authorization service and remain bound to the backend you approved. Credentials are not written into a node project or generated source folder.

## Manage access or sign out

Use **Settings → Connectors → Connected applications → Manage access** in Avora to change permissions or shared workspaces. Updates apply on the next request without reconnecting.

**Avora: Logout** revokes the browser connection and removes local secrets. If the server is unavailable during logout, remove the remote connection in Avora's Connected applications page when it is reachable.

## Troubleshooting

- Empty projects: select workspaces in **Manage access**, then refresh the sidebar.
- Callback did not complete: keep VS Code open and finish browser approval before it expires.
- Changed backend URL: reconnect to approve access to the new server.
- Revoked or expired session: run **Avora: Login** again.

Continue with [Status and Account](./extension-status-account-actions.md), [List and Select Projects](./extension-projects-list-select.md), or [Local Node Authoring](./extension-node-authoring.md).
