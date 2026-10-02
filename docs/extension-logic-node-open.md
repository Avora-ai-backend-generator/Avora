# Open Published Node

Load one of your published custom logic nodes directly into the VS Code tester.

## Task

Choose a node published by the signed-in account and open its latest saved configuration and code bundle.

## Prerequisites

- You are signed in through the extension.
- The account has at least one published logic node.
- The configured frontend URL can load the embedded tester page.

## Find This in VS Code

Open the Avora sidebar and expand **My Published Logic Nodes**. Each item shows its node name and, when available, its category.

## Steps

1. Refresh the Avora sidebar if the newly published node is not visible.
2. Select a node in **My Published Logic Nodes**.
3. The extension loads the complete published template from Avora.
4. A tester editor opens with the node configuration and code bundle already imported.
5. Choose a workspace and target entity or request group, then review the active variant and fields.

You can also run `Avora: Open Published Logic Node` and choose from a searchable list. Use `Avora: New Node Testing` when you want a blank tester that will receive clipboard content instead.

## Expected Result

The tester title uses the selected node name and the node preview appears in the main canvas.

## Next Step

[Configure the node test](./extension-logic-node-configure.md), then [generate local test code](./extension-logic-node-generate.md).

## Troubleshooting

- If the list is empty, confirm the node is published under the current account and refresh.
- If the node opens without its expected code, return to Code Builder, save the code bundle, and publish or update the template again.
- If the tester cannot load, verify [the frontend URL](./extension-settings-urls.md).
