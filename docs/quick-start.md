# Avora Quick Start

Build a small task-management backend with Avora. Start from an AI draft or a blank workspace, define the data and API contract, then generate code and test a backend preview.

Before starting, sign in to Avora and prepare a clear project name, the main users, the data the backend needs to store, and the actions those users should perform.

## What You Will Build

Use a small task tracker as your first project. It needs a `Task` entity, a request to create a task, and a request to list tasks. Keep this first version small enough to inspect each generated field and request.

Before you begin:

- Sign in to an Avora account with access to create a workspace.
- Decide who can create and read tasks, including whether requests require authentication.
- Use development data and a test database when you reach the database and deployment steps.

A useful starting prompt is:

```text
Create a task-management backend. Each task has an integer ID,
a required title, and a completed flag. Add POST /tasks to create
a task and GET /tasks to list tasks. Require authenticated users
for both requests. Show me the entities, request inputs, outputs,
and validation rules before implementing the workspace.
```

Review the proposed plan before selecting Implement. The names and response shapes are your API contract; an AI draft is a starting point to inspect and refine.

## From Draft

Use this path when you want to describe the backend first, review an AI-generated plan, and then turn that plan into an editable workspace.

*Create a workspace from a draft: Walk through creating a draft, reviewing the generated backend plan, and implementing it as a workspace.* [View media](https://app.arcade.software/share/movhS9oN9mVRe9i2HGIl)

1. Open **Workspaces**.
2. Create a new draft.
3. Describe the product, users, data model, main actions, authentication rules, integrations, and any constraints.
4. Attach screenshots, design references, or files when they explain the product more clearly than text.
5. Send the prompt and review the generated implementation plan.
6. Ask for changes until the entities, relationships, requests, roles, permissions, and integrations match the backend you want.
7. Select **Implement** to create the workspace from the approved plan.
8. Open the workspace and review the generated diagram, API requests, runtime settings, environment variables, and validation state.

**Result:** Avora creates an editable workspace from the reviewed draft plan. You can still change every generated entity, request, logic flow, setting, and integration before generating or deploying code.

## From Scratch

Use this path when you want to build the backend manually, part by part, without starting from an AI draft.

1. Open the Avora home page.
2. Select **Build from Scratch** from the top-right action area.
3. Create the workspace and give it a clear name and description.
4. When the empty workspace opens, select **Add Entity From Scratch**.
5. Review the starter **User** entity and the requests Avora creates for it.
6. Continue building the rest of the workspace manually.

**Result:** You get a blank workspace seeded with the core user model and its necessary requests, then continue building the rest of the backend yourself.

## Continue to Build Your Backend

After creating the workspace, continue through the build pages in order. They explain how to shape the backend one part at a time.

- [Diagram Builder](./diagram-builder.md) — Create entities, enums, attributes, and relationships for the backend data model.
- [Request Builder](./request-builder.md) — Define the API endpoints, inputs, outputs, authentication, and request structure.
- [Logic Flow Builder](./logic-flow-builder.md) — Connect the backend actions that run inside each request.

Save a workspace version before large changes, exports, deployments, or code generation.

Need the terminology again? Return to [Before You Start](./before-you-start.md) or review [How Avora Works](./avora-overview.md#how-avora-works).

## Check the Finished Workflow

1. In [Diagram Builder](./diagram-builder.md), confirm that Task has a valid primary key, a required title, and a boolean completed field.
2. In [Request Builder](./request-builder.md), confirm the methods, paths, authentication rules, and response outputs for both task requests.
3. In [Logic Flow Builder](./logic-flow-builder.md), connect the create request to its persistence action and connect the result to its response output.
4. Fix blocking workspace issues and [generate the backend code](./code-generation.md).
5. [Deploy a preview](./deployment.md), open Swagger Docs, authenticate, create a task, and list the tasks.

You have completed the first workflow when the API accepts a valid task, returns the response you configured, and the task appears when you read it back. Also try an empty title and an unauthenticated request to verify the validation and access rules you chose.

## If the First Run Does Not Work

| Symptom | Check next |
| --- | --- |
| The draft includes too many entities or endpoints | Ask for a smaller Task-only example before implementing it. |
| Code generation is blocked | Open Issues and fix the referenced entity, request, or unconnected flow input. |
| The API returns an authentication error | Use the generated authentication flow and authorize the request in Swagger. |
| A request succeeds but returns the wrong shape | Compare the request outputs with the values connected by the logic flow. |
| The task is missing after creation | Confirm the persistence action ran and the preview uses the database you are inspecting. |
