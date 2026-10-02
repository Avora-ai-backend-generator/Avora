# Interactive Menu

Explore CLI actions from a guided terminal menu or use the help screen to find the exact command and options you need.

## Task

Open the command palette, move between its actions, and return to the standard help screen when you need command syntax.

## Prerequisites

- Avora CLI is installed and the `avora` command is available.
- Use an interactive terminal for arrow-key navigation.

## Find This in Your Terminal

Run either command to open the menu:

```bash
avora
avora menu
```

*Avora CLI command palette: Terminal showing the Avora CLI command palette with workspace, pull, run, verify, update, project, Git, login, and help actions.*

## Steps

1. Press the Up or Down arrow to move one item.
2. Use `j` or `k` as alternate down and up controls.
3. Press Page Down or Page Up to move five items.
4. Press Enter to select the highlighted action.
5. Press `q` or Escape to close the current selector.

For a confirmation prompt, Left and Right also move between **Yes** and **No**. Closing a confirmation uses the displayed default choice.

To see every command, option, and example without opening the menu, run:

```bash
avora help
# or
avora --help
```

## Expected Result

The menu shows the current account, the number of tracked projects, and actions such as **Open workspace**, **Pull workspace**, **Run project**, and **Verify project**.

## Next Step

Use [Sign In](./cli-login-logout.md) before opening an Avora workspace.

## Troubleshooting

- If the menu prints help and exits, the current shell is not interactive. Run the command in a local terminal with TTY support.
- If arrow keys print characters, use `j` and `k`, or call the command directly.
- If an action cannot find a project, first use `avora open`, `avora pull`, or `avora connect` to register one.
