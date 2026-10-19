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
`hyprland.conf`. It matches Chromium's `chromium` window class and English
window titles. Browser features such as the vertical sidebar depend on your
Chromium version.

## What it adds

| When focused | Shortcut | Action |
| --- | --- | --- |
| Chromium | Alt+Shift+S | Toggle vertical-tab sidebar |
| Chromium | Alt+G | Open the native group-name editor |
| Chromium | Ctrl+H / Ctrl+L | Back / forward |
| Chromium | Ctrl+Alt+Shift+S | Save page |
| PiP player | Alt+P | Return video and focus to Chromium |
| PiP player | Alt+F | Toggle player fullscreen |

Press Alt+F again to leave fullscreen; PiP's pin is restored on exit. Refresh existing video pages after
updating the extension to load its new video shortcut.

The module also floats and pins PiP, keeps it within the scaled monitor bounds,
and moves focus into Vimium's new-tab search after navigation or group naming.
The extension's Vimium C setup is required for that search handoff.

Review conflicting desktop shortcuts before loading: the module unbinds and
owns the listed combinations in the matching window context. Other extension
shortcuts stay registered in Chromium.

## Remove

Remove the `dofile(...)` line and reload Hyprland. The browser extension can stay
installed independently.
