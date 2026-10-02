# Deployment

Use Deployment to start a live backend preview, share its URL, inspect status, read logs, update the running code, and unpublish the preview when you are done.

Open a workspace and select **Deploy** from the topbar. The deploy dialog is available from the main workspace views after the workspace has been created.

The walkthrough below shows the full preview flow: starting a deployment, watching the progress steps, opening logs, and using the live backend to open the generated Swagger documentation.

*Deploy a backend preview: Interactive walkthrough showing the deployment action, progress steps, logs, and opening the generated Swagger documentation.* [View media](https://app.arcade.software/share/UL58dVPlDseZkRgMMWC8)

## Deploy the Backend

Deploy a preview when you need a live URL for testing endpoints, sharing the backend with a teammate, or checking the generated runtime outside the editor.

Before deploying:

- Fix blocking validation errors in the workspace.
- Confirm the latest diagram, requests, and logic flows are saved.
- Check environment variables required by the generated backend.
- Confirm the selected database type matches the backend you intend to run.

To start a preview:

1. Open the workspace.
2. Select **Deploy** in the topbar.
3. Keep the dialog on the **Preview** tab.
4. Select **Deploy Preview**.
5. Wait for the steps to complete: generate code, upload package, provision container, boot backend, and ready.
6. Copy or open the preview URL when the status changes to **Ready**.
7. From the live backend page, open **Swagger Docs** to test the generated API routes.

**Result:** Avora starts a preview backend container and exposes a live backend URL.

The **Production** tab is visible, but production deployment is currently scaffolded. Use preview deployment for the working hosted backend flow until production publishing is connected.

## Status and Logs

Deployment status tells you where the preview is in its lifecycle and whether action is required.

| Status | Meaning | What to do |
| --- | --- | --- |
| **Preview standby** | No backend container is running yet. | Start a preview when you are ready to test. |
| **Starting backend** | Avora is preparing the preview container. | Wait for the health check to finish. |
| **Ready** | The backend URL is live and responding. | Open the URL or test the generated endpoints. |
| **Reloading backend** | Avora is applying an update to an existing preview. | Wait until the update returns to Ready. |
| **Failed** | The preview did not become healthy or an update failed. | Read the error panel and fetch logs. |
| **Stopped** | The preview was unpublished manually. | Deploy again when you need a new preview. |
| **Expired** | The preview reached its inactivity window. | Deploy again if you still need the backend. |

To inspect logs:

1. Open **Deploy Workspace**.
2. Expand **Logs**.
3. Select **View logs**.
4. Enable **Poll while running** when you want Avora to keep checking the preview health.
5. Enable **Auto-refresh** after logs are visible when you want the log output to update while the preview runs.

Use logs when a preview fails, when a request behaves differently than expected, or when you need to confirm that the backend restarted after an update.

## Update and Redeploy

Use **Update** when a preview is already active and you want it to run the latest generated backend.

1. Make the workspace changes in Diagram, Requests, Logic Flow, Code settings, or Database settings.
2. Fix any blocking validation errors.
3. Open **Deploy Workspace**.
4. Select **Update**.
5. Wait for Avora to generate code, upload the new package, reload the backend, run the health check, and return to **Ready**.
6. Re-test the affected endpoints.

**Result:** The same preview URL serves the updated backend when the reload succeeds.

If the update fails, keep the dialog open, read the error message, fetch logs, fix the workspace or environment issue, and retry.

## Stop or Unpublish

Use **Unpublish** when you no longer need the preview URL available.

1. Open **Deploy Workspace**.
2. Confirm the preview is active.
3. Select **Unpublish**.
4. Wait for Avora to stop the container and clean up preview storage.

**Result:** The preview URL stops serving the backend and the preview resources are released.

If no active preview exists, the secondary action closes the dialog instead of stopping a deployment. If the preview has expired, deploy again to create a fresh session.

Continue to [Database](./database.md) to connect and manage live workspace data.

## Test a Preview with a Real Request

For the Task example in [Quick Start](./quick-start.md), wait for Ready, open Swagger Docs, and use the generated authentication endpoints with a test account. Submit POST /tasks, then GET /tasks to verify that the record can be read back.

You can also use an API client or curl. Replace the placeholders with the preview URL and a test access token issued by your backend:

```sh
BACKEND_URL="https://your-preview-host"
ACCESS_TOKEN="your-test-access-token"
curl "$BACKEND_URL/tasks" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

The URL, authentication scheme, and response body must match your generated API contract. Keep tokens out of screenshots, shared commands, and source control.

### Troubleshoot a Preview Request

| Symptom | What to inspect |
| --- | --- |
| Preview never reaches Ready | Read deployment logs for startup errors and missing environment variables. |
| API returns 404 | Check the exact method and path in Swagger and update an outdated preview. |
| API returns an authentication or permission error | Check the test token and the request's configured access rules. |
| Data does not match the Database view | Compare the runtime database target with the Database view target. |
| Request returns an unexpected server error | Inspect runtime logs and the request's error paths in Logic Flow Builder. |

When you finish testing, unpublish previews you no longer need. For production hosting outside the preview flow, export the code and follow your hosting provider's deployment instructions.
