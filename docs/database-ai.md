# Database AI

Use Database AI to explore and change live workspace data with natural language after the Database view has inspected a ready PostgreSQL target.

Database AI does not run blindly. It prepares insert, update, delete, and relation operations, validates them against the inspected schema and visible rows, then asks you to review the changes before applying them.

*Database AI review: Database view showing a natural-language data prompt, generated database operations, review controls, and affected rows.*

## Explore Data

Use AI exploration when you want help understanding the visible table data before editing it.

Before using Database AI:

1. Open a workspace.
2. Open **Database** from the navbar.
3. Select **Inspect database**.
4. Confirm any required reset only when the target is safe to refresh.
5. Wait until the database status is **Ready**.
6. Filter, sort, or open the tables that should be included in the AI context.

The prompt sees the inspected schema and the visible page of table rows. If the needed records are not visible, filter or navigate to them first.

Good exploration prompts include:

- "Summarize the visible orders and flag rows that look incomplete."
- "Which customers in this page are missing contact details?"
- "Explain the relation between these appointment and patient rows."
- "Find rows that look ready for deletion but do not change anything yet."

When you only want analysis, make that explicit. For example: "Explain the visible data, do not modify records."

## Manage Records

Use AI management when you want Avora to prepare database changes from a natural-language instruction.

Supported change types include:

| Operation | What it can do |
| --- | --- |
| **Insert rows** | Create one or more rows in generated entity tables. |
| **Update rows** | Change editable fields on rows visible in the current table page. |
| **Delete rows** | Remove selected or visible rows when the prompt clearly asks for deletion. |
| **Set relations** | Add, remove, or replace relationships between rows when the referenced records are visible or were inserted earlier in the same suggestion. |

To manage records with AI:

1. Inspect the database and confirm the status is **Ready**.
2. Open the table or rows involved in the change.
3. Use filters so the relevant rows are visible.
4. Type the data change in the prompt bar.
5. Add a file attachment if it contains the source data.
6. Send the prompt.
7. Review the summary and generated operations.
8. Accept the operations to apply them, or reject them to leave the database unchanged.

**Result:** accepted operations are sent to the database and the affected tables reload.

### Safety Rules

Database AI validates changes before review:

- It limits large operation batches.
- It rejects unknown entities, unknown fields, and invalid enum values.
- It blocks primary-key edits on existing rows.
- It requires referenced relation rows to be visible or created in the same AI suggestion.
- It asks for review before applying any generated operation.

Use Database AI for development data, demos, QA setup, and controlled cleanup. For production data, confirm the database target, filters, and operation summary before accepting changes.

Continue to [Custom Node AI](./custom-node-ai.md) to use AI while building reusable logic nodes.
