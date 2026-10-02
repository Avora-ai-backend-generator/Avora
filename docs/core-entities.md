# Core Entities

Core entities are the visual objects and connections that define an Avora workspace.

## 3. Node Types

Node types represent the main objects users add, edit, and connect on the canvas.

### 3.1 Class Node (Entity)

Represents a database entity / ORM model.

- **Name**: Double-click the header to rename. Names should be `PascalCase`.
- **Attributes**: Each attribute is a `name: type` string (e.g., `email: string`, `age: integer`, `status: UserStatus`)
- **Primary Key**: Click the yellow dot next to an attribute to toggle it as the primary key
- **Visibility**: Click the lock/globe/shield icon to cycle between `public`, `private`, `protected`
- **Type Autocomplete Dropdown**: Supports primitive types and any Enum nodes currently on the canvas
- **Attribute Metadata** (via Right Sidebar when attribute is selected):
  - `isPrimaryKey` — marks as PK
  - `isUnique` — adds unique constraint
  - `isIndex` — adds database index
  - `nullable` — marks field as optional
  - `autoIncrement` — auto-increment integer ID
  - `defaultValue` — scalar default
  - `validations` — regex pattern + error message list
  - `description` — free-text field description

**Supported Primitive Types:**
`string`, `number`, `boolean`, `Date`, `UUID`, `text`, `integer`, `float`, `json`, `blob`

### 3.2 Enum Node

Represents an enumeration type.

- **Name**: PascalCase (e.g., `UserStatus`, `OrderType`)
- **Values**: UPPER_CASE convention (e.g., `ACTIVE`, `PENDING`, `DELETED`)
- Enum names can be used as attribute types inside Class nodes
- Enum nodes cannot participate in edges (no relationships)

### 3.3 Request Node

Represents a REST API endpoint.

- **Method**: `GET`, `POST`, `PUT`, `DELETE`, `PATCH` — color coded
- **Group**: Associates the request with a Class lane (auto-populated when created from a Class)
- **Path**: Short endpoint path (e.g., `List`, `Get`, `Create`)
- **URL**: Full URL pattern (e.g., `/users/:id`)
- **Body**: JSON body template

### 3.4 Comment Node

Yellow sticky-note style annotation. Stores:
- Free text content
- Author username + user ID
- Creation timestamp
- View association (Diagram / Requests)

### 3.5 Sketch Board (Draw Node)

Freehand SVG drawing canvas embedded as a node. Supports:
- Pointer-based drawing with configurable color and stroke width
- Resizable via node resizer handle
- Exportable as JPEG
- AI generation from drawing: click the ✨ sparkle button to convert sketch to a Class or Enum entity

### 3.6 Base Node

Temporary input node created on double-click. Supports:
- Typing a name → press `Tab` to trigger AI generation
- Typing `/class`, `/enum`, `/comment`, `/draw` to convert via slash command menu
- Arrow key navigation in the command dropdown

---

## 4. Relationships & Edges

Edges define how entities relate to each other and how those relationships translate into backend behavior.

### 4.1 Creating Connections
- Drag from the bottom handle of a Class node to another node
- Or use the `Connect` (↑) button in the Node Actions Toolbar
- Click a target node to complete the connection
- If no target exists, releasing on empty canvas creates a new connected Class node automatically

### 4.2 Edge Types

| Type | Visual | Behavior in Code |
|---|---|---|
| **Association** | Plain line | Simple relationship reference |
| **Inheritance** | Empty triangle at target | `extends` / parent class mapping |
| **Realization** | Dashed + empty triangle | Interface implementation |
| **Dependency** | Dashed + open arrow | Weak association |
| **Aggregation** | Empty diamond at source | `SET_NULL` on delete |
| **Composition** | Filled diamond at source | `CASCADE` on delete |

### 4.3 Multiplicity

| Notation | Meaning |
|---|---|
| `1:1` | One to one |
| `1:*` | One to many |
| `*:1` | Many to one |
| `*:*` | Many to many (creates junction table) |
| `0:1` | Zero or one (optional) |
| `0:*` | Zero or many (optional many) |

### 4.4 Edge Editor
Click any edge to open the inline editor:
- Change multiplicity
- Change relationship type
- Swap source/target direction
- Delete the edge
- Hover the ℹ️ info button for a human-readable description (e.g., *"User has many Orders. Deleting User deletes Orders."*)

---

## 5. AI Assistant

The AI assistant helps create and update workspace structure from prompts, images, and node context.

### 5.1 Canvas Prompt Bar

Activated via the ✨ sparkle button in the bottom toolbar.

- Type natural language instructions: *"Add a Product entity with name, price, and stock attributes"*
- Use `@EntityName` to mention specific nodes (inserts a chip tag, focuses AI context)
- Attach images (PNG, JPEG) for visual diagram analysis
- Attach code/text files (`.py`, `.ts`, `.json`, `.sql`, etc.) to include as context
- Import from Figma via URL + Personal Access Token

### 5.2 AI Operation Streaming

The AI streams JSON operation objects in real-time:
- `ADD_NODE` — creates a new Class, Enum, or Request node
- `UPDATE_NODE` — modifies an existing node's attributes or label
- `DELETE_NODE` — removes a node and its connected edges
- `ADD_EDGE` — connects two nodes with a specified relationship type and multiplicity
- `DELETE_EDGE` — removes a connection

Each operation is applied immediately as it streams. A **Modification Review** panel appears above the prompt bar listing all changes with icons. You can:
- **Accept All** — confirm all changes
- **Reject All** — roll back every operation using the inverse operation history
- Click any operation entry to fly to that node on the canvas

### 5.3 Model Selection

The AI provider and model are selectable per session:
- Default model configured in **Settings → AI Features**
- Override per-prompt via the model dropdown in the prompt bar
- Vision-capable models (Gemini, GPT-4o, Claude 3.5) are required for image attachments — incompatible models are grayed out when an image is attached

### 5.4 Node-Level AI (Sparkle Button)

Available on Class, Enum, and Draw nodes via the Node Actions Toolbar:
- **Class node**: Suggests 5 relevant attributes using workspace context (existing enums used as types when appropriate)
- **Enum node**: Suggests 5 relevant values
- **Draw node**: Analyzes the sketch and converts it to a Class or Enum with extracted attributes/values

### 5.5 Supported AI Providers

| Provider | Notes |
|---|---|
| **Google Gemini** | Primary provider, streaming JSON schema enforcement |
| **OpenAI (GPT-4o etc.)** | Vision capable, JSON mode |
| **DeepSeek** | Text-only, OpenAI-compatible |
| **OpenRouter** | Multi-model gateway, supports free tier models |
| **Groq** | Ultra-fast inference, Llama models |

---

## 6. Validation System

The workspace runs live validation on every change with a 300ms debounce.

**Class Node Rules:**
- Name cannot be empty
- Name must be `PascalCase` (warning)
- Name cannot be a reserved keyword (error)
- No duplicate attribute names (error)
- Attribute names must be `camelCase` (warning)
- Attribute types must be a valid primitive or existing Enum (error)
- At least one attribute recommended (warning)

**Enum Node Rules:**
- Name cannot be empty (error)
- Name must be `PascalCase` (warning)
- At least one value (warning)
- No duplicate values (error)
- Values should be `UPPER_CASE` (warning)

**Workspace Rules:**
- Class names must be unique across the entire workspace (error)

Validation indicators appear as colored rings on nodes (red = error, yellow = warning) with a tooltip listing issues. The **Issues** button in the top header shows a global panel — click any issue to fly to the offending node.
