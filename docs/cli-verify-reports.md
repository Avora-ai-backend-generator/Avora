# JSON Reports

Produce structured verification output for continuous integration, scripts, or an AI-assisted correction loop.

## Task

Print a JSON report, save it to disk, and use its correction targets to guide the next iteration.

## Prerequisites

- The project can be resolved by the CLI.
- At least one verification command is detectable.
- The report destination is writable.

## Find This in Your Terminal

```bash
avora verify project-name --json --report ./.avora-verify.json
```

## Steps

1. Pull or update the latest project code.
2. Run `verify` with `--json` for machine-readable standard output.
3. Add `--report <file>` to save the same report to disk.
4. Read `status` first, then inspect failed items in `checks` and `correctionTargets`.
5. Fix the reported problem and repeat verification until `status` is `pass`.

```bash
avora pull --select --update --no-run
avora verify --json --report ./.avora-verify.json
```

| Field | Meaning |
| --- | --- |
| `project` | Resolved project name. |
| `path` | Absolute local project path. |
| `generatedAt` | Report creation time. |
| `status` | Overall `pass` or `fail` result. |
| `checks[]` | Commands, exit codes, classifications, suggestions, and output tails. |
| `correctionTargets[]` | Failed commands reduced to an actionable kind and suggestion. |

## Expected Result

JSON mode writes only the structured report to standard output. The process exits with code `0` when every check passes and `1` when at least one check fails.

## Next Step

Use the report in your CI job or AI development workflow. Keep rerunning verification after each correction.

## Troubleshooting

- If the report file is missing, confirm that its parent directory is writable.
- If another program cannot parse standard output, make sure `--json` is present.
- If `status` is `fail` but the suggestion is generic, inspect the saved `stdoutTail` and `stderrTail` fields.
