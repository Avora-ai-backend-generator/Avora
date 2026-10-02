# MCP Tool Reference

Avora exposes 22 tools. Authentication, granted permissions, live membership, and existing account allowances are checked by the server. Start with `avora_connection` to check the connected account and the returned access-management URL.

## Account and project reads

| Tool | Permission | Result |
| --- | --- | --- |
| `avora_connection` | Connection | Account identity, permissions, and access-management link |
| `avora_list_projects` | `projects:read` | Paginated projects selected for this connection |
| `avora_get_project` | `projects:read` | Safe metadata and saved node/edge counts |
| `avora_get_graph` | `projects:read` | Saved node/edge pages, summaries or full configuration |
| `avora_validate_project` | `projects:read` | Shared workspace-validator issues and fix hints |
| `avora_search_catalog` | `projects:read` | Built-ins, request templates, public marketplace nodes, or your clones |
| `avora_get_catalog_item` | `projects:read` | One catalog definition or template |

Graph reads support `node_type`, `node_id`, and `detail`. Follow `next_cursor` with the same filters; pages are live reads. Project environment values and membership lists are omitted. Validation checks workspace rules without executing generated code.

## Private custom node drafts

| Tool | Permission | Result |
| --- | --- | --- |
| `avora_list_drafts` | `drafts:read` | Your paginated private draft summaries |
| `avora_get_draft` | `drafts:read` | Summary, full payload, or a requested JSON Pointer path |
| `avora_create_draft` | `drafts:write` | New private draft and editor URL |
| `avora_update_draft` | `drafts:read`, `drafts:write` | Atomic patch at the expected revision |
| `avora_validate_draft` | `drafts:read` | Draft-save shape, appearance, and size checks |

Draft access belongs to the account and does not require a selected project. Creation requires a unique `request_id`; retry with the same ID and payload to avoid duplication. Updates accept up to 50 JSON Patch `add`, `replace`, `remove`, or `test` operations under `/node_config`, `/code_bundle`, `/icon_name`, and `/usage_markdown`.

After a revision conflict, read the newer draft and reconcile it. For large drafts, request a smaller path such as `/code_bundle/fastapi/variants/main/template`. Draft validation does not compile or execute code, publish a node, or add it to a graph.

## Workspace changes

| Tool | Permission | Result |
| --- | --- | --- |
| `avora_edit_workspace` | `projects:read`, `projects:write`; Pro/Team | Proposal, change count, and review URL |
| `avora_get_edit_status` | Same | Review status and saved undo-version receipt |
| `avora_create_project` | `projects:read`, `projects:create`; Pro/Team | Workspace with initial graph and optional source/preview |

Existing projects use the [workspace review flow](./mcp-workspace-edits.md). Creation accepts an initial graph without opening a canvas. Optional generation adds `code:read`; an optional preview also adds `previews:manage`.

## Source, issues, and hosted previews

| Tool | Permission | Result |
| --- | --- | --- |
| `avora_generate_code` | `projects:read`, `code:read` | Generated FastAPI source file list or blocking issues |
| `avora_read_generated_file` | Same | Bounded generated-file content at a character offset |
| `avora_get_issues` | `projects:read` | Saved validation or latest browser Issues report |
| `avora_start_preview` | `projects:read`, `previews:manage` | Start a hosted preview; `update=true` deploys the saved changes |
| `avora_get_preview` | Same | Your preview readiness, status, and URL |
| `avora_get_preview_logs` | Same | Bounded, redacted tail of your preview logs |
| `avora_stop_preview` | Same | Stop your session and settle the preview allowance |

These eight workflows work on Free and paid plans within existing allowances. Source preview does not charge a ZIP export. Hosted preview start/update executes generated code and consumes preview time.

## Pagination and limits

Pages contain 1–100 items within a 96 KiB output budget. Read tools allow 120 calls per account per minute; validation allows 10, and draft writes allow 30. Workspace validation supports up to 5,000 nodes and 10,000 edges. Draft saves retain the existing 2 MB payload limit.

Generated file content uses `next_offset`, with at most 12,000 characters per read. Generation cache expires after 15 minutes or on backend restart/eviction. Preview logs return up to 200 lines and a bounded text tail. Use returned IDs and pagination fields instead of guessing filenames or project IDs.
