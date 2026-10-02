# Overview

Start with Avora's core model, then move into setup, workspace navigation, and canvas behavior.

## Platform Overview

Avora is a visual-first software development platform that enables developers, startup founders, and technical teams to design backend systems visually using a canvas-based UML/entity diagram editor, then generate production-ready code automatically using AI. The core philosophy: *software architecture should begin with a sketch, not boilerplate.*

Users draw class diagrams, define entity relationships, configure API request nodes, and describe their system in natural language — Avora converts all of this into a deployable FastAPI (Python) backend project, complete with SQLAlchemy models, Pydantic schemas, CRUD services, routers, auth, Docker configs, and more.

---

## 1. Getting Started

These steps cover account setup, workspace creation, and the main product areas users see first.

### 1.1 Account & Authentication
- Users register with email/password or via OAuth (Google, GitHub)
- JWT access tokens + refresh tokens are issued on login
- Token stored in `localStorage` as `access_token` and `refresh_token`
- Session is automatically restored on app load via `initSession()`
- Subscription tiers: `free`, `pro`, `team` — each unlocking different features

### 1.2 Creating Your First Workspace
- Navigate to `/workspace` after login
- A workspace is a collaborative canvas environment. Click the `+` icon in the left sidebar to create one
- Each workspace has a name, description, and is associated with the creating user as `owner`
- Workspaces support multi-user collaboration: members can be added by sharing the workspace URL
- Clicking a shared workspace URL automatically triggers a "join" operation, adding the visitor as a member

### 1.3 Understanding the Interface
- **Left Sidebar**: Workspace list, node list, file tree (in Code view), settings/logout
- **Main Canvas**: ReactFlow-based infinite canvas for diagram editing
- **Right Sidebar**: Drag-to-add node palette, selected node property editor (attributes, types, metadata, validations)
- **Bottom Toolbar**: AI assistant toggle, cursor/hand tools, undo/redo, auto-layout, fit view
- **Top Header**: View switcher (Diagram / Requests / Code), Share button, Version History, Validation issues counter

---

## 2. Canvas & Views

The canvas is split into focused views so modeling, API design, and generated code stay organized.

### 2.1 View Modes

The workspace has three distinct views toggled via the top header:

| View | Purpose |
|---|---|
| **Diagram** | UML-style class and enum node editor for data modeling |
| **Requests** | REST API endpoint designer with grouped lanes |
| **Code** | Read-only Monaco editor previewing generated backend code |

Each view filters the canvas to show only relevant nodes. Comment and Draw nodes respect the view they were created in.

### 2.2 Canvas Interaction
- **Double-click on empty canvas**: Creates a `BaseNode` (smart node that converts to Class/Enum/Comment/Draw via slash commands)
- **Drag from Right Sidebar**: Drop `Entity`, `Enum`, `Request`, `Lane`, `Comment`, or `Sketch Board` nodes onto the canvas
- **Select nodes**: Click to select, drag to multi-select
- **Pan**: Hold `Hand` tool or middle-click drag
- **Zoom**: Scroll wheel
- **Snap to grid**: 20×20 grid snapping enabled by default

### 2.3 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` / `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected nodes |
| `Ctrl/Cmd + V` | Paste nodes |
| `Ctrl/Cmd + D` | Duplicate selected nodes |
| `Escape` | Cancel linking mode |

### 2.4 Feature Visual System

The Avora landing experience uses the same structural language as the product UI. Instead of isolated icon cards, each feature is represented with a **mini container visualization** that reflects real runtime objects.

| Visual Container | Product Object | What It Shows |
|---|---|---|
| **Workspace Container** | Workspace graph state | Entity graph, request lanes, and live sync indicators |
| **Template Container** | Node template config | Config variants, reusable logic blocks, template lifecycle |
| **Session Container** | Preview/deploy session | Status progression, session health, and environment lifecycle |

Section-level visualization strategy:
- **Core Features** use **graph modules**: connected nodes and state rails that mirror architecture mapping.
- **Integrations** use **pipeline containers**: source -> transform -> output flow to explain imports clearly.
- **AI Features** use **console/deploy panels**: prompt logs, status ticks, and runtime indicators.

Animation principles:
- **Hover lift + depth** to communicate interactive objects rather than static marketing tiles.
- **Sub-element stagger** (rows/chips/cards) so users can read hierarchy immediately.
- **Light status motion** (pulse/progress/indicator) to imply live system state.
- **Low-motion baseline** that preserves readability in both desktop and mobile layouts.

These visuals are intentionally tied to Avora domain concepts, so page design stays product-authentic and does not resemble generic AI-generated landing patterns.
