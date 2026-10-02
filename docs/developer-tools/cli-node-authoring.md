# Author Custom Nodes with the CLI

Use `avora node` to create and inspect a custom node, edit its appearance, validate source, generate a selected case, prepare Python, and run tests. The CLI uses the same [Node SDK](../sdk.md) as the VS Code extension.

## Create and inspect offline

```bash
avora node init ./my-node --name "Scale Number" --json
avora node inspect ./my-node --json
avora node check ./my-node --json
```

`init` requires a new or empty destination and creates no remote draft. Read `avora.node.json`, the mapped `.avora` template, dependency source, and saved test case. Implement the placeholder source and choose independent expected results before running tests.

`inspect` reports the project's structure, files, and local capabilities. `check` validates schemas, references, tags, and the supported execution scope without an account or code execution.

## Edit dependencies and appearance

Edit `dependencies/fastapi/requirements.txt` for Python dependencies. Keep the manifest's dependency mapping intact; an embedded duplicate dependency list is an error.

```bash
avora node appearance ./my-node --logo ./brand.svg --json
avora node appearance ./my-node --dark-logo ./brand-dark.png --json
avora node appearance ./my-node --color '#3b82f6' --json
avora node appearance ./my-node --auto-color --json
avora node appearance ./my-node --remove-logo --json
```

PNG and static, self-contained SVG imports become portable PNG files under `assets/`. A logo upgrades the manifest to format 4. Manual color and automatic logo color are alternative options. Commit the authored assets with the node. Appearance changes do not require regenerating code. See [Node Appearance](../custom-node-appearance.md).

## Generate, prepare, and test

Connect with [browser sign-in](../cli-login-logout.md) before generation:

```bash
avora login --api https://your-avora-api.example.com
avora node generate ./my-node --case tests/cases/example.avora-test.json --json
avora node prepare ./my-node --case tests/cases/example.avora-test.json --python 3.11 --json
avora node test ./my-node --case tests/cases/example.avora-test.json --json
```

Replace the example API URL with your environment's backend. Generation uses the authenticated Avora compiler. Prepare downloads managed Python tooling and installs locked PyPI wheel dependencies when needed. Test runs a disposable local FastAPI process. Matching generated applications and environments are reused.

Cases store configured values separately from JSON runtime `inputs`. Use `expect.output` for the exact response body or `expect.error` for an intended HTTP error. A case without an expectation remains **Not tested**; edited source or case inputs make previous reports **Outdated**. First execution supports pure FastAPI nodes with empty or enum-only scratch context.

## Generate starter cases

```bash
avora node cases ./my-node --budget 24 --preview --json
avora node cases ./my-node --budget 24 --json
```

Preview first to inspect the bounded case plan. Starter cases cover supported variants and configuration combinations; unresolved workspace-dependent values need review. Existing manual assertions are preserved. Generated cases have no expected result and cannot count as a passed test until you add one and run them.

## Use the bundled authoring skill

```bash
avora node skill
avora node skill --install --json
```

The first command prints the bundled skill path. Installation copies it into your local agent skills directory and refuses to overwrite a different installed skill unless `--force` is supplied. The skill guides agents through the same source, validation, generation, and test workflow.

## Sync and publish

These CLI node commands work on local files; they do not publish nodes or provide a remote draft sync command. Open the project in [the extension](../extension-node-authoring.md) to link and sync a private draft, then publish through Avora.

Commit source, cases, context, assets, and `avora.lock`. Ignore generated output, `.avora/`, and `.env.local`. The app repository's `/custom-nodes/` folder is reserved for local projects and ignored by Git.
