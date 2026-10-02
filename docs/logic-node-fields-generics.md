## 5. Select Field — Advanced Behaviors

Select fields can drive more advanced node behavior than a static dropdown.

### 5.1 Custom Values

A `select` field can allow **free-text entry** (`canCustom: true`), letting the user type a value that is not in the preset option list.

> **Example:** A gender attribute dropdown lists "Man" and "Woman". With `canCustom` enabled, the user can type "Non-binary" and add it as a custom option.

### 5.2 Workspace Object Source

A `select` can be sourced from the **workspace's live object list** instead of a static enum. The dropdown then shows all existing entities of that type.

> **Example:** An "Append Object" node has a select field populated by all existing workspace objects.

### 5.3 Related Field (Chained Object Select)

When two or more `select` fields in the same node are both sourced from workspace objects, a second select can be **chained** to the first — its list is filtered to show only items related to the object chosen in the first select.

You can further refine this by specifying the **relationship type** between the two entities (1:1, 1:*, composition, aggregation, association) to narrow the sub-entity list.

> **Example:** Select "Order" in the first field. The second field, chained to it, shows only "OrderItem" records linked to that order.

### 5.4 Per-Option Dynamic Behaviors

When a specific option is chosen from a `select` field, that option can trigger one or more of the following side-effects within the same configuration line:

| Behavior | Description |
|---|---|
| **Hide field** | Hides one or more other fields in the line when this option is active. |
| **Override field** | Modifies the configuration of another field in the line (changes its type, placeholder, label, etc.). |
| **Add field** | Injects an additional field (label, input, or select) into the line. |
| **Override elements** | Replaces the variant's inputs, outputs, logic flows, or error handles entirely for this option. |

> **Example — Override field:** A condition line with `[attribute select] [operator select] [value input]`. If the user picks an attribute of type `string`, the value input is a text box. If they pick type `int`, it becomes a number counter.

> **Example — Hide field:** A filter line with `[value1] [operator] [value2]`. If the user picks "not null", `value2` is hidden. If they pick "between", both `value1` and `value2` are shown.

> **Example — Add field:** Same filter line. If the user picks "different from" instead of "not null", an additional `value2` field is injected.

> **Example — Override elements:** Selecting "top value" from an aggregation select changes the node's output to `topValue`. Selecting "smallest value" changes it to `smallestValue` and may add a new output port.

---

## 6. Field Constraints

Field constraints keep custom node configuration valid before the workflow runs.

### 6.1 Type Constraint

A `field` can declare an explicit `typeConstraint` to enforce that the value entered matches a specific type. If the constraint is `required: true`, the node surfaces a validation error when the type is not satisfied.

### 6.2 Dynamic Type Match (`dynamicMatch`)

A field can use `dynamicMatch` to automatically mirror the resolved type of another field in the same node. This is useful for comparison lines where the second value must match the first.

> **Example:** A "Compare Values" line has `value1` (type: any, connected to a flow variable) and `value2`. With `dynamicMatch` pointing to `value1`, `value2` automatically inherits `value1`'s resolved type and shows an error if they don't match.

---

## 7. Generic Lines

The **Generic Line** is the most powerful line type. It dynamically expands into one sub-line per attribute of a selected workspace class.

### 7.1 How It Works

1. The user selects a **class** from the workspace (e.g., "User", "Product").
2. The line auto-generates one sub-field per attribute of that class.
3. Attributes inherited from parent classes appear below a separator labeled **"Inherited from [ClassName]"**.
4. Relation-driven sub-lines are also generated based on workspace edges:

| Edge Multiplicity | Generated Sub-line |
|---|---|
| **1:1** | Nested inline object fields |
| **1:*** or ***:*** | Repeatable list builder |
| **Composition** | Create-with-object (child is created together with parent) |
| **Aggregation** | Connect-to-existing (pick an existing entity by ID) |
| **Association** | Simple ID reference input |

### 7.2 Per-Attribute Customization

For each generated sub-line, the builder exposes the following customization options:

| Option | Description |
|---|---|
| **Hide** | Removes this sub-line from the node UI entirely. Useful for system-managed fields like `id` or `created_at`. |
| **Custom label** | Override the attribute name with a human-readable label (e.g., rename `hashed_password` → `Password`). |
| **Custom widget** | Override the default widget: force a string attribute to use a date picker, a switcher, a number counter, etc. |
| **Options** | Provide comma-separated values to turn a `text` attribute into a dropdown menu. (e.g., a `gender` attribute becomes a select with "Man, Woman" options — and can also support custom values.) |
| **Default widget** | For attributes without a custom override, the builder assigns defaults: `text` → text input, `number` → counter, `boolean` → switcher. |

> **Example:** The `id` field is hidden. The `created_at` field is hidden. The `hashed_password` field is relabeled to "Password". The `status` string attribute is given options "Active, Inactive, Pending".

---
