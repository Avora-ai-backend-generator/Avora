## 11. Full TypeScript Interface Reference

```typescript
// A single selectable option in a dropdown
interface SelectOption {
  value: string;
  label: string;
  overrideFields?: Record<string, Partial<InputField | SelectField>>; // Modify other fields when selected
  hideFields?: string[];              // Hide these field IDs when selected
  addFields?: ConfigField[];          // Inject new fields into the line
  overrideElements?: Partial<NodeElements>; // Swap out outputs/inputs/logicFlows/errors
}

// A typed input field (adapts widget by fieldType)
interface InputField {
  kind: 'field';
  id: string;
  label: string;
  fieldType: 'text' | 'number' | 'datetime' | 'boolean' | 'string';
  defaultValue?: string;
  placeholder?: string;
  typeConstraint?: { type: string; required: boolean };
  dynamicMatch?: string; // ID of another field whose resolved type this field mirrors
}

// A dropdown selector
interface SelectField {
  kind: 'select';
  id: string;
  label: string;
  options: SelectOption[];
  canCustom: boolean;             // Allow free-text entry beyond preset options
  source?: 'workspace_objects';   // Populate from live workspace objects instead of static list
  chainedTo?: string;             // ID of another select field (workspace object) to filter this list
  relationFilter?: '1:1' | '1:*' | '*:*' | 'composition' | 'aggregation' | 'association';
  defaultValue?: string;
}

// A static display label
interface TextField {
  kind: 'text';
  id: string;
  content: string;                // e.g., "FROM", "WHERE", "To"
}

// A flow-connected variable tag input
interface VariableField {
  kind: 'variable';
  id: string;
  label: string;
  acceptedTypes?: string[];       // Optional type filter for accepted connections
}

type ConfigField = InputField | SelectField | TextField | VariableField;

// Per-attribute customization inside a generic line
interface GenericAttributeConfig {
  attributeId: string;
  hidden?: boolean;
  customLabel?: string;
  widgetOverride?: 'text' | 'number' | 'switcher' | 'datetime' | 'select';
  options?: string;               // Comma-separated values for a select widget
  canCustom?: boolean;            // Allow free-text in the generated select
}

// One visual row in the configuration
interface ConfigLine {
  id: string;
  label?: string;
  lineType: 'required' | 'optional' | 'multiple' | 'generic';
  fields: ConfigField[];
  genericConfig?: {               // Only for lineType: 'generic'
    classId?: string;             // Pre-selected workspace class (optional; user can pick)
    attributeOverrides?: GenericAttributeConfig[];
  };
}

// I/O, flows, and error handles for a variant
interface NodeElements {
  inputs: {
    id: string;
    label: string;
    type: string;
    required?: boolean;
    optional?: boolean;           // Hidden by default; shown in suggestion menu
    userAdd?: boolean;            // User can add multiple named instances
  }[];
  outputs: {
    id: string;
    label: string;
    type: string;
    description?: string;
    optional?: boolean;           // Hidden by default; shown in suggestion menu
    userAdd?: boolean;
  }[];
  logicFlows?: { id: string; label: string }[];
  errors?: {
    id: string;
    condition: string;
    message: string;
    continueOnError: boolean;
  }[];
}

// One operating mode of the node
interface ConfigVariant {
  id: string;
  title: string;
  description?: string;
  lines: ConfigLine[];
  elements: NodeElements;
  onError?: { continueByDefault: boolean };
}

// Top-level node definition
interface ActionNodeConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  category: 'Control Flow' | 'Data' | 'Integration' | 'Transform' | 'Auth' | 'Other';
  variants: ConfigVariant[];
}
```

---

## 12. Full Example: Database Query Node

```json
{
  "id": "db_query",
  "label": "Database Query",
  "icon": "DatabaseIcon",
  "color": "#4b5563",
  "description": "Perform operations on your workspace database entities.",
  "category": "Data",
  "variants": [
    {
      "id": "SELECT",
      "title": "SELECT",
      "description": "Query records from the database",
      "lines": [
        {
          "id": "select_main",
          "lineType": "required",
          "fields": [
            { "kind": "text", "id": "t1", "content": "Run SELECT on" },
            { "kind": "select", "id": "table", "label": "Table", "options": [], "canCustom": true, "source": "workspace_objects" }
          ]
        },
        {
          "id": "select_where",
          "lineType": "multiple",
          "fields": [
            { "kind": "text", "id": "t2", "content": "WHERE" },
            { "kind": "select", "id": "attribute", "label": "Attribute", "options": [], "canCustom": false, "chainedTo": "table", "relationFilter": "1:1" },
            { "kind": "select", "id": "operator", "label": "Operator",
              "options": [
                { "value": "eq", "label": "equals" },
                { "value": "neq", "label": "different from",
                  "addFields": [{ "kind": "field", "id": "value2", "label": "Value 2", "fieldType": "text" }] },
                { "value": "not_null", "label": "not null",
                  "hideFields": ["value1"] },
                { "value": "gt", "label": "greater than" },
                { "value": "between", "label": "between" }
              ],
              "canCustom": false },
            { "kind": "field", "id": "value1", "label": "Value", "fieldType": "text", "dynamicMatch": "attribute" }
          ]
        },
        {
          "id": "select_order",
          "lineType": "optional",
          "fields": [
            { "kind": "text", "id": "t3", "content": "ORDER BY" },
            { "kind": "field", "id": "order_col", "label": "Column", "fieldType": "text" }
          ]
        },
        {
          "id": "select_limit",
          "lineType": "optional",
          "fields": [
            { "kind": "text", "id": "t4", "content": "LIMIT" },
            { "kind": "field", "id": "limit", "label": "Rows", "fieldType": "number" }
          ]
        },
        {
          "id": "select_offset",
          "lineType": "optional",
          "fields": [
            { "kind": "text", "id": "t5", "content": "OFFSET" },
            { "kind": "field", "id": "offset", "label": "Offset", "fieldType": "number" }
          ]
        }
      ],
      "elements": {
        "inputs": [],
        "outputs": [
          { "id": "results", "label": "Results", "type": "any", "description": "The queried records" },
          { "id": "count", "label": "Count", "type": "number", "optional": true }
        ],
        "logicFlows": [
          { "id": "success", "label": "Success" }
        ],
        "errors": [
          { "id": "err_not_found", "condition": "No records found", "message": "Record missing", "continueOnError": false }
        ]
      }
    },
    {
      "id": "INSERT",
      "title": "INSERT",
      "description": "Create new records",
      "lines": [
        {
          "id": "insert_main",
          "lineType": "required",
          "fields": [
            { "kind": "text", "id": "t1", "content": "Insert into" },
            { "kind": "select", "id": "table", "label": "Table", "options": [], "canCustom": true, "source": "workspace_objects" }
          ]
        },
        {
          "id": "insert_data",
          "lineType": "generic",
          "fields": [],
          "genericConfig": {
            "attributeOverrides": [
              { "attributeId": "id", "hidden": true },
              { "attributeId": "created_at", "hidden": true },
              { "attributeId": "hashed_password", "customLabel": "Password" },
              { "attributeId": "gender", "widgetOverride": "select", "options": "Man,Woman", "canCustom": true }
            ]
          }
        }
      ],
      "elements": {
        "inputs": [
          { "id": "payload", "label": "Payload", "type": "object", "required": true }
        ],
        "outputs": [
          { "id": "inserted_record", "label": "Record", "type": "any" }
        ],
        "logicFlows": [
          { "id": "success", "label": "Success" }
        ]
      }
    },
    {
      "id": "UPDATE",
      "title": "UPDATE",
      "description": "Update existing records",
      "lines": [
        {
          "id": "update_main",
          "lineType": "required",
          "fields": [
            { "kind": "text", "id": "t1", "content": "Update" },
            { "kind": "select", "id": "table", "label": "Table", "options": [], "canCustom": true, "source": "workspace_objects" }
          ]
        },
        {
          "id": "update_where",
          "lineType": "multiple",
          "fields": [
            { "kind": "text", "id": "t2", "content": "WHERE" },
            { "kind": "field", "id": "condition", "label": "Condition", "fieldType": "text" }
          ]
        }
      ],
      "elements": {
        "inputs": [
          { "id": "record_id", "label": "Record ID", "type": "string", "required": true },
          { "id": "payload", "label": "Updates", "type": "object", "required": true }
        ],
        "outputs": [
          { "id": "updated_record", "label": "Updated Record", "type": "any" }
        ],
        "logicFlows": [
          { "id": "success", "label": "Success" }
        ]
      }
    },
    {
      "id": "DELETE",
      "title": "DELETE",
      "description": "Remove records",
      "lines": [
        {
          "id": "delete_main",
          "lineType": "required",
          "fields": [
            { "kind": "text", "id": "t1", "content": "Delete from" },
            { "kind": "select", "id": "table", "label": "Table", "options": [], "canCustom": true, "source": "workspace_objects" }
          ]
        }
      ],
      "elements": {
        "inputs": [
          { "id": "record_id", "label": "Record ID", "type": "string", "required": true }
        ],
        "outputs": [],
        "logicFlows": [
          { "id": "success", "label": "Success" }
        ]
      }
    }
  ]
}
```

---

## 13. Built-in Node Library Overview

Avora's default node library is organized by the type of work each node performs.

### Data Nodes
| Node | Variants |
|---|---|
| **Database Query** | SELECT, INSERT, UPDATE, DELETE |
| **Set Variable** | (single) |

### Control Flow Nodes
| Node | Variants |
|---|---|
| **Condition** | Simple compare, Multiple conditions, Switch |
| **Loop** | While, Count, Iterate (for each) |

### Transform Nodes
| Node | Variants |
|---|---|
| **Text** | Split, Join, Template, Regex Extract, Case Convert, Substring |
| **Array** | Sort, Filter, Map (Pick), Slice, Count, Unique |
| **Math** | Expression, Invert Boolean, Random, To Boolean |
| **Date** | Format, Add/Subtract, Difference |
| **JSON** | Parse, Stringify, JSON Path Query |

### Integration Nodes
| Node | Variants |
|---|---|
| **HTTP Request** | GET, POST, PUT, DELETE, Webhook Listener |
| **AI Prompt** | (single) |
| **Gmail** | Send Email |

### Auth Nodes
| Node | Variants |
|---|---|
| **Auth** | Sign Up, Sign In, Refresh Token |

---

## 14. Building Your First Custom Node — Step by Step

1.  **Open the Node Builder panel.**
2.  **Set metadata**: name, category, icon, color, description.
3.  **Decide on variants**: one if the node does a single thing; multiple if it has distinct operating modes.
4.  **For each variant, define required config lines** using text labels, field inputs, and selects to form readable configuration sentences.
5.  **Add optional and multiple lines** for settings that are not always needed. These surface in the suggestion menu automatically.
6.  **Add generic lines** where you need per-attribute data entry (e.g., INSERT forms). Configure attribute visibility, labels, and widgets.
7.  **Define inputs and outputs**: set types, mark required fields, enable `optional` or `userAdd` where appropriate.
8.  **Configure per-option behaviors** on any select field that should show/hide fields, override element types, or inject additional fields.
9.  **Add error handles** for expected failure conditions.
10. **Save and use the node** in any logic flow immediately.

---

## 15. Limitations & Feature Requests

> **Current Limitations**
> - There is **no support for recursive generic objects** yet (a generic line cannot itself contain a nested generic line).
> - You cannot define **custom widget types** beyond the built-ins (text input, number spinner, toggle switch, date picker, dropdown).
> - A generic line's `attributeOverrides` must be configured at build time; runtime-dynamic attribute schemas are not yet supported.

If the provided structure cannot cover your use case, **send a request** to the Avora team. All feature requests are reviewed for potential native integration.
