# Run and Test API

Start the generated FastAPI preview and send a typed request to its node endpoint from the tester.

## Task

Verify that the node's generated code starts successfully and produces the expected response for representative input values.

## Prerequisites

- Local node test code has been generated.
- Python and the preview dependencies are installed.
- Port `8001` is available or can be released.

## Find This in VS Code and the Tester

Use the play item in the VS Code status bar to start the generated folder. Use **Test** in the tester toolbar to open the request panel.

## Steps

1. Open the generated node test folder or keep the tester open so it remains the preferred run target.
2. Select the play item named for the node. The extension starts Uvicorn at `http://127.0.0.1:8001`.
3. Return to the tester and select **Test**.
4. Keep the default base URL or enter the address where the preview is running.
5. Complete the generated input editors. Complex entity and enum fields use schemas from the selected workspace.
6. Optionally copy the expected input JSON shape or import input JSON from the clipboard.
7. Select **Send**. The tester sends a `POST` request to the generated preview path.
8. Review the HTTP status, duration, endpoint, and response body. Expand or copy the output when needed.

*Test a generated logic node API: The tester request panel with the Test button, generated input editors, and Send action.*

## Expected Result

The preview returns an HTTP response for the configured node. Successful and error paths can be tested repeatedly without regenerating code unless the node configuration changes.

## Next Step

Use [Diagnostics](./extension-logic-node-diagnostics.md) when startup or requests fail. Apply fixes in Node Builder or Code Builder, copy or open the updated node, and regenerate.

## Troubleshooting

- If the tester says the preview is unavailable, confirm the terminal is still running and the base URL uses port 8001.
- If inputs are missing, update the active variant or its input definitions in the source node.
- If the response is an expected application error, review the status and body before treating it as a startup failure.
