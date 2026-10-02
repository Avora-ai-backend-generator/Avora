# Review MCP Workspace Edits

On Pro and Team, an AI client can propose changes to an existing project. Avora previews the batch in its editor and lets you accept or reject it before it becomes saved project data.

## Before a proposal

Grant `projects:read` and `projects:write` for the target workspace. Ask the assistant to read the saved graph first. Existing IDs and fields must be preserved unless the requested change removes them.

`avora_edit_workspace` takes `project_id`, a unique `request_id`, a short summary, and up to 100 operations. Supported operations are `ADD_NODE`, `UPDATE_NODE`, `DELETE_NODE`, `ADD_EDGE`, and `DELETE_EDGE`. Array updates replace their arrays, so an update must include the entries that should remain.

## Review and save

1. The assistant submits the proposed batch and returns its change count and full `review_url`.
2. An open, visible, idle editor shows the changes progressively. Otherwise, open the review link to start the preview.
3. Inspect the changes in Avora. Autosave pauses while the proposal is under review.
4. Choose **Accept** to save or **Reject** to discard the proposal.
5. After accepting, wait for the saved-version confirmation. The assistant can call `avora_get_edit_status` to confirm `saved` and obtain the version ID.

`awaiting_review` means the batch is previewed and waiting for your decision. It does not mean the project has been saved. Keep the complete review URL, including `?mcp_review=<batch ID>`; a plain workspace URL cannot reopen the review.

Accepting creates one named `Avora MCP · …` snapshot of the previous graph for undo. Use Avora's existing version history to restore it later. Rejected and empty batches create no version. These graph edits do not deploy a backend or apply database migrations; [preview updates](./mcp-code-previews.md) are separate actions.

## Editing while reviewing

Manual changes made during the review join the accepted batch. Rejecting also discards those changes. Complete unrelated work before beginning a proposal.

An accepted proposal must still match its saved baseline. If another editor has saved a conflicting change, Avora rejects acceptance instead of overwriting it. Read the current graph and prepare a fresh proposal after resolving the conflict.

## Retries and recovery

Reuse the same `request_id` and arguments when retrying the same batch. Use a new ID for a new proposal. Check the existing status before submitting another batch after a connection failure.

Reviews expire after 10 minutes. One editor and one active batch are supported per project. A completed preview can be reopened through its review link before expiry, including after a disconnect. Partial previews, rejected proposals, and pending reviews lost on backend restart cannot be reopened. Saved versions remain in history.

If saving fails, inspect the editor and version history before another attempt. Do not treat an unavailable status as a successful save.
