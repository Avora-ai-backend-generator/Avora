# Verify Project

Run the quality checks available in a tracked project and receive a pass or fail result with targeted correction guidance.

## Task

Execute detected lint, type-check, test, and build commands from the project root.

## Prerequisites

- The project is tracked or resolvable by path or current directory.
- Its dependencies are installed.
- Its check scripts are safe to run in the local environment.

## Find This in Your Terminal

```bash
avora verify project-name
```

## Steps

1. Run `avora verify` with a name, ID, path, or from inside the project.
2. For Node projects, the CLI uses available `lint`, `typecheck`, `test`, and `build` scripts in that order.
3. If there is no npm test script but a `tests` folder exists, the CLI runs `pytest -q`.
4. A Python project with no other checks falls back to `python -m compileall .`.
5. A Node project with no recognized scripts tries the corresponding npm commands with `--if-present`.
6. Review each command, exit code, output tail, failure type, and suggestion.

## Expected Result

Every successful check is labeled `PASS`. Any failed check is labeled `FAIL`, and the overall command exits with a nonzero status so scripts can stop or retry.

The CLI classifies common failures as lint, type-check, tests, build, dependency, syntax, or unknown.

## Next Step

Use [Save JSON Verification Reports](./cli-verify-reports.md) for automation, or correct the first failing check and rerun `verify`.

## Troubleshooting

- If no checks are detected, add standard package scripts or a Python project marker such as `pyproject.toml`.
- If a tool is missing, install the project's dependencies and confirm the command works directly.
- If output is abbreviated, run the failing command itself to inspect its full output.
