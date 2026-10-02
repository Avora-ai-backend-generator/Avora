# Keys & Validation

Keys and validation make generated requests predictable before data reaches custom logic.

### Task

Mark the fields that identify records, enforce uniqueness, speed up lookup, or reject invalid input.

| Setting | Use it when | Avoid |
|---|---|---|
| Primary Key | Every record needs a stable identifier | Adding more than one primary identity without a clear reason |
| Required | The backend cannot create a valid record without this value | Marking optional profile or metadata fields as required |
| Unique | No two records can share the value | Applying it to names or labels that may repeat |
| Index | The app searches, filters, or joins by the field often | Indexing every field by default |
| Auto Inc | A numeric identifier should increase automatically | Using it for external IDs, UUIDs, or business codes |
| Validation | The value must match a format rule | Replacing clear field types with complex patterns |

### Steps

1. Give stored entities a reliable identifier.
2. Mark required fields only when the caller must provide them during creation.
3. Use unique for login emails, usernames, slugs, or external references.
4. Add indexes to fields used in frequent filtering or lookup.
5. Add validation patterns after the field name and type are final.
6. Re-run workspace validation before generating code.

### Expected Result

Swagger should show the right required fields, the generated database should protect key constraints, and invalid input should fail before the logic flow depends on it.

### Next

Use [Diagram Builder](./diagram-builder.md#configure-an-attribute) for field settings and [Diagram Builder](./diagram-builder.md#add-validation) for validation rules.
