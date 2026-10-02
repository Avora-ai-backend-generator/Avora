# Backend and Frontend URLs

Point the extension's API operations and embedded node tester at the same Avora environment.

## Task

Set valid HTTP or HTTPS base URLs before signing in, loading workspaces, or opening the tester.

## Prerequisites

- You know the backend API and frontend web addresses for your Avora environment.
- Both services are reachable from VS Code.

## Find This in VS Code

Run `Avora: Set Backend URL` and `Avora: Set Frontend URL`, use the matching account actions, or edit the values in `Avora: Open Settings`.

## Steps

1. Set `avora.apiBaseUrl` to the API base, including `/api/v1` when required.
2. Set `avora.webBaseUrl` to the frontend origin and optional base path, without the tester route.
3. Use only `http://` or `https://` URLs.
4. Sign in again if the backend changed to a different environment.
5. Refresh projects and published nodes.
6. Open the node tester and confirm the frontend serves `/extension/logic-node-tester`.

When an API URL contains only an origin, the extension adds `/api/v1`. Trailing slashes are removed. For a local frontend, the tester checks both `localhost` and `127.0.0.1` and uses the reachable alternative.

## Expected Result

Login, workspace data, generation requests, and the embedded tester all use the intended Avora environment.

## Next Step

[Sign in](./extension-sign-in.md) and configure [local project folders](./extension-settings-folders.md).

## Troubleshooting

- If login fails immediately, open the backend URL in a browser or check the local API process.
- If sidebar data works but the tester is blank, the backend is reachable but the frontend URL or tester route is not.
- If data appears from the wrong environment, log out, correct both URLs, and sign in again.
- Avoid mixing a production backend with an unrelated local frontend.
