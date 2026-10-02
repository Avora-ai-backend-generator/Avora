# Entities & Fields

Entities are the records your backend stores. Fields are the values stored on those records.

### Task

Create entities and fields that are clear enough for Avora to generate database models, schemas, and useful API inputs.

### Steps

1. Use singular entity names such as `User`, `Order`, `Product`, or `TeacherProfile`.
2. Add only fields that belong to the record itself.
3. Use relationships for links to other stored records instead of duplicating the other record's fields.
4. Choose the narrowest useful field type, including workspace enums when the value must come from a fixed set.
5. Add descriptions when a field name is not enough for AI, teammates, or generated docs.

| Field decision | Use it when | Example |
|---|---|---|
| Normal field | The value belongs directly to this record | `Product.price` |
| Enum field | The value must be one of a fixed list | `User.role` |
| List field | One record stores several simple values | `Article.tags` as text list |
| Relationship | The value points to another stored record | `Order` connected to `Customer` |
| Profile entity | Role-specific user data should stay separate | `TeacherProfile`, `StudentProfile` |

### Expected Result

Each entity should describe one backend object cleanly, with fields that can become database columns and request fields without extra interpretation.

### Next

Use [Diagram Builder](./diagram-builder.md#entity-attributes) for the full attribute workflow.
