# Hyprland integration

Optional helpers for **Hyprland's Lua configuration API (0.55+)**. Works with
standard Hyprland or Omarchy; no private dotfiles are needed.

## Setup

1. Install the extension and its shortcut assignments as described in the
   [main README](../README.md). Install `bash` and `jq` for new-tab focus handling.
2. Add this line **after your other bindings** in `~/.config/hypr/hyprland.lua`,
   changing the absolute path to your clone:

   ```lua
   dofile(os.getenv("HOME") .. "/Projects/chromium-workflow-shortcuts/integrations/hyprland.lua")
   ```

3. Reload and check for errors:

   ```sh
   hyprctl reload
   hyprctl configerrors
   ```

Load it only once. This file uses Lua APIs and cannot be sourced from an older
`hyprland.conf`. It matches Chromium's `chromium` and `chromium-browser` window classes and English
window titles. Browser features such as the vertical sidebar depend on your
Chromium version.

## What it adds

| When focused | Shortcut | Action |
| --- | --- | --- |
| Chromium | Alt+Shift+S | Toggle vertical-tab sidebar |
| Chromium | Alt+G | Open the native group-name editor |
| Chromium | Alt+Shift+K | Move the current tab up / left |
| Chromium | Ctrl+H / Ctrl+L | Back / forward |
| Chromium | Ctrl+Alt+Shift+S | Save page |
| PiP player | Alt+Shift+P | Return video and focus to Chromium |
| PiP player | Alt+P | Toggle player fullscreen |

Press Alt+P again to leave fullscreen; PiP's pin is restored on exit. Assign video and PiP keys in Chromium’s extension shortcut editor, and use the same keys in the exported Hyprland configuration.

The module also floats and pins PiP, keeps it within the scaled monitor bounds,
and moves focus into Vimium's new-tab search after navigation or group naming.
The extension's Vimium C setup is required for that search handoff.

Review conflicting desktop shortcuts before loading: the module unbinds and
owns the listed combinations in the matching window context. Other extension
shortcuts stay registered in Chromium.

## Remove

Remove the `dofile(...)` line and reload Hyprland. The browser extension can stay
installed independently.

## Customize keys

Open the extension's settings, expand **Hyprland controls**, and record your keys.
Save, then choose **Download Hyprland config**. Paste the downloaded
`chromium_workflow_shortcuts = { ... }` block immediately above the existing
`dofile(...)` line and run `hyprctl reload`.

PiP uses the settings page's video fullscreen and Picture-in-Picture keys.
Changing those page keys applies immediately on websites; apply the exported
configuration to update the separate PiP window as well. Empty keys disable actions.
The integration leaves its custom browser remaps inactive on the settings page.

**Alt+O** opens native split view and focuses Vimium C’s bar in its second pane. Assign **Prepare Vimium split search (Hyprland Alt+O)** to the same key in Chromium’s extension shortcut editor. Existing-tab suggestions open their URL in the pane without moving the original tab. **Alt+Shift+O** is a browser-wide extension command that separates the focused split, including from the split picker and address bar.
