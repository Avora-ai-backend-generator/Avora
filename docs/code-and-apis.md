# Code & APIs

This section explains how Avora turns workspace diagrams into generated backend code and API routes.

## 7. Code Generation

Code generation converts canvas entities, relationships, requests, and settings into a project structure.

### 7.1 Configuring the Generator

In the **Code** view, the right sidebar shows generation settings:
- **Project Name**: Used as the root package name
- **Framework**: FastAPI (Python) — Spring Boot coming soon
- **Database**: PostgreSQL or MongoDB
- **Features**: Auth is included by default

### 7.2 Generated Project Structure (FastAPI)

```
project_name/
├── app/
│   ├── main.py                    # FastAPI app entry, router inclusion
│   ├── core/
│   │   ├── config.py              # Pydantic settings from .env
│   │   ├── database.py            # SQLAlchemy engine + session
│   │   └── security.py            # JWT creation, password hashing
│   ├── models/
│   │   ├── enums.py               # SQLAlchemy Enum types
│   │   └── {entity}.py            # SQLAlchemy ORM model per entity
│   ├── schemas/
│   │   └── {entity}.py            # Pydantic schemas (Base, Create, Update, Response)
│   ├── services/
│   │   └── {entity}_service.py    # CRUD operations + relationship management
│   └── api/
│       ├── deps.py                # Auth dependency injection
│       └── v1/endpoints/
│           ├── auth.py            # Login, signup, refresh (if auth enabled)
│           └── {entity}.py        # Full CRUD router per entity
├── requirements.txt
├── .env
├── Dockerfile
├── docker-compose.yml
├── reset_db.py                    # Development DB reset utility
└── README.md
```

### 7.3 Relationship Handling in Generated Code

| Diagram Multiplicity | Generated ORM | Foreign Key Location |
|---|---|---|
| `1:1` | `relationship(..., uselist=False)` | FK on source entity |
| `1:*` | `relationship(...)` one side + FK | FK on target entity |
| `*:1` | `relationship(...)` many side + FK | FK on source entity |
| `*:*` | Association table auto-created | Junction table with two FKs |
| Composition | `cascade="all, delete-orphan"` | Standard FK |
| Aggregation | `ondelete="SET_NULL"` | Nullable FK |
| Inheritance | `__mapper_args__` with `polymorphic_on` | PK is also FK to parent table |

### 7.4 Auth Feature

When auth is enabled and a `User` entity exists, the generator automatically:
- Injects `email`, `is_active`, `is_superuser` fields if missing
- Creates a `hashed_password` column
- Generates JWT-based `login`, `signup`, and `refresh-token` endpoints
- Generates `OAuth2PasswordBearer` dependency for protected routes
- Creates `Token` and `TokenPayload` Pydantic schemas

### 7.5 Downloading & Deploying
- **Generate & Preview**: Renders files in the Monaco editor Code view — navigable via file tree
- **ZIP Download**: Full project as `.zip` archive
- **Local Generate**: Server writes files directly to a specified absolute path on the server machine
- **Publish to GitHub**: Creates a new private repository and pushes all files (requires GitHub OAuth connection)

### 7.6 Code Caching

Generated code is cached in-memory per workspace using a hash of the current node/edge state. If the diagram changes after generation, an "outdated" indicator appears with a pulsing orange dot prompting regeneration.

---

## 8. Requests View & API Design

The Requests view turns modeled entities into editable endpoint lanes and request nodes.

### 8.1 Lanes (GroupelineNode)

Each Class entity automatically gets a corresponding Lane in the Requests view. Lanes are vertical columns that group related API endpoints.

- Lane header shows the entity name and endpoint count
- Collapse/expand via the chevron button
- Drag to reorder lanes horizontally

### 8.2 CRUD Auto-Generation

When a new Class node is created, 5 default Request nodes are automatically generated:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/entityname` | List all |
| `GET` | `/entityname/:id` | Get by ID |
| `POST` | `/entityname` | Create |
| `PUT` | `/entityname/:id` | Update |
| `DELETE` | `/entityname/:id` | Delete |

### 8.3 Request Node Editing
- Click the method badge to change HTTP method
- Edit group, path, URL, and body inline
- Nodes are non-draggable (auto-positioned within their lane)
- Download a request as a `curl` `.sh` file via the Download action

---

## 9. Version Control

Versions let teams save, review, and restore snapshots of workspace state.

### 9.1 Saving Versions

Click **Versions** in the top header. Enter a version name (e.g., `v1.0`, `pre-auth-refactor`) and click **Save**. A snapshot of all nodes and edges is stored with author and timestamp metadata.

### 9.2 Restoring Versions

In the Versions panel, click the restore icon (↺) next to any saved version. This **overwrites the current workspace state** with the snapshot — all current changes are replaced.

### 9.3 Version History

Each version entry shows:
- Version name
- Creation date and time
- Created by (username)

---

## 14. API Reference (Backend)

**Base URL:** `https://your-domain.com/api/v1`

**Authentication:** Bearer token in `Authorization` header

**Auth Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login with email + password (form-data), returns JWT pair |
| `POST` | `/auth/signup` | Register new user, returns JWT pair |
| `POST` | `/auth/refresh` | Exchange refresh token for new access token |
| `GET` | `/oauth/login/google` | Redirect to Google OAuth |
| `GET` | `/oauth/login/github` | Redirect to GitHub OAuth |

**Workspace Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/workspaces` | List user's workspaces |
| `POST` | `/workspaces` | Create workspace |
| `PUT` | `/workspaces/{id}` | Update workspace name/description |
| `DELETE` | `/workspaces/{id}` | Delete (owner) or leave (member) workspace |
| `POST` | `/workspaces/{id}/join` | Join a workspace by ID |
| `GET` | `/workspaces/{id}/graph` | Fetch all nodes and edges |
| `POST` | `/workspaces/{id}/sync` | Batch upsert/delete nodes and edges |
| `GET` | `/workspaces/{id}/export` | Export workspace as JSON |
| `POST` | `/workspaces/import` | Import workspace from JSON |
| `GET` | `/workspaces/{id}/versions` | List saved versions |
| `POST` | `/workspaces/{id}/versions` | Create a version snapshot |
| `POST` | `/workspaces/{id}/versions/{vid}/restore` | Restore a version |

**AI Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ai/stream` | Stream entity generation from text prompt |
| `POST` | `/ai/stream-node` | Stream entity from uploaded image |
| `POST` | `/ai/stream-node-update` | Stream autocomplete for existing node |
| `POST` | `/ai/stream-workspace` | Stream multi-operation workspace modifications |

**Generator Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/generator/download` | Generate and download project as ZIP |
| `POST` | `/generator/generate-local` | Write project to server-side path |

**WebSocket:**

`WS /api/v1/ws/{workspace_id}?token={jwt}`

Messages: `GRAPH_UPDATE`, `CURSOR_MOVE`, `STATUS`, `WORKSPACE_UPDATE`, `USER_LEFT`
