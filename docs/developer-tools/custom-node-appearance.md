# Custom Node Appearance

Give a reusable node a recognizable icon or logo and a heading color. Avora preserves this appearance across the web builder, local SDK projects, CLI, extension, private drafts, and published nodes.

## In the web Node Builder

Open **Node Settings → Identity & Appearance**. Choose an existing node icon or import a PNG or static, self-contained SVG. The appearance editor supports a default logo and an optional dark-theme logo. Without a dark variant, the default logo is used in both themes.

Choose a palette color, enter a six-digit hex color, or use the logo's dominant visible color. A manually selected color remains manual when the logo changes. Transparent padding is excluded from automatic color selection. Removing a logo returns the node to its icon.

Imports are limited to 2 MB. SVGs must be static and self-contained; external references and executable content are rejected. Accepted artwork is converted to a bounded PNG representation.

## In local projects

Use **Avora: Edit Node Appearance** in the extension or the CLI commands:

```bash
avora node appearance ./my-node --logo ./logo.svg --json
avora node appearance ./my-node --dark-logo ./logo-dark.png --json
avora node appearance ./my-node --color '#3b82f6' --json
avora node appearance ./my-node --auto-color --json
```

The SDK also provides `addNodeLogo` in `@avora/node-sdk/dist/logoNode`. Local imports create mapped `assets/*.png` files and upgrade the manifest to format 4. Commit those assets with `avora.node.json`; do not replace their mappings with an absolute local path.

Draft exchange embeds portable image data for transport, then materializes it back into local files. Generation excludes appearance image bytes because logos do not affect executable behavior. Changing only the logo or heading color does not invalidate generation or test identity.

See [Avora Node SDK](../sdk.md), [CLI Node Authoring](../cli-node-authoring.md), or [VS Code Node Authoring](../extension-node-authoring.md) for your workflow.
