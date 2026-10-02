# Advanced Operations

Advanced operations cover collaboration, administration, deployment, and architecture details.

## 10. Collaboration (Pro/Team)

Collaboration features keep multiple users synchronized inside the same workspace.

### 10.1 Real-Time Mode

WebSocket collaboration is available for `pro` and `team` subscription tiers.

When a second user opens the same workspace:
1. Backend detects multi-user occupancy
2. Broadcasts a `STATUS: REALTIME` message
3. All subsequent graph changes are transmitted via WebSocket with ~50ms debounce
4. Graph sync falls back to REST API in Solo mode (1000ms debounce)

### 10.2 Cursor Sharing

Other users' cursors appear as named blue pointers on the canvas. Cursor positions are throttled to a maximum of 20 updates/second. Cursors are removed immediately when a user disconnects.

### 10.3 Sharing a Workspace

Click the **Share** button in the top header. The workspace URL is copied to clipboard. Any user who visits the URL is automatically added as a member via the `join` API endpoint.

---

## 11. Settings

Settings control account, integration, billing, and AI behavior across the workspace.

### 11.1 AI Features (AI Configuration)

Per-service model configuration persisted to `localStorage`:

| Service | localStorage Key | Purpose |
|---|---|---|
| Draw Service | `ai_model_draw` | Model for sketch-to-entity conversion |
| Analyze Service | `ai_model_analyze` | Model for code/structure analysis |
| Class Generation | `ai_model_class` | Model for attribute autocomplete |
| Global Generation | `ai_model_global` | Model for canvas prompt bar |

### 11.2 Integrations

API tokens stored in `localStorage` (browser-only, never sent to server except Figma):

| Integration | Key | Notes |
|---|---|---|
| Figma | `figma_pat` | Used to fetch Figma file JSON for import |
| OpenAI | `openai_api_key` | Optional client-side override |
| MongoDB import | `mongo_uri` | Import connection is coming soon; MongoDB code generation is a separate feature. |
| Slack account integration | `slack_token` | This settings integration is coming soon. |

### 11.3 Billing

Shows current plan, monthly AI request usage vs. limit as a progress bar. Red indicator when quota is exceeded. **Upgrade to Pro** button triggers plan upgrade via API.

### 11.4 Profile

Displays username, email, avatar initial. GitHub account connection shown (for repository publishing).

---

## 12. Import & Export

Import and export tools move workspace structure between Avora, files, and external design sources.

### 12.1 Workspace Export

From the left sidebar import/export control, workspaces can be exported as structured JSON containing nodes, edges, workspace name, and description. Internal IDs and user ownership info are stripped from the export.

### 12.2 Workspace Import

Upload a previously exported `.json` file. A new workspace is created with the imported nodes and edges assigned to the importing user.

### 12.3 Figma Import

Via the prompt bar → `+` → Figma:
1. Enter the Figma file URL
2. Ensure a Figma PAT is saved in Integrations settings
3. Avora fetches the Figma JSON, analyzes the component hierarchy and text using AI
4. Streams `ADD_NODE` / `ADD_EDGE` operations to build a diagram from the design

---

## 13. Admin Dashboard

Accessible to users with `role: admin` via the left sidebar.

**Overview Stats:**
- Total users, active WebSocket connections, requests last hour, average latency

**Subscription Plans Management:**
- Create, view, delete plans
- Configure AI request limits per period (e.g., 100 req/month)
- Plans are publicly listable; assignment is via upgrade API

**AI Models Management:**
- Add AI models (model ID, display name, provider)
- Supported providers: `openai`, `anthropic`, `gemini`, `deepseek`, `groq`, `ollama`, `openrouter`
- Delete models — removed models no longer appear in user model dropdowns

**AI Usage Analytics:**
- Total tokens today / this month
- Tokens per minute (TPM)
- Average tokens per request
- Provider distribution pie chart
- Model distribution pie chart
- 24-hour hourly token trend area chart
- Per-user usage table (top 10 by token consumption)

**Performance Metrics:**
- Requests per minute bar chart
- Average latency area chart
- Top 10 endpoints by request count with method + avg latency

**User Management:**
- Table of recent users with username, role, and subscription tier

---

## 15. Deployment & Self-Hosting

Deployment settings describe the environment required to run Avora-generated services outside the editor.

### 15.1 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URL` | ✅ | MongoDB connection string |
| `MONGODB_DB_NAME` | ✅ | Database name (default: `avora`) |
| `SECRET_KEY` | ✅ | JWT signing secret |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth secret |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth secret |
| `GOOGLE_API_KEY` | ✅ | Gemini AI API key |
| `DEEPSEEK_API_KEY` | Optional | DeepSeek provider |
| `OPENROUTER_API_KEY` | Optional | OpenRouter provider |
| `GROQ_API_KEY` | Optional | Groq provider |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS and OAuth redirect |
| `BACKEND_URL` | ✅ | Backend public URL for OAuth callbacks |
| `BACKEND_CORS_ORIGINS` | ✅ | Comma-separated allowed origins |

### 15.2 Running with Docker

```bash
# Backend
docker build -t avora-backend .
docker run -p 8000:8000 --env-file .env avora-backend

# Or with docker-compose
docker-compose up --build
```

Backend serves on port `8000` via `gunicorn` with `UvicornWorker` (1 worker, 600s timeout for streaming).

### 15.3 Frontend

```bash
cd frontend
npm install
VITE_API_URL=https://your-backend-url npm run build
```

### 15.4 Database

MongoDB is required. Beanie ODM handles collection creation and indexing automatically on startup via `init_beanie()`. No migrations needed.

---

## 16. Architecture Deep Dive

Architecture details explain how the frontend, graph state, backend, and generator fit together.

### 16.1 Frontend State Architecture

Built with React + Vite + Zustand (feature-first slice pattern):

| Store | Responsibility |
|---|---|
| `useNodeStore` | All canvas nodes, edges, validation errors, undo/redo (Zundo temporal) |
| `useWorkspaceStore` | Workspace list, current workspace, realtime flag |
| `useViewStore` | Current view mode, canvas tool, dragging state |
| `useAuthStore` | User session, tokens, login/signup/logout |
| `useAiModelStore` | Available AI models fetched from backend |
| `useWebSocketStore` | Active WebSocket connection reference |
| `useCodeViewStore` | Generated file tree, Monaco editor state, code cache |

### 16.2 Graph Persistence Strategy

- **Solo mode**: Debounced REST sync every 1000ms via `POST /workspaces/{id}/sync`
- **Realtime mode**: Debounced WebSocket broadcast every 50ms
- Diff calculated by comparing current node/edge state against `lastSavedRef` using structural equality
- Only changed nodes/edges are sent (upsert) + deleted IDs

### 16.3 Backend Architecture

FastAPI + Beanie (MongoDB ODM) + Motor (async MongoDB driver):

- `main.py` — CORS, middleware registration, router inclusion, lifespan (DB init)
- `PerformanceMiddleware` — records every HTTP request latency to `metrics` collection asynchronously
- `deps.py` — `get_current_user` (JWT decode), `get_current_admin_user`, `check_subscription`
- All collection names: `users`, `workspaces`, `nodes`, `edges`, `workspace_versions`, `metrics`, `ai_usage`, `ai_models`, `plans`, `user_subscriptions`

### 16.4 Code Generation Pipeline

```
Workspace JSON (nodes + edges)
    ↓
parse_graph_data() → ProjectSpec
    ├── Pass 1: Discover Enums → EnumSpec list
    ├── Pass 2: Parse Class nodes → EntitySpec list
    ├── Auth feature injection (email, is_active, is_superuser on User)
    └── Pass 3: Process edges → RelationshipSpec + FK field injection
    ↓
FastAPIGenerator.generate_files(project_spec)
    ├── Jinja2 template rendering per entity
    └── Dict {path: content}
    ↓
In-memory ZIP buffer → HTTP streaming response
```
