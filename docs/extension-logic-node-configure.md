# Configure a Test

Bind the imported node to workspace data, choose its behavior, and provide the values required for generation and API testing.

## Task

Create a valid preview configuration for one node variant in the context of an Avora workspace.

## Prerequisites

- A published node or test snapshot is open in the tester.
- The selected workspace contains at least one entity or request group.
- The workspace has no blocking validation errors.

## Find This in the Tester

Use the toolbar selectors for **Workspace** and **Entity**. The second selector includes workspace entities first and request groups after them. Configure the remaining values directly on the node preview.

## Steps

1. Choose the workspace whose entities, enums, graph connections, and environment variables should be available to the node.
2. Choose the target entity or request group. This value becomes the preview service group.
3. Select the node variant inside the preview.
4. Complete required configuration lines and add optional or repeatable lines when the node supports them.
5. Review and adjust inputs, outputs, logic-flow exits, and expected errors.
6. Open **Issues** and resolve every error. Warnings explain missing selections or workspace concerns but only errors block generation.
7. Set the node test directory if the toolbar shows **Set Dir**.

The **Update** button is enabled only when the tester has a directory, workspace, node, variant, target group, no blocking workspace or preview issue, and no generation request in progress.

## Expected Result

The visual node shows the intended variant and values, and **Update** is available for local code generation.

## Next Step

[Generate local node test code](./extension-logic-node-generate.md).

## Troubleshooting

- If the entity selector is empty, add an entity or grouped request to the workspace and refresh the tester.
- If the selected target becomes unavailable, choose a current option from the workspace graph.
- If Issues reports workspace errors, fix them in Avora before retrying.
- If a preview field reports an error, correct the node instance value or return to Node Builder for a structural change.
