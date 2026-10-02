# Decision Checklist

Use this checklist before code generation or preview.

| Question | Avora action | More detail |
|---|---|---|
| What data does the product store? | Create entities and enums | [Entities and Fields](./backend-fundamental-entities-and-fields.md) |
| Which fields identify or protect records? | Configure keys, uniqueness, indexes, and validation | [Keys and Validation](./backend-fundamental-keys-and-validation.md) |
| Can the related record live alone? | Use association or aggregation | [Relationships](./backend-fundamental-relationships.md) |
| Is the child created with the parent? | Use composition | [Relationships](./backend-fundamental-relationships.md) |
| What does the frontend need to call? | Create a request with method, path, inputs, and outputs | [Requests and Responses](./backend-fundamental-requests-and-responses.md) |
| Should the caller be signed in? | Enable request auth | [Auth and Roles](./backend-fundamental-auth-and-roles.md) |
| Should only some roles call it? | Select a role enum and allowed values | [Auth and Roles](./backend-fundamental-auth-and-roles.md) |
| What must happen inside the route? | Build the request logic flow | [Logic Flows](./backend-fundamental-logic-flows.md) |
| Does every path return a clear status? | Connect success and error outputs | [Logic Flows](./backend-fundamental-logic-flows.md) |
| Does the generated API match the workspace? | Test it in Swagger preview | [Preview and Swagger](./backend-fundamental-preview-and-swagger.md) |

If the answer is unclear, start from [Avora Overview](./avora-overview.md) or return to the relevant builder page linked above.
