# Logic Flows

A logic flow is the behavior behind a request. It receives request values, runs action nodes, and returns one of the request outputs.

### Task

Build the shortest flow that moves from input to valid output while handling expected failures.

### Steps

1. Open the request handler from the request node.
2. Confirm request inputs appear on the left and outputs appear on the right.
3. Add action nodes for database work, conditions, variables, password handling, token handling, or integrations.
4. Connect outputs to compatible inputs so Avora can infer execution order.
5. Route success paths to 2xx outputs.
6. Route expected failures to 4xx outputs.
7. Use 5xx outputs for unexpected backend or integration failures.

| Flow element | Use it for |
|---|---|
| Request input | Values supplied by the caller |
| Action node | One operation such as query, condition, token, or transform |
| Branch | Alternate path such as true/false or loop body |
| Output | Data returned by the request |
| Error handle | Known failure path from an action |

### Expected Result

Every required value is connected, every normal path reaches a success output, and every expected failure has a clear error response.

### Next

Use [Logic Flow Builder](./logic-flow-builder.md) for the full flow workflow.
