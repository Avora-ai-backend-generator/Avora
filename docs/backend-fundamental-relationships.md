# Relationships

Relationships explain how records connect. In Avora, relation type, multiplicity, direction, and foreign-key owner can change the generated database and request shape.

### Task

Choose the relationship that matches how records are created, reused, and deleted.

| Relation | Use it when | Typical request shape |
|---|---|---|
| Association | Records exist independently but reference each other | Existing ID or ID list |
| Aggregation | A parent groups reusable children without owning their lifecycle | Existing ID or ID list |
| Composition | The child is part of the parent and is usually created with it | Nested object or nested list |
| Inheritance | One entity shares or extends another entity's model behavior | Not a normal CRUD link |

### Multiplicity

| Multiplicity | Read it as | Common backend shape |
|---|---|---|
| `1:1` | One record connects to one record | One foreign key, often unique |
| `0:1` | One optional record | Nullable foreign key |
| `1:*` | One parent has many children | Foreign key on the child side |
| `*:1` | Many records share one parent | Foreign key on the source side |
| `*:*` | Many records connect to many records | Hidden join table, usually exposed as ID lists |

### Foreign Key Owner

Avora does not show generated foreign-key columns as normal entity attributes. The diagram stays focused on the domain model, while the generator creates the required database key from the relationship edge.

The highlighted multiplicity side in the Diagram Builder shows which entity owns the foreign key. Use **Auto** unless the backend flow requires a specific owner.

| Relationship shape | Default foreign-key owner |
|---|---|
| `1:*` or `0:*` | Target side, usually the child or many-side record |
| `*:1` | Source side, usually the many-side record |
| `1:1` or `0:1` association | Auto-selected side, with **Src** or **Tgt** override available |
| `*:*` | Hidden join table |

For auth profiles, prefer the profile owning the user reference:

```text
User 1 -------- 1 TeacherProfile
TeacherProfile owns user_id
```

This lets a user sign up first, then create or attach the role-specific profile without requiring a profile ID during signup.

### Next

Use [Diagram Builder](./diagram-builder.md#relationships) for creating edges and [Diagram Builder](./diagram-builder.md#configure-a-relationship) for relationship controls.
