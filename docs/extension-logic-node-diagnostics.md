# Read Diagnostics

Use the tester's Issues list and automatic startup checks to find whether a failure comes from the workspace, visual node configuration, generated code, or local runtime.

## Task

Locate the most useful source, section, field, file, line, and suggested fix for a failed generation or API test.

## Prerequisites

- A node is open in the tester.
- For startup diagnostics, local preview code has been generated and Python is available.

## Find This in the Tester

Select **Issues** in the toolbar. When an API request cannot connect, the output also includes a local startup diagnostic.

## Steps

1. Resolve tester prerequisites first: node, workspace, target entity or request group, variant, and local directory.
2. Review workspace validation issues. Their location can include the workspace source, node label, section, field, and hint.
3. Review preview issues produced by the configured node instance.
4. If the API cannot connect, let the extension import `app.main` from the local preview with a 15-second diagnostic timeout.
5. Follow the summarized issue before opening the full traceback.
6. Use the reported file and line when the failure comes from generated code or a code template.
7. Correct the source in Avora, update local code, restart the preview, and send the request again.

The diagnostic recognizes common failures such as a model without a primary key, a missing Python package, and Python syntax, indentation, name, or import errors. When the app imports successfully but no server answers, it recommends starting or restarting the preview.

## Expected Result

The failure is reduced to an actionable workspace, dependency, template, generated-file, or run problem instead of only a connection error.

## Next Step

Return to [Configure Test](./extension-logic-node-configure.md), [Generate Test Code](./extension-logic-node-generate.md), or [Run and Test API](./extension-logic-node-run-test.md).

## Troubleshooting

- If diagnostics cannot run, verify the generated folder exists and contains `app/main.py`.
- If the traceback is long, start with the summary and the deepest file path inside the generated project.
- For extension-side failures outside the tester, open **View → Output** and select **Avora**.
