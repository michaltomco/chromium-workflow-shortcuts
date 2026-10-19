# Chromium Workflow Shortcuts

Keyboard controls for tabs, groups, memory unloading, and video Picture-in-Picture.

## Install

1. Clone this repository and open `chrome://extensions`.
2. Enable **Developer mode**, click **Load unpacked**, and select the cloned folder.
3. Set shortcuts at `chrome://extensions/shortcuts` using the table below or
   [command-shortcuts.json](command-shortcuts.json). Only four are assigned by default.

**Vimium C is required for the replacement new-tab page and `t` search.** Add this
extension's ID to Vimium C's external-command allowlist. Remove conflicting
Vimium bindings for Alt+P, Alt+M, Alt+C, and Alt+Shift+C if present.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Alt+J / Alt+K | Next / previous tab in the current group |
| Alt+H / Alt+L | Previous / next group, skipping collapsed groups |
| Alt+T | New tab in the current group |
| Alt+Shift+T | New ungrouped tab |
| Alt+Shift+J / Alt+Shift+K | Move tab down / up |
| Alt+W | Close tab |
| Alt+U | Unload tab and switch away |
| Alt+Shift+U | Unload group, turn it grey, collapse it, and switch away |
| Alt+M | Mute / unmute group |
| Alt+Shift+M | Mute group, collapse it, and switch away |
| Alt+C | Collapse / expand group |
| Alt+Shift+C | Expand all groups |
| Alt+P | Toggle Picture-in-Picture for a video on the page |
| Alt+S | Toggle fullscreen |
| Ctrl+Shift+H | Open history |
| Ctrl+Shift+Y | Open downloads |
| Ctrl+Shift+P | Open private window |
| t | Open Vimium search in a new tab, outside text fields |

Tab and group navigation wraps within the current window; ungrouped tabs form
one section. Collapsing a group switches to the next available section.
Unloaded tabs stay in the sidebar and reload when selected. Muted groups show
`🔇` and turn grey; unmuting restores their original colour.

After reloading the extension, refresh existing pages to reactivate page shortcuts
such as Alt+P.

## Optional Hyprland integration

The included [Hyprland integration](integrations/README.md) adds PiP positioning,
Alt+P from the player to return focus to Chromium, new-tab focus handling,
and these native browser mappings. It works without Omarchy or private dotfiles.

| Shortcut | Action |
| --- | --- |
| Alt+Shift+S | Toggle vertical-tab sidebar |
| Alt+G | Open native group-name editor |
| Ctrl+H / Ctrl+L | Back / forward |
| Ctrl+Alt+Shift+S | Save page |

See [setup instructions](integrations/README.md#setup) to load the optional Lua file.
