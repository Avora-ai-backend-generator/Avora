# Auth & Roles

Authentication confirms who is calling a request. Roles decide whether that caller is allowed to use the request.

### Task

Model auth and role-based access without creating signup loops or exposing protected operations.

### Steps

1. Keep login identity fields on `User`, such as email, password, active status, and role.
2. Put role-specific fields in profile entities such as `TeacherProfile` or `StudentProfile`.
3. Enable **Requires auth** on requests that read or change protected data.
4. Select the role enum only when the request must be limited to specific roles.
5. Add clear error outputs for unauthenticated or forbidden requests.

| Scenario | Recommended Avora model |
|---|---|
| Public signup or login | No auth required |
| Current user profile | Requires auth, no role restriction unless needed |
| Admin-only management | Requires auth plus allowed admin role |
| User signs up before profile exists | Association, profile owns `user_id` |
| Signup creates the profile immediately | Composition with only the profile matching the selected role |

### Example Signup Body

```json
{
  "password": "string",
  "user_data": {
    "email": "student@example.com",
    "role": "STUDENT",
    "student_profile": {
      "grade": "A"
    }
  }
}
```

Do not require every role profile in one signup request. The body should include only the data for the selected role path.

### Next

Use [Request Builder](./request-builder.md#access-and-roles) for request security controls and [Logic Flow Builder](./logic-flow-builder.md#error-handling) for auth error paths.
