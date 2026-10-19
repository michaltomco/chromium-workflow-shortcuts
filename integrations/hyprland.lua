-- Optional Hyprland Lua integration. No Omarchy dependencies.
-- Load once from hyprland.lua: dofile("/path/to/repo/integrations/hyprland.lua")
local source = debug.getinfo(1, "S").source
local root = assert(source:match("^@(.*)/integrations/[^/]+$"),
  "Load the integration with dofile using an absolute path")
local function shell_quote(value)
  return "'" .. value:gsub("'", "'\"'\"'") .. "'"
end
local focus_command = "bash " .. shell_quote(root .. "/focus-newtab.sh")
local function bind(keys, description, callback)
  hl.bind(keys, callback, { description = description })
end

-- Optional overrides exported by the extension's settings page.
local hotkeys = {
  verticalSidebar = "ALT + SHIFT + S", newGroup = "ALT + G",
  back = "CTRL + H", forward = "CTRL + L", savePage = "CTRL + ALT + SHIFT + S",
  videoFullscreen = "ALT + P", pictureInPicture = "ALT + SHIFT + P",
}
local overrides = rawget(_G, "chromium_workflow_shortcuts") or {}
for name in pairs(hotkeys) do
  if overrides[name] ~= nil then
    assert(type(overrides[name]) == "string", "Invalid shortcut for " .. name)
    hotkeys[name] = overrides[name]
  end
end

-- Standalone Hyprland needs these rules; Omarchy already supplies equivalents.
hl.window_rule({
  name = "chromium-workflow-pip",
  match = { title = "(Picture.?in.?[Pp]icture)" },
  float = true,
  pin = true,
  size = { 600, 338 },
  keep_aspect_ratio = true,
})

-- While Alt+G's native naming popup is open, defer the new-tab focus handoff.
local chromium_newtab_focus_generation = 0
local chromium_group_naming = nil
local function finish_chromium_group_name()
  local address = chromium_group_naming
  chromium_newtab_focus_generation = chromium_newtab_focus_generation + 1
  chromium_group_naming = nil
  hl.unbind("RETURN")
  hl.dispatch(hl.dsp.send_key_state({ mods = "", key = "code:36", state = "down" }))
  hl.timer(function()
    hl.dispatch(hl.dsp.send_key_state({ mods = "", key = "code:36", state = "up" }))
    hl.timer(function()
      local active = hl.get_active_window()
      if active and active.class == "chromium" and active.address == address
          and active.title == "Blank Page - Chromium" then
        hl.exec_cmd(focus_command .. " " .. shell_quote(address) .. " --after-group")
      end
    end, { timeout = 200, type = "oneshot" })
  end, { timeout = 50, type = "oneshot" })
end

-- Native browser actions without extension API equivalents, plus reserved keys.
-- Install only while Chromium is focused so other apps keep their shortcuts.
do
  local shortcuts = {
    { hotkeys.verticalSidebar, "Toggle vertical tab sidebar", "CTRL + SHIFT", "L" },
    { hotkeys.newGroup, "New tab group", "ALT + SHIFT", "P" },
    -- Other Chromium shortcuts are registered directly by the extension.
    -- Alt+D already focuses Chromium's address bar without a remap.
    -- Ctrl+J/K reach Vimium C for Vomnibar suggestion navigation.
    { hotkeys.back, "Back", "ALT", "Left" },
    { hotkeys.forward, "Forward", "ALT", "Right" },
    { hotkeys.savePage, "Save page", "CTRL", "S" },
  }
  for i = #shortcuts, 1, -1 do
    if shortcuts[i][1] == "" then table.remove(shortcuts, i) end
  end
  local installed = false
  local function refresh_chromium_shortcuts()
    local window = hl.get_active_window()
    local wanted = window ~= nil and window.class == "chromium"
      and not window.title:find("Shortcut settings · Chromium Workflow Shortcuts", 1, true)
    if chromium_group_naming and (not wanted or window.address ~= chromium_group_naming) then
      chromium_group_naming = nil
      hl.unbind("RETURN")
    end
    if wanted == installed then return end
    for _, shortcut in ipairs(shortcuts) do
      hl.unbind(shortcut[1])
      if wanted then
        bind(shortcut[1], "Chromium: " .. shortcut[2], function()
          if shortcut[1] == hotkeys.newGroup then
            local active = hl.get_active_window()
            chromium_group_naming = active and active.address or nil
            hl.unbind("RETURN")
            bind("RETURN", "Chromium: Finish naming group", finish_chromium_group_name)
          end
          -- Explicit down/up follows Omarchy's clipboard bindings, avoiding
          -- synthetic modifiers remaining pressed after send_shortcut.
          hl.dispatch(hl.dsp.send_key_state({ mods = shortcut[3], key = shortcut[4], state = "down" }))
          hl.timer(function()
            hl.dispatch(hl.dsp.send_key_state({ mods = shortcut[3], key = shortcut[4], state = "up" }))
          end, { timeout = 50, type = "oneshot" })
        end)
      end
    end
    installed = wanted
  end
  hl.on("window.active", refresh_chromium_shortcuts)
  hl.on("window.title", refresh_chromium_shortcuts)
  hl.on("config.reloaded", refresh_chromium_shortcuts)
  refresh_chromium_shortcuts()
end

-- The separate PiP surface cannot receive the page extension's video handlers.

do
  local installed = false
  local last_chromium_address = nil
  local fullscreen_pins = {}
  local function is_pip(window)
    return window and window.floating
      and window.title:lower():match("^picture.?in.?picture$") ~= nil
  end
  local function refresh_pip_shortcut()
    local active = hl.get_active_window()
    if active and active.class == "chromium" then last_chromium_address = active.address end
    local wanted = not not is_pip(active)
    if wanted == installed then return end
    if hotkeys.pictureInPicture ~= "" then hl.unbind(hotkeys.pictureInPicture) end
    if hotkeys.videoFullscreen ~= "" then hl.unbind(hotkeys.videoFullscreen) end
    if wanted then
      if hotkeys.videoFullscreen ~= "" then
        bind(hotkeys.videoFullscreen, "PiP: Toggle fullscreen", function()
          local window = hl.get_active_window()
          if is_pip(window) then
            local target = "address:" .. window.address
            if (window.fullscreen or 0) ~= 0 then
              hl.dispatch(hl.dsp.window.fullscreen({ window = target, mode = "fullscreen", action = "unset" }))
              if fullscreen_pins[window.address] then
                hl.dispatch(hl.dsp.window.pin({ window = target, action = "set" }))
              end
              fullscreen_pins[window.address] = nil
            else
              fullscreen_pins[window.address] = window.pinned
              if window.pinned then
                hl.dispatch(hl.dsp.window.pin({ window = target, action = "unset" }))
              end
              hl.dispatch(hl.dsp.window.fullscreen({ window = target, mode = "fullscreen", action = "set" }))
            end
          end
        end)
      end
      if hotkeys.pictureInPicture ~= "" then
        bind(hotkeys.pictureInPicture, "PiP: Return video to browser tab", function()
          local window = hl.get_active_window()
          if is_pip(window) then
            local browser = last_chromium_address
              and hl.get_window("address:" .. last_chromium_address) or nil
            if not browser or browser.class ~= "chromium" or browser.pid ~= window.pid then
              browser = nil
              for _, candidate in ipairs(hl.get_windows()) do
                if candidate.class == "chromium" and candidate.pid == window.pid
                    and (not browser or candidate.focus_history_id < browser.focus_history_id) then
                  browser = candidate
                end
              end
            end
            local browser_address = browser and browser.address
            hl.dispatch(hl.dsp.window.close({ window = "address:" .. window.address }))
            if browser_address then
              hl.timer(function()
                if hl.get_window("address:" .. browser_address) then
                  hl.dispatch(hl.dsp.focus({ window = "address:" .. browser_address }))
                end
              end, { timeout = 100, type = "oneshot" })
            end
          end
        end)
      end
    end
    installed = wanted
  end
  hl.on("window.active", refresh_pip_shortcut)
  hl.on("config.reloaded", refresh_pip_shortcut)
  refresh_pip_shortcut()
end

-- Chromium retains native address-bar focus when its New Tab page is replaced.
-- Only the transient title of our local replacement starts this handoff.
do
  hl.on("window.title", function()
    local window = hl.get_active_window()
    if not window or window.class ~= "chromium"
        or window.title ~= "Vimium New Tab - Chromium" then return end
    chromium_newtab_focus_generation = chromium_newtab_focus_generation + 1
    local request = chromium_newtab_focus_generation
    local address = window.address
    hl.timer(function()
      local active = hl.get_active_window()
      if chromium_group_naming == address or request ~= chromium_newtab_focus_generation or not active or active.address ~= address
          or active.class ~= "chromium" or active.title ~= "Blank Page - Chromium" then return end
      hl.exec_cmd(focus_command .. " " .. shell_quote(address))
    end, { timeout = 650, type = "oneshot" })
  end)
end

-- Chromium PiP has an empty class. Check actual bounds after asynchronous
-- sizing/position changes; preserve manual placement whenever it is visible.
do
  local function keep_pip_visible()
    for _, window in ipairs(hl.get_windows()) do
      if window.title:lower():match("^picture.?in.?picture$") and window.floating
          and (window.fullscreen or 0) == 0 then
        local monitor = window.monitor
        if monitor then
          local width = math.floor(monitor.width / monitor.scale + 0.5)
          local height = math.floor(monitor.height / monitor.scale + 0.5)
          local max_x = monitor.x + math.max(0, width - window.size.x)
          local max_y = monitor.y + math.max(0, height - window.size.y)
          if window.at.x < monitor.x or window.at.x > max_x
              or window.at.y < monitor.y or window.at.y > max_y then
            local x = math.max(monitor.x, math.min(window.at.x, max_x - 40))
            local y = math.max(monitor.y, math.min(window.at.y, max_y - 40))
            hl.dispatch(hl.dsp.window.move({
              window = "address:" .. window.address, x = x, y = y, relative = false,
            }))
          end
        end
      end
    end
  end
  local visibility_timer = hl.timer(keep_pip_visible, { timeout = 300, type = "repeat" })
  hl.on("config.reloaded", function()
    visibility_timer:set_enabled(true)
    keep_pip_visible()
  end)
  keep_pip_visible()
end
