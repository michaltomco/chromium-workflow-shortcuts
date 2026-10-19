# Chromium Workflow Shortcuts

Keyboard controls for tabs, groups, memory unloading, and video Picture-in-Picture.

## Install

1. Clone this repository and open `chrome://extensions`.
2. Enable **Developer mode**, click **Load unpacked**, and select the cloned folder.
3. Set shortcuts at `chrome://extensions/shortcuts` using the table below or
   [command-shortcuts.json](command-shortcuts.json). Only four are assigned by default.

## Settings

Click the extension's toolbar button, or choose **Extension options** at
`chrome://extensions`.

- Record, clear, or reset video, PiP, and search keys; edits apply to open pages.
- View live tab/browser assignments and open Chromium's shortcut editor to change them.
- Export Hyprland keys, paste them above the integration's `dofile(…)` line, and reload Hyprland.

Conflicting assignments are flagged before saving. Chromium controls its own
browser-wide keys, so extensions cannot edit those directly.

**Vimium C is required for the replacement new-tab page and `t` search.** Add this
extension's ID to Vimium C's external-command allowlist. Remove conflicting
Vimium bindings for Alt+Shift+P, Alt+M, Alt+C, and Alt+Shift+C if present.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Alt+J | Next tab in the current group |
| Alt+K | Previous tab in current group |
| Alt+H / Alt+L | Previous / next group, skipping collapsed groups |
| Alt+T | New tab in the current group |
| Alt+Shift+T | New ungrouped tab |
| Alt+Shift+J | Move tab down |
| Alt+W | Close tab |
| Alt+U | Unload tab and switch away |
| Alt+Shift+U | Unload group, turn it grey, collapse it, and switch away |
| Alt+M | Mute / unmute group |
| Alt+Shift+M | Mute group, collapse it, and switch away |
| Alt+C | Collapse / expand group |
| Alt+Shift+C | Expand all groups |
| Alt+Shift+P | Toggle Picture-in-Picture for a video on the page |
| Alt+P | Toggle video fullscreen |
| Alt+S | Toggle fullscreen |
| Ctrl+Shift+H | Open history |
| Ctrl+Shift+Y | Open downloads |
| Ctrl+Shift+P | Open private window |
| t | Open Vimium search in a new tab, outside text fields |

Tab and group navigation wraps within the current window; ungrouped tabs form
one section. Collapsing a group switches to the next available section.
Previous-tab and move-tab-up commands are unassigned; choose other keys for them
in Chromium's extension shortcut settings if needed.
Unloaded tabs stay in the sidebar and reload when selected. Muted groups show
`🔇` and turn grey; unmuting restores their original colour.

After reloading the extension, refresh existing pages to reactivate page shortcuts
such as Alt+Shift+P and Alt+P.

## Optional Hyprland integration

The included [Hyprland integration](integrations/README.md) adds PiP positioning,
Alt+Shift+P from the player to return focus to Chromium, new-tab focus handling,
and these native browser mappings. It works without Omarchy or private dotfiles.

| Shortcut | Action |
| --- | --- |
| Alt+Shift+S | Toggle vertical-tab sidebar |
| Alt+G | Open native group-name editor |
| Ctrl+H / Ctrl+L | Back / forward |
| Ctrl+Alt+Shift+S | Save page |
| Alt+P (PiP focused) | Toggle player fullscreen |

See [setup instructions](integrations/README.md#setup) to load the optional Lua file.

With the optional Hyprland integration, **Alt+O** opens native split view.
On Chromium 152, separate it using the split-view menu; the shortcut does not toggle it off.
