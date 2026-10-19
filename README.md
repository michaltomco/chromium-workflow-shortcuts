# Tab Group Cycle

Local Manifest V3 extension. Alt+J selects the next tab in the current group;
Alt+K selects the previous tab, wrapping at both ends. Ungrouped tabs form their
own cycle within the current window. A group with one tab stays on that tab.
Alt+H/L switch between groups and ungrouped tabs as one additional stop, wrapping
at the ends. The last visited tab in each stop is remembered while the worker
is running; when unavailable, the first tab is selected. Stops follow the order
of their first tab in the tab strip, and switching stays within the current window.
Alt+T opens a new tab beside the active tab in the same group. Alt+Shift+T
opens an ungrouped tab after the current group. From an ungrouped tab, both
shortcuts create an ungrouped tab.
On websites, a document-start keyboard listener catches Alt+J/K before page
handlers, including in frames and text fields. It does not inspect page contents
or make network requests. Browser command shortcuts cover internal browser pages.
Outside text fields, plain `t` also forwards the configured new-tab Vomnibar
command to Vimium C before website handlers can claim it. Vimium C must allow
this local extension ID in its external command allowlist; the saved Vimium C
export includes that entry. This does not intercept typing in text fields.

Loaded by `~/.config/chromium-flags.conf` after fully exiting and reopening
Chromium. Shortcuts can be checked at `chrome://extensions/shortcuts`.
Custom browser shortcuts run directly through extension commands, including
Alt+J/K, Alt+H/L, Alt+T, and Alt+Shift+T. See `command-shortcuts.json` for
the complete mapping to restore in Chromium's extension shortcut settings.
The launch flag points directly to this repository directory: Chromium did not
load content scripts through the individually Stow-linked resource files.

New tabs hand off to Vimium C’s built-in blank page through its external
`openUrl` command, using the same extension allowlist as the `t` bridge.
Vimium shortcuts such as `t` and `w` work on this page. Vimium C must be installed. This also applies to
Ctrl+T and the grouped/ungrouped new-tab shortcuts.

New tabs automatically open the Vomnibar after the blank page loads. Selecting
a result navigates that new tab, keeping its group membership.

The Hyprland `window.title` hook recognizes the replacement’s brief title marker
and runs `focus-newtab.sh` after navigation settles. This moves native Chromium
focus through its toolbar into the already open Vomnibar. It runs only while
the requesting Chromium window remains active on the blank page.

After Alt+G, focus stays in Chromium’s group-name field. Type a name and press
Enter to close the editor and move focus to the Vimium bar. Switching to another
window cancels the temporary Enter binding.

Alt+P toggles Picture-in-Picture for a ready video in the current page/frame,
preferring a playing video and then the largest player. Vimium’s default Alt+P
pin-tab binding is removed. After reloading the local extension, refresh open
video pages once to load the updated content script.

Alt+M toggles mute for all current tabs in the active group, within the current
window. If any tab is unmuted, all are muted; if all are muted, all are unmuted.
Other groups are unchanged, including tabs from the same website. An ungrouped
tab toggles only itself. Vimium’s single-tab Alt+M mapping is removed. Assign
“Mute or unmute current tab group” to Alt+M in `chrome://extensions/shortcuts`
on a new profile; this command has no manifest default because Chromium permits
only four suggested extension shortcuts.

Fully muted groups display a `🔇 ` prefix (for example, `🔇 Chats`). Unmuting
any tab removes the prefix. The indicator follows manual mute changes, group
renames, and tab membership changes, and is reconciled when the worker starts.
Unnamed muted groups display `🔇` and return to an empty title when unmuted.
This uses the `tabGroups` permission and reserves that leading prefix as a marker.

Alt+C collapses or expands the active tab group; Vimium’s default Alt+C previous-
tab shortcut is removed. Assign “Collapse or expand current tab group” to Alt+C
in Chromium’s extension shortcuts when restoring on another profile. Ungrouped
tabs do nothing unless the worker remembers a group just collapsed in that
window, in which case Alt+C reopens it and restores its active tab.

Alt+H/L skip collapsed tab groups. Expanded groups and ungrouped tabs remain
in the cycle, in tab-strip order. If no other eligible section exists, the
active tab stays unchanged. Collapsing the active group does not break direction
when leaving it, and navigation never reopens a skipped collapsed group.

Alt+Shift+C expands all collapsed tab groups in the current window without
switching the active tab or changing other windows. Vimium’s default Alt+Shift+C
next-tab mapping is removed. On a fresh profile, assign “Expand all tab groups
in current window” to Alt+Shift+C in Chromium’s extension shortcut settings.

Fully muted groups also turn grey, making their muted state visible in the
collapsed sidebar. The original colour is saved in local extension storage and
restored when any tab is unmuted. Recolouring a muted group changes the colour
that will be restored. On browser restart, uniquely named marked groups can
recover their saved colour even if Chromium changes their group IDs; ambiguous
same-name groups are not guessed. An originally grey group keeps its grey colour.

Alt+Shift+M mutes every current tab in the active group, collapses that group,
and advances to the next expanded group or ungrouped tabs, wrapping like Alt+L.
It always mutes, even if the group is already muted. Other groups and windows
are unchanged. On an ungrouped tab it does nothing; with no other eligible
section it mutes/collapses the group without switching. Assign “Mute and
collapse group, then switch to next” to Alt+Shift+M when restoring a profile.

When Alt+C collapses the current group, it also advances like Alt+L to the next
expanded group or ungrouped tabs, wrapping at the end. Expanding a group does not
advance. If no other eligible section exists, focus remains on the current tab.
Alt+Shift+C remains expand-all and does not change focus.

## Native browser shortcut registration

`command-shortcuts.json` records the browser-scoped command assignments registered
at `chrome://extensions/shortcuts` for this unpacked extension. The manifest sets
four defaults (Chromium's maximum); the remaining keys are user assignments.
Keep the JSON map in sync when changing those assignments.

Most custom shortcuts run directly through `chrome.commands` and browser APIs.
Alt+D uses Chromium's built-in address-bar shortcut.

Five mappings remain in `hypr/bindings.lua` to preserve native behavior:

- Alt+Shift+S: native vertical-tab sidebar toggle (no extension API).
- Alt+G: native group editor and naming popup (no extension API).
- Ctrl+H / Ctrl+L: Back / Forward, replacing browser-reserved shortcuts.
- Ctrl+Alt+Shift+S: native Save Page dialog (no extension API; Ctrl+Alt
  combinations are also unavailable to extension commands).

These desktop mappings are installed only while Chromium is focused.

Alt+U switches away from the current tab, then unloads it. Alt+Shift+U switches
to the next eligible section, turns the current group grey, collapses it, and
unloads its tabs. If no other eligible section exists, it opens a blank tab
first. Selecting an unloaded tab reloads it; unloading does not close tabs.

While the separate PiP player is focused, Hyprland handles Alt+P to close it
and return focus to its Chromium window. The PiP bounds check keeps the player
fully on-screen after asynchronous size changes, preserving visible manual
placement. These PiP helpers also match the player's empty window class.
