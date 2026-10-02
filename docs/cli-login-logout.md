# Sign In

Connect the CLI through Avora's browser authorization page. Sign in there, approve the CLI's permissions, and select the workspaces it may access.

## Steps

1. Run `avora login`, or pass your environment's backend with `avora login --api https://your-avora-api.example.com`.
2. In the browser, sign in using your Avora account's supported method.
3. Review **Avora CLI**, approve permissions, and select workspaces.
4. Return to the terminal and wait for the connected-account confirmation.
5. Run `avora projects` to inspect the selected workspaces.

The default backend is `http://localhost:8000`. Use your hosted environment's real backend URL instead of the example above when working remotely.

## Open the link manually

```bash
avora login --no-browser
```

This prints the authorization link without opening a browser. Keep the CLI running while approving the connection. The browser must be able to reach the CLI's local callback; this option does not turn login into a remote device-code flow.

Explicit `--email` or `--password` options retain legacy password-login compatibility. The default flow uses the browser and does not ask for an account password in the terminal.

## Credentials and logout

Tokens use the system credential store. Existing plaintext sessions migrate when saved. `projects.json` keeps account/connection metadata and tracked project locations rather than new plaintext tokens.

```bash
avora logout
```

Logout revokes the browser connection and clears local credentials while retaining tracked projects. If remote revocation fails, remove the connection under **Settings → Connectors → Connected applications** in Avora.

Use **Manage access** in the same page to change permissions or selected workspaces. The next CLI request uses the updated grant; a reconnect is unnecessary.

## Troubleshooting

- Empty project list: select the workspaces in the connection's **Manage access** page.
- Expired or revoked session: the CLI attempts refresh when appropriate; reconnect if refresh fails.
- Callback cannot finish: keep the CLI running and approve from a browser that can reach its loopback callback.
- Headless macOS/Linux without a system keyring: explicitly set `AVORA_CLI_CREDENTIAL_STORE=file` to use an owner-only, unencrypted credentials file. Windows uses Credential Manager.

Continue with [List Workspaces](./cli-workspaces-projects.md), [API & State](./cli-api-state.md), or [Custom Node Authoring](./cli-node-authoring.md).
