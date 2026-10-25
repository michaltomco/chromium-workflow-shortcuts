#!/usr/bin/env bash
# Chromium's focus cycle passes the toolbar before reaching the page.
set -eu
expected_title="Blank Page - Chromium"
source_title=""
steps=2
if [[ "${2:-}" == "--split" ]]; then
  expected_title="Vimium Split New Tab - Chromium"
  # F6 passes through the original pane before reaching the new pane.
  source_title="${3:-}"
  steps=3
fi
still_on_new_tab() {
  hyprctl activewindow -j | jq -e --arg address "$1" --arg title "$expected_title" --arg source "$source_title" '
    (.address | ltrimstr("0x")) == ($address | ltrimstr("0x"))
    and (.class == "chromium" or .class == "chromium-browser")
    and (.title == $title or ($source != "" and .title == $source))
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
for ((step = 0; step < steps; step++)); do
  still_on_new_tab "$1" || exit 0
  hyprctl dispatch 'hl.dsp.send_key_state({mods="",key="code:72",state="down"})' >/dev/null
  sleep 0.05
  hyprctl dispatch 'hl.dsp.send_key_state({mods="",key="code:72",state="up"})' >/dev/null
  sleep 0.05
done
