# Chromium Workflow Shortcuts

Keyboard controls for tabs, groups, memory unloading, and video Picture-in-Picture.

## Install

1. Clone this repository and open `chrome://extensions`.
2. Enable **Developer mode**, click **Load unpacked**, and select the cloned folder.
3. Set shortcuts at `chrome://extensions/shortcuts` using the table below or
   [command-shortcuts.json](command-shortcuts.json). Only four are assigned by default (Alt+J, Alt+K, Alt+T, Alt+Shift+O).

## Settings

Click the extension's toolbar button, or choose **Extension options** at
`chrome://extensions`.

- Add up to **10 tab-group presets** with their own names, colors, and URL lists.
- Use each preset’s **Set shortcuts** button to assign its **Group N: toggle** command in Chromium. The same key opens/unmutes or mutes/collapses the group. Chat keeps Alt+M.
- Change video, PiP, search, and tab keys in Chromium’s shortcut editor.
- View live tab/browser assignments and open Chromium's shortcut editor to change them.
- Export Hyprland keys, paste them above the integration's `dofile(…)` line, and reload Hyprland.

By default, presets manage their own tabs without reading other tabs. Enable **Reuse matching tabs** to allow existing-tab detection; turning it off revokes the optional `tabs` permission. Chromium calls this permission “Read your browsing history”; the feature uses open-tab URLs and titles, not the history API.

Video controls use temporary `activeTab` access only when invoked. There are no automatic page scripts or permanent website permissions. Videos embedded from another website may need to be opened in their own tab.

Conflicting assignments are flagged before saving. Chromium controls its own
browser-wide keys, so extensions cannot edit those directly.

**Vimium C is required for the replacement new-tab page and `t` search.** Add this
extension's ID to Vimium C's external-command allowlist. For plain `t` search, add `map t Vomnibar.activateInNewTab` to Vimium C’s key mappings. Remove conflicting Vimium bindings if present.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Alt+J | Next tab in the current group |
| Alt+K | Previous tab in current group |
| Alt+H / Alt+L | Previous / next group, skipping collapsed groups |
| Alt+T | New tab in the current group |
| Alt+Shift+T | New ungrouped tab |
| Alt+Shift+J / Alt+Shift+K | Move tab down / up |
| Alt+W | Close tab |
| Alt+U | Unload tab and switch away |
| Alt+Shift+U | Unload group, turn it grey, collapse it, and switch away |
| Alt+M | Toggle Chat: open/unmute/focus, or mute/collapse when expanded |
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
Video, PiP, and move-tab-up commands are unassigned on a fresh install; choose keys for them
in Chromium's extension shortcut settings if needed.
Unloaded tabs stay in the sidebar and reload when selected. Muted groups show
`🔇` and turn grey; unmuting restores their original colour.

When upgrading from 1.x, reload the extension and refresh existing pages to remove the old page listeners. Video keys now live at `chrome://extensions/shortcuts`; set **Video fullscreen** to Alt+P and **Picture-in-Picture** to Alt+Shift+P, or use your preferred keys. Custom video keys from the old settings page must be reassigned there.

## Optional Hyprland integration

The included [Hyprland integration](integrations/README.md) adds PiP positioning,
Alt+Shift+P from the player to return focus to Chromium, new-tab focus handling,
and these native browser mappings. It works without Omarchy or private dotfiles.

| Shortcut | Action |
| --- | --- |
| Alt+Shift+S | Toggle vertical-tab sidebar |
| Alt+G | Open native group-name editor |
| Alt+Shift+K | Move tab up (works without a native extension assignment) |
| Ctrl+H / Ctrl+L | Back / forward |
| Ctrl+Alt+Shift+S | Save page |
| Alt+P (PiP focused) | Toggle player fullscreen |

See [setup instructions](integrations/README.md#setup) to load the optional Lua file.

With the optional Hyprland integration, **Alt+O** opens native split view.
**Alt+Shift+O** separates the focused split into regular tabs, including from the split picker or address bar.
If upgrading from an earlier version, check that “Separate split view into regular tabs” is assigned
to **Alt+Shift+O** at `chrome://extensions/shortcuts`.

With optional existing-tab detection, presets reuse matching tabs across Chromium windows and keep tabs owned by other presets separate. A toggle opens/unmutes/focuses a collapsed group, or mutes/collapses an expanded one. Removing a preset keeps its browser tabs open.
