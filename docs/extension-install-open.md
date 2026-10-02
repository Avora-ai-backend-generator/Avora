# Install Avora

Install Avora from the Visual Studio Marketplace and open its dedicated Activity Bar views in VS Code.

## Choose Your Editor

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Avora.avora-dev) — Install Avora in Visual Studio Code or another editor that uses Microsoft's extension marketplace.
- [Open VSX Registry](https://open-vsx.org/extension/avora/avora-dev) — Install Avora in VSCodium and other open-source or Open VSX-compatible editors.

## Task

Add the extension to VS Code and confirm that the **Projects** and **My Published Logic Nodes** views are available.

## Prerequisites

- Visual Studio Code 1.90 or later.
- Permission to install extensions in your VS Code environment.
- An Avora account for the authenticated features used after installation.

## Find This in VS Code

Open **Extensions** from the Activity Bar or press `Ctrl/Cmd+Shift+X`. Search for **Avora**, published by **Avora**.

## Steps

1. Choose the registry used by your editor:
   - [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Avora.avora-dev) for Visual Studio Code.
   - [Open VSX Registry](https://open-vsx.org/extension/avora/avora-dev) for VSCodium and other Open VSX-compatible editors.
2. In Cursor, Antigravity, or another VS Code-compatible editor, search its built-in Extensions view first because registry support can vary by version.
3. Select **Avora**, published by **Avora**, and choose **Install**.
4. Reload the editor if it asks you to reload.
5. Select the Avora icon in the Activity Bar.
6. Confirm that the sidebar contains **Projects** and **My Published Logic Nodes**.

When no account is connected, each view shows a **Login to Start** action instead of account data.

## Expected Result

The Avora icon appears in the Activity Bar, the Avora logo appears in the status bar, and the two sidebar views are ready for sign-in.

## Next Step

[Sign in from VS Code](./extension-sign-in.md), then learn the [status and account actions](./extension-status-account-actions.md).

## Troubleshooting

- If the extension is not listed, confirm the publisher is **Avora** and open the listing for the registry supported by your editor.
- If a compatible editor cannot install from either registry directly, use its documented VSIX installation workflow with the Avora package from the supported listing.
- If the Activity Bar icon is hidden, open the Activity Bar context menu and enable **Avora**.
- If commands do not appear, run **Developer: Reload Window** after installation.
- If VS Code reports an incompatible version, update VS Code to 1.90 or later.
