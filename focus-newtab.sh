#!/usr/bin/env bash
# Chromium's focus cycle passes the toolbar before reaching the page.
set -eu
still_on_new_tab() {
  hyprctl activewindow -j | jq -e --arg address "$1" '
    (.address | ltrimstr("0x")) == ($address | ltrimstr("0x"))
    and (.class == "chromium" or .class == "chromium-browser") and .title == "Blank Page - Chromium"
  ' >/dev/null
}
# Closing the group editor can leave a different native focus position.
if [[ "${2:-}" == "--after-group" ]]; then
  still_on_new_tab "$1" || exit 0
  hyprctl dispatch 'hl.dsp.send_key_state({mods="CTRL",key="code:46",state="down"})' >/dev/null
  sleep 0.05
  hyprctl dispatch 'hl.dsp.send_key_state({mods="CTRL",key="code:46",state="up"})' >/dev/null
  sleep 0.05
fi
for step in 1 2; do
  still_on_new_tab "$1" || exit 0
  hyprctl dispatch 'hl.dsp.send_key_state({mods="",key="code:72",state="down"})' >/dev/null
  sleep 0.05
  hyprctl dispatch 'hl.dsp.send_key_state({mods="",key="code:72",state="up"})' >/dev/null
  sleep 0.05
done
