-- Run from the repository root: lua tests/hyprland.lua
local file = assert(io.open("integrations/hyprland.lua"))
local source = file:read("*a")
file:close()
local browser = { address = "browser", class = "chromium", title = "Video - Chromium", pid = 42, focus_history_id = 0 }
local pip = { address = "pip", class = "", title = "Picture in picture", pid = 42, floating = true, pinned = true,
  at = { x = 1790, y = 36 }, size = { x = 600, y = 338 },
  monitor = { x = 0, y = 0, width = 3440, height = 1440, scale = 1.6 } }
local other = { address = "other", class = "terminal", title = "Terminal" }
local active = browser
local windows = { browser, pip, other }
local bindings, events, timers, commands, rules = {}, {}, {}, {}, {}
local function action(kind)
  return function(args) return { kind = kind, args = args } end
end
hl = {
  get_active_window = function() return active end,
  get_windows = function() return windows end,
  get_window = function(selector)
    for _, window in ipairs(windows) do
      if selector == "address:" .. window.address then return window end
    end
  end,
  bind = function(key, callback) bindings[key] = callback end,
  unbind = function(key) bindings[key] = nil end,
  on = function(event, callback)
    events[event] = events[event] or {}
    table.insert(events[event], callback)
  end,
  timer = function(callback, options)
    local timer = { callback = callback, options = options, enabled = true }
    function timer:set_enabled(enabled) self.enabled = enabled end
    table.insert(timers, timer)
    return timer
  end,
  window_rule = function(rule) table.insert(rules, rule) end,
  exec_cmd = function(command) table.insert(commands, command) end,
  dispatch = function(command)
    table.insert(commands, command)
    if command.kind == "move" then pip.at = { x = command.args.x, y = command.args.y } end
  end,
  dsp = { send_key_state = action("key"), focus = action("focus"),
    window = { close = action("close"), move = action("move"), fullscreen = action("fullscreen"), pin = action("pin") } },
}
local function emit(event)
  for _, callback in ipairs(events[event] or {}) do callback() end
end
local function run_timers(timeout)
  local snapshot = { table.unpack(timers) }
  for _, timer in ipairs(snapshot) do
    if timer.enabled and timer.options.timeout == timeout then
      if timer.options.type == "oneshot" then timer.enabled = false end
      timer.callback()
    end
  end
end
-- A clone path with a space and apostrophe must remain safe in shell commands.
assert(load(source, "@/tmp/workflow test's clone/integrations/hyprland.lua"))()
assert(#rules == 1 and rules[1].float and rules[1].pin)
assert(bindings["ALT + G"] and bindings["CTRL + H"] and not bindings["ALT + J"])
assert(not bindings["ALT + F"], "Browser Alt+F is handled directly by the content script")
assert(pip.at.x == 1510, "Scaled PiP must fit the monitor")
pip.at = { x = 100, y = 100 }
run_timers(300)
assert(pip.at.x == 100 and pip.at.y == 100, "Keep visible manual placement")
pip.at.x = 1790
run_timers(300)
assert(pip.at.x == 1510, "Correct delayed off-screen changes")
active = other
emit("window.active")
assert(not bindings["ALT + G"] and not bindings["CTRL + H"])
assert(not bindings["ALT + F"])
active = pip
emit("window.active")
assert(bindings["ALT + P"] and not bindings["ALT + G"])
bindings["ALT + F"]()
assert(commands[#commands].kind == "fullscreen" and commands[#commands].args.window == "address:pip")
assert(commands[#commands - 1].kind == "pin" and commands[#commands - 1].args.action == "unset")
pip.fullscreen = 2
pip.at.x = 1790
run_timers(300)
assert(pip.at.x == 1790, "Do not reposition fullscreen PiP")
bindings["ALT + F"]()
assert(commands[#commands].kind == "pin" and commands[#commands].args.action == "set")
pip.fullscreen = 0
bindings["ALT + P"]()
assert(commands[#commands].kind == "close")
run_timers(100)
assert(commands[#commands].kind == "focus" and commands[#commands].args.window == "address:browser")
active = browser
emit("window.active")
assert(not bindings["ALT + P"])
browser.title = "Vimium New Tab - Chromium"
emit("window.title")
browser.title = "Blank Page - Chromium"
run_timers(650)
local command = commands[#commands]
assert(type(command) == "string" and command:find("focus-newtab.sh", 1, true))
assert(command:find([[test'"'"'s]], 1, true), "Quote apostrophes in clone paths")
local count = #commands
browser.title = "Vimium New Tab - Chromium"
emit("window.title")
active = other
run_timers(650)
assert(#commands == count, "Do not steal focus after switching apps")
print("PASS: standalone loading, scoped bindings, PiP bounds and focus return, safe new-tab handoff")
