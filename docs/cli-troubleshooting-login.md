# Login Issues

Most connection problems come from the API URL, browser approval, selected workspaces, or revoked access.

## Check the backend

The CLI defaults to `http://localhost:8000`. Use `avora login --api <your-backend-url>` for another environment. Browser sessions are bound to that server; sign in again when changing servers. Review [API & State](./cli-api-state.md) for URL precedence.

## Finish browser approval

Keep the CLI running until the browser flow completes. Sign in, inspect **Avora CLI**, select workspaces, and approve. If browser launch fails, use `avora login --no-browser` and open the printed link manually from a browser that can reach the local callback.

Cancelling or timing out does not create a usable session. Start a fresh login when ready.

## Empty projects or missing permission

Open **Settings → Connectors → Connected applications → Manage access** in Avora. Select the required projects and permissions. The next CLI request reads the updated grant without reconnecting.

## Expired session or unavailable keyring

The CLI refreshes browser sessions when needed. If access has been revoked or refresh fails, run `avora login` again. Use `avora logout` to clear the local session.

On headless macOS/Linux, `AVORA_CLI_CREDENTIAL_STORE=file` explicitly selects an owner-only, unencrypted credentials file when the system keyring is unavailable. Windows requires Credential Manager. Keep these files private and out of Git.

Continue with [Sign In](./cli-login-logout.md).
