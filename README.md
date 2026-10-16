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
Hyprland captures Alt+J/K in Chromium and sends Ctrl+Shift+9/8 to the extension.
Alt+H/L send Ctrl+Shift+4/5. Assign these two section-switching shortcuts once in
`chrome://extensions/shortcuts` when installing the extension on a new profile.
This prevents websites and other extensions from using the original keys for
scrolling. The document-start listener also handles Alt+J/K when used without
the compositor mappings.
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
