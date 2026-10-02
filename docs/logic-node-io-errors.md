## 8. Inputs & Outputs — Advanced Options

Inputs and outputs define what a node receives, returns, and exposes to the rest of the flow.

### 8.1 User-Defined Count (`user add`)

By checking **"user add"** on an input or output, the user can add as many instances of that element as they want, each with a custom name.

> **Example:** A "Merge Variables" node has a `variable` input with `user add` enabled. The user adds `firstName`, `lastName`, `email` as separate named inputs and wires them individually.

### 8.2 Optional Elements

Checking **"optional"** on an input or output means that element is **hidden by default** when the node is first placed on the canvas. It only appears in the suggestion menu when the user explicitly adds it.

This keeps the canvas clean for the most common use cases while still exposing advanced capabilities on demand.

> **Example:** A Database SELECT node's `offset` output is optional. Most users don't need it. It appears in the suggestion menu for users who do.

---

## 9. Suggestion Menu — Level Hierarchy

The suggestion menu operates at two distinct levels, guiding the user progressively:

| Level | When active | Shows |
|---|---|---|
| **Level 0** | Node is empty (no variant selected yet) | Variant propositions only |
| **Level 1** | Variant is selected | Optional lines, multiple lines, and optional elements available for that variant |

This hierarchy ensures that:
- New users aren't overwhelmed by all options upfront.
- Power users can always access advanced lines or elements without cluttering the default view.

---

## 10. Error Handles

Each variant can define one or more **Error Handles** — named failure conditions that the node can emit at runtime.

| Property | Description |
|---|---|
| `id` | Unique identifier for this error condition |
| `condition` | Human-readable description of when this error is triggered |
| `message` | The error message surfaced to the runtime / user |
| `continueOnError` | If `true`, execution continues down the error logic flow. If `false`, execution halts. |

Error handles can be **static** (defined in the variant's `elements`) or **dynamically overridden** by a select option's `overrideElements` behavior (see §5.4).

---
