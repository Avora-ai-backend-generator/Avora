# Run a Project

Start a managed FastAPI or Node project in an integrated VS Code terminal.

## Task

Run the current pulled project with the command detected from its generated files.

## Prerequisites

- The project exists locally and contains valid Avora metadata.
- Python or Node.js is installed for the detected project type.
- Required dependencies are already installed in the project.

## Find This in VS Code

Select a project in the Avora sidebar, run `Avora: Run Project`, or select the play item in the status bar while the managed folder is open.

## Steps

1. Open the pulled project folder in VS Code.
2. Install the dependencies declared by the generated project when needed.
3. Start the project from the sidebar, Command Palette, or status bar.
4. For a FastAPI project containing `app/main.py`, the extension prefers Python from `.venv` or `venv`, then falls back to a system Python command.
5. FastAPI starts with Uvicorn on port `8001`. Values from the local `.env` are added to the terminal environment; if neither `DATABASE_URL` nor `MONGODB_URL` exists, the extension supplies a local SQLite database under `.avora/runtime.db`.
6. For a project containing `package.json`, the extension runs `npm run dev`.
7. Stop the terminal process when you finish testing.

Starting another Avora target closes the extension's previous run terminal. On macOS and Linux, the extension also attempts to free port 8001 before starting FastAPI.

## Expected Result

A terminal named for the Avora project opens at the project root and runs the detected development command.

## Next Step

Use the generated API locally, or [update the project](./extension-projects-update-code.md) after changing its Avora workspace.

## Troubleshooting

- If no command is detected, confirm the folder contains `app/main.py` or `package.json`.
- If Python imports fail, create a virtual environment and install the project's requirements.
- If `npm run dev` fails, install dependencies and confirm the project defines a `dev` script.
- If port 8001 stays occupied, stop the existing process manually and retry.
