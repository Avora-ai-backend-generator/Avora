# MCP Code, Issues, and Previews

Use MCP to inspect generated FastAPI source, diagnose a project's issues, and run a hosted backend preview. These workflows work on Free and paid accounts within the same preview allowances as Avora's web app.

## Read generated source

Grant `projects:read` and `code:read`, then call `avora_generate_code` for a selected project. Generation uses the saved graph and returns a file list, a `generation_id`, and pagination information. A blocked result returns validation issues instead.

Call `avora_read_generated_file` with the returned project ID, generation ID, and path. Follow character offsets to read a large file. Environment values are omitted. This is source preview rather than a ZIP download and does not charge a ZIP export.

Cached source lasts up to 15 minutes and can be lost on backend restart or eviction. Generate again if the cache is unavailable. Save an accepted workspace edit before generating code for that edit.

## Inspect the right issues

`avora_get_issues` accepts two sources:

| Source | What it represents |
| --- | --- |
| `saved` | Backend validation of the saved workspace graph |
| `editor` | Latest dated report from the browser's Issues list, including its logic/runtime checks |

An editor report can be stale or include unsaved changes. Open the project in Avora to publish its current Issues list. An unavailable report does not mean the project has no issues. Use preview logs for failures in the hosted application.

## Run a hosted preview

Grant `projects:read` and `previews:manage` for the project.

1. Call `avora_start_preview` with its project ID.
2. Follow the returned status with `avora_get_preview`, using the returned session ID. During startup, wait at least the returned polling interval, normally 10 seconds.
3. Share or open the URL only after `ready=true` and status is `running`.
4. Use `avora_get_preview_logs` to diagnose startup or runtime failures.
5. Call `avora_stop_preview` when finished to settle the session's allowance.

Repeated starts reuse the session. To deploy the current saved graph into an existing preview, explicitly call `avora_start_preview` with `update=true`. A starting, reloading, or failed session is not a working preview. Known workspace environment values and credential patterns are redacted from returned logs.

## Create a backend with source and a preview

On Pro or Team, `avora_create_project` can create a workspace with its initial graph, generate source, and optionally start a preview. It requires `projects:read` and `projects:create`; generation needs `code:read`, and a preview also needs `previews:manage`.

Ask the assistant to consult the catalog, construct the graph, then supply a unique `request_id`, name, and graph. `generate_code` defaults to `true`; `start_preview` defaults to `false`. Creation supports up to 200 nodes and 400 edges. Larger projects can grow through [reviewed batches](./mcp-workspace-edits.md).

The new workspace is automatically shared with the creating connection and does not require an open canvas. Reuse the same ID and arguments on retries. If generation or preview fails, the workspace remains saved: fix the returned project ID instead of creating a duplicate. Continue checking preview status until it is ready or has failed.

Existing projects always use the review flow for graph edits. Creating a project does not bypass reviews on later changes.
