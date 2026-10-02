# API & State

Control which Avora backend the CLI uses and where it saves authentication and project-tracking data.

## Task

Choose a stable API base URL and, when needed, move CLI state to a writable or isolated directory.

## Prerequisites

- The URL of the Avora backend you intend to use.
- A writable local directory for CLI state.

## Find This in Your Terminal

The API URL is resolved in this order:

1. The command's `--api <url>` option.
2. The `AVORA_API_URL` environment variable.
3. The API URL saved during the last login.
4. `http://localhost:8000`.

State is stored in the first writable location in this order:

1. The directory set by `AVORA_CLI_HOME`.
2. `~/.avora-cli`.
3. `.avora-cli` in the current directory.

The state filename is `projects.json`.

## Steps

Set an API URL for the current shell:

```bash
export AVORA_API_URL="https://api.example.com"
avora login
```

Or override it for one login:

```bash
avora login --api https://api.example.com
```

To isolate CLI state in a specific directory:

```bash
export AVORA_CLI_HOME="/path/to/avora-state"
avora projects
```

## Expected Result

Future authenticated requests use the saved login endpoint unless a command or environment variable overrides it. The state file contains account/connection metadata and tracked Avora and Git project locations. Session tokens use the system credential store. On headless macOS/Linux, an explicit `AVORA_CLI_CREDENTIAL_STORE=file` option uses an owner-only, unencrypted `credentials.json` file beside it.

> **Protect credentials.** Keep CLI state and credential files out of version control. Legacy state can still contain tokens until migrated; the explicit file credential store is unencrypted.

## Next Step

Use [Pull Code](./cli-workspaces-pull.md) to pull an Avora project, or [Connect Repository](./cli-git-connect.md) to connect a repository.

## Troubleshooting

- Browser sessions are bound to the server approved at login. Sign in again to change servers.
- If the CLI still reaches the wrong server, check for an existing `AVORA_API_URL` value because it takes priority over the saved login URL.
- If state appears to reset between commands, verify that each shell uses the same `AVORA_CLI_HOME` value.
- If the state file is invalid JSON, move it aside and sign in again; tracked project entries must then be recreated.
