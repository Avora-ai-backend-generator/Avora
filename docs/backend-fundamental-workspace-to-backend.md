# Workspace to Backend

An Avora workspace becomes a backend by keeping four contracts aligned: the data model, the API contract, the logic flow, and the runtime settings.

### Task

Use this model to understand what each Avora surface controls before generating code.

### Find This in Avora

- **Diagram** controls stored data and relationships.
- **Requests** controls routes, request inputs, response outputs, auth, and roles.
- **Logic Flow** controls what happens inside a request.
- **Code**, **Database**, and **Deploy** let you inspect and run the generated backend.

### Steps

1. Model the stored objects in the Diagram Builder.
2. Add relationships only where records need to connect.
3. Define requests that expose the actions your frontend or API consumer needs.
4. Open each request handler and connect a logic flow from input to output.
5. Validate the workspace before generating or deploying.
6. Generate code, inspect the output, then preview or export the backend.

### Expected Result

The generated backend should match the visual workspace: entities become data models, requests become API endpoints, logic flows become route behavior, and runtime settings become environment-aware configuration.

### Next

Use [Diagram Builder](./diagram-builder.md), [Request Builder](./request-builder.md), and [Logic Flow Builder](./logic-flow-builder.md) for the detailed build steps.
