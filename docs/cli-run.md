# Run Project

Start an Avora workspace pull or Git project with dependency preparation and automatic command detection.

## Task

Resolve a local project and run its development or application entry point.

## Prerequisites

- The project exists locally.
- Required system runtimes are installed.
- You have reviewed the project and trust the commands it defines.

## Find This in Your Terminal

```bash
avora run project-name
```

From inside a tracked project or Git repository, you can usually omit the name:

```bash
avora run
```

## Steps

1. Resolve the project by saved name, workspace ID, path, or current directory.
2. For Python projects, the CLI creates `.venv` when missing, installs `requirements.txt`, and adds a local SQLite `DATABASE_URL` only when neither database URL is already configured.
3. For Node projects, the CLI runs `npm install` when `node_modules` is missing.
4. The CLI detects a run command and starts it in the project directory.
5. Stop the foreground process with Control+C when finished.

Detection prefers these entry points in order:

| Project signal | Run command |
| --- | --- |
| npm `dev` script | `npm run dev` |
| npm `start` script | `npm start` |
| `app/main.py` | `./.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001` |
| `main.py` | `./.venv/bin/python main.py` |
| `app.py` | `./.venv/bin/python app.py` |

## Expected Result

The selected command runs in the project folder with the current environment plus values loaded from the project's `.env` file.

## Next Step

Run [Verify Project](./cli-verify.md). If detection is wrong, use [Custom Run Command](./cli-run-command.md).

## Troubleshooting

- If the project cannot be resolved, use `avora find` or pass its absolute path.
- If no run command is detected, pass `--cmd`.
- If dependency setup fails, resolve the package or runtime error before retrying.
