# Preview & Swagger

Preview and Swagger are where you verify that the generated backend behaves like the workspace.

### Task

Generate the backend, start a preview, and test the API contract in Swagger.

### Steps

1. Fix blocking validation errors in the workspace.
2. Open **Code** and generate the latest preview code.
3. Inspect important files before running the backend.
4. Open **Deploy** and start a preview backend.
5. Open the preview URL, then open Swagger Docs.
6. Test signup, login, create, read, update, delete, and custom action requests with realistic data.
7. Return to Avora when Swagger shows a wrong field, missing status, unsafe access rule, or broken logic path.

### Expected Result

Swagger should show the routes, inputs, auth requirements, status codes, and response shapes you designed in Avora.

### Next

Use [Code Generation](./code-generation.md), [Deployment](./deployment.md), and [Database](./database.md) to inspect, run, and manage the generated backend.
