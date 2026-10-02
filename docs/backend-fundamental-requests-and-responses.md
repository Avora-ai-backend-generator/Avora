# Requests & Responses

Requests are the public API endpoints Avora generates. A request should describe what the caller sends, what the backend does, and what response comes back.

### Task

Design each endpoint around one clear operation.

| Request part | Controls | Example |
|---|---|---|
| Method | The kind of operation | `GET`, `POST`, `PATCH`, `DELETE` |
| Path | The route users call | `/orders/{id}` |
| Path variables | Required values inside the route | `id` |
| Query params | Optional filters, search, pagination, or sorting | `status`, `page` |
| Body inputs | Data used by create, update, or action endpoints | `order_data` |
| Outputs | Success and error response shapes | `created`, `notFound` |

### Swagger Shapes

Swagger reflects the request contract generated from Avora.

| Modeling choice | Swagger input |
|---|---|
| Association `1:1` to an existing record | `profile_id: 1` |
| Association `*:*` | `tag_ids: [1, 2]` |
| Composition `1:1` | nested `profile: {...}` |
| Composition `1:*` | nested `items: [{...}]` |
| Auth profile created after signup | no profile ID in signup |

### Steps

1. Pick the method that matches the action.
2. Keep paths resource-oriented and readable.
3. Use path variables for required resource IDs.
4. Use query params for optional filtering.
5. Keep body inputs focused on data the caller is allowed to send.
6. Define separate outputs for success and caller-visible errors.

### Next

Use [Request Builder](./request-builder.md) for request setup and [Preview and Swagger](./backend-fundamental-preview-and-swagger.md) when you are ready to test the generated endpoint.
