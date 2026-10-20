// Chromium 152 exposes split IDs but has no dedicated separation API.
async function separateSplitView(sourceTabId) {
  const active = sourceTabId === undefined
    ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    : await chrome.tabs.get(sourceTabId);
  if (!active?.active || !(active.splitViewId >= 0)) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  const pair = tabs.filter(tab => tab.splitViewId === active.splitViewId);
  if (pair.length !== 2) return;
  // A temporary neighbour guarantees space outside the split, even in a
  // two-tab window or a pinned/grouped split. Moving within the pair only swaps it.
  const placeholder = await chrome.tabs.create({ windowId: active.windowId,
    index: Math.max(...pair.map(tab => tab.index)) + 1,
    url: "about:blank", active: false, pinned: active.pinned });
  try {
    if (active.groupId >= 0) await chrome.tabs.group({ tabIds: placeholder.id, groupId: active.groupId });
    const target = await chrome.tabs.get(placeholder.id);
    await chrome.tabs.move(active.id, { index: target.index });
  } finally {
    try {
      await chrome.tabs.move(active.id, { index: active.index });
    } finally {
      await chrome.tabs.remove(placeholder.id);
    }
  }
}

const lastCollapsedGroupByWindow = new Map();

async function unloadCurrentTab() {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!active) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  const groups = await chrome.tabGroups.query({ windowId: active.windowId });
  const collapsed = new Set(groups.filter(group => group.collapsed).map(group => group.id));
  const candidates = tabs.filter(tab => tab.id !== active.id && !collapsed.has(tab.groupId));
  // Prefer a loaded neighbour in the same group; create a blank tab if alone.
  candidates.sort((a, b) => Number(a.discarded) - Number(b.discarded)
    || Number(b.groupId === active.groupId) - Number(a.groupId === active.groupId)
    || Math.abs(a.index - active.index) - Math.abs(b.index - active.index));
  if (candidates.length) {
    await chrome.tabs.update(candidates[0].id, { active: true });
  } else {
    await chrome.tabs.create({ windowId: active.windowId, url: "about:blank", active: true });
  }
  // An explicit ID prevents accidentally discarding an unrelated tab.
  await chrome.tabs.discard(active.id);
}

async function expandAllGroups(sourceTabId) {
  const active = sourceTabId === undefined
    ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    : await chrome.tabs.get(sourceTabId);
  if (!active?.active) return;
  const groups = await chrome.tabGroups.query({ windowId: active.windowId, collapsed: true });
  await Promise.all(groups.map(group => chrome.tabGroups.update(group.id, { collapsed: false })));
  lastCollapsedGroupByWindow.delete(active.windowId);
}

async function toggleGroupCollapsed(sourceTabId) {
  const active = sourceTabId === undefined
    ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    : await chrome.tabs.get(sourceTabId);
  if (!active?.active) return;
  const remembered = lastCollapsedGroupByWindow.get(active.windowId);
  const groupId = active.groupId >= 0 ? active.groupId : remembered?.groupId;
  if (groupId === undefined) return;
  let group;
  try { group = await chrome.tabGroups.get(groupId); } catch {
    lastCollapsedGroupByWindow.delete(active.windowId);
    return;
  }
  if (group.windowId !== active.windowId || (active.groupId < 0 && !group.collapsed)) return;
  const collapsed = !group.collapsed;
  // Choose the next eligible section before hiding the active group, so the
  // browser cannot substitute a different destination during collapse.
  if (collapsed) await cycleTabSection(1, active.id);
  await chrome.tabGroups.update(group.id, { collapsed });
  if (collapsed) {
    lastCollapsedGroupByWindow.set(active.windowId, { groupId, tabId: active.id });
  } else {
    lastCollapsedGroupByWindow.delete(active.windowId);
    if (active.groupId < 0 && remembered) {
      const tab = await chrome.tabs.get(remembered.tabId).catch(() => null);
      if (tab?.windowId === active.windowId && tab.groupId === groupId) {
        await chrome.tabs.update(tab.id, { active: true });
      }
    }
  }
}

const GROUP_MUTE_PREFIX = "🔇 ";
const MUTE_COLOR_STORAGE_KEY = "mutedGroupOriginalColors";
let savedMuteColors;
async function getSavedMuteColors() {
  if (!savedMuteColors) {
    savedMuteColors = chrome.storage.local.get(MUTE_COLOR_STORAGE_KEY)
      .then(data => data[MUTE_COLOR_STORAGE_KEY] || {});
  }
  return savedMuteColors;
}
async function saveMuteColors(colors) {
  await chrome.storage.local.set({ [MUTE_COLOR_STORAGE_KEY]: colors });
}

async function syncGroupMuteIndicator(groupId) {
  let group;
  try { group = await chrome.tabGroups.get(groupId); } catch { return; }
  const tabs = await chrome.tabs.query({ windowId: group.windowId, groupId });
  if (!tabs.length) return;
  const title = group.title || "";
  const marked = title.startsWith(GROUP_MUTE_PREFIX) || title === "🔇";
  const baseTitle = title.startsWith(GROUP_MUTE_PREFIX)
    ? title.slice(GROUP_MUTE_PREFIX.length) : title === "🔇" ? "" : title;
  const muted = tabs.every(tab => tab.mutedInfo?.muted);
  const nextTitle = muted ? (baseTitle ? GROUP_MUTE_PREFIX + baseTitle : "🔇") : baseTitle;
  const colors = await getSavedMuteColors();
  let original = colors[groupId];
  // Group IDs change after a browser restart. Recover a uniquely named marked
  // group only when its old ID no longer belongs to another live group.
  if (!original && marked && group.color === "grey") {
    const liveIds = new Set((await chrome.tabGroups.query({})).map(g => String(g.id)));
    const matches = Object.entries(colors).filter(([id, value]) =>
      value.title === baseTitle && !liveIds.has(id));
    if (matches.length === 1) {
      const [oldId, value] = matches[0];
      original = colors[groupId] = value;
      delete colors[oldId];
      await saveMuteColors(colors);
    }
  }
  const update = {};
  if (nextTitle !== title) update.title = nextTitle;
  if (muted) {
    if (!original || original.title !== baseTitle || group.color !== "grey") {
      colors[groupId] = {
        color: group.color !== "grey" ? group.color : original?.color || group.color,
        title: baseTitle
      };
      // Save before applying grey so a suspended/reloaded worker loses nothing.
      await saveMuteColors(colors);
    }
    if (group.color !== "grey") update.color = "grey";
  } else if (original && group.color !== original.color) {
    update.color = original.color;
  }
  if (Object.keys(update).length) {
    try { await chrome.tabGroups.update(groupId, update); } catch { return; }
  }
  if (!muted && original) {
    delete colors[groupId];
    await saveMuteColors(colors);
  }
}

async function syncAllGroupMuteIndicators() {
  const groups = await chrome.tabGroups.query({});
  // Serialize storage changes while reconciling several groups.
  for (const group of groups) await syncGroupMuteIndicator(group.id);
}

async function unloadCollapseAndAdvance() {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!active?.active || active.groupId < 0) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId, groupId: active.groupId });
  await cycleTabSection(1, active.id);
  const [destination] = await chrome.tabs.query({ active: true, windowId: active.windowId });
  // With no other expanded section, move outside the group before unloading.
  if (!destination || destination.groupId === active.groupId) {
    await chrome.tabs.create({ windowId: active.windowId, url: "about:blank", active: true });
  }
  await chrome.tabGroups.update(active.groupId, { collapsed: true, color: "grey" });
  lastCollapsedGroupByWindow.set(active.windowId, { groupId: active.groupId, tabId: active.id });
  const results = await Promise.allSettled(tabs.filter(tab => !tab.discarded)
    .map(tab => chrome.tabs.discard(tab.id)));
  for (const result of results) {
    if (result.status === "rejected") console.error("Could not unload group tab", result.reason);
  }
}

async function cycleTabInGroup(direction, sourceTabId) {
  const active = sourceTabId === undefined
    ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    : await chrome.tabs.get(sourceTabId);
  if (!active) return;
  if (!active.active) return;

  const tabs = await chrome.tabs.query({ windowId: active.windowId, groupId: active.groupId });
  tabs.sort((a, b) => a.index - b.index);
  const index = tabs.findIndex(tab => tab.id === active.id);
  if (index < 0 || tabs.length < 2) return;

  const next = tabs[(index + direction + tabs.length) % tabs.length];
  await chrome.tabs.update(next.id, { active: true });
}

async function createTabInGroup(inCurrentGroup, sourceTabId) {
  const active = sourceTabId === undefined
    ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    : await chrome.tabs.get(sourceTabId);
  if (!active?.active) return;

  let index = active.index + 1;
  if (!inCurrentGroup && active.groupId >= 0) {
    const group = await chrome.tabs.query({ windowId: active.windowId, groupId: active.groupId });
    index = Math.max(...group.map(tab => tab.index)) + 1;
  }
  const created = await chrome.tabs.create({ windowId: active.windowId, index, active: false });
  if (inCurrentGroup && active.groupId >= 0) {
    await chrome.tabs.group({ groupId: active.groupId, tabIds: [created.id] });
  } else if ((await chrome.tabs.get(created.id)).groupId >= 0) {
    await chrome.tabs.ungroup(created.id);
  }
  await chrome.tabs.update(created.id, { active: true });
}

const lastTabBySection = new Map();
async function cycleTabSection(direction, sourceTabId) {
  const active = sourceTabId === undefined
    ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    : await chrome.tabs.get(sourceTabId);
  if (!active?.active) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  tabs.sort((a, b) => a.index - b.index);
  const sections = new Map();
  for (const tab of tabs) {
    if (!sections.has(tab.groupId)) sections.set(tab.groupId, []);
    sections.get(tab.groupId).push(tab);
  }
  const groups = [...sections.keys()];
  if (groups.length < 2) return;
  const collapsed = new Set((await chrome.tabGroups.query({
    windowId: active.windowId, collapsed: true
  })).map(group => group.id));
  lastTabBySection.set(`${active.windowId}:${active.groupId}`, active.id);
  const index = groups.indexOf(active.groupId);
  let nextGroup;
  // Keep the current group's position even if it is collapsed, so direction
  // still follows tab-strip order when leaving a collapsed active group.
  for (let step = 1; step < groups.length; step++) {
    const candidate = groups[(index + direction * step + groups.length) % groups.length];
    if (candidate < 0 || !collapsed.has(candidate)) {
      nextGroup = candidate;
      break;
    }
  }
  if (nextGroup === undefined) return;
  const candidates = sections.get(nextGroup);
  const remembered = lastTabBySection.get(`${active.windowId}:${nextGroup}`);
  const target = candidates.find(tab => tab.id === remembered) || candidates[0];
  await chrome.tabs.update(target.id, { active: true });
}

// Serialize rapid keypresses so each one advances from the preceding result.
const fullscreenPreviousStates = new Map();
const browserCommandActions = {
  "toggle-group-mute": () => openChatGroup(),
  "mute-collapse-next-group": () => muteCollapseChatGroup(),
  "toggle-fullscreen": async () => {
    const window = await chrome.windows.getLastFocused();
    const state = window.state === "fullscreen"
      ? fullscreenPreviousStates.get(window.id) || "normal" : "fullscreen";
    if (state === "fullscreen") fullscreenPreviousStates.set(window.id, window.state);
    await chrome.windows.update(window.id, { state });
  },
  "separate-split-view": () => separateSplitView(),
  "move-tab-next": () => moveCurrentTab(1),
  "move-tab-previous": () => moveCurrentTab(-1),
  "close-current-tab": async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) await chrome.tabs.remove(tab.id);
  },
  "open-history": () => chrome.tabs.create({ url: "chrome://history/" }),
  "open-downloads": () => chrome.tabs.create({ url: "chrome://downloads/" }),
  "open-private-window": () => chrome.windows.create({ incognito: true })
};

async function moveCurrentTab(direction) {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!active) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  const neighbour = tabs.find(tab => tab.index === active.index + direction);
  if (!neighbour || neighbour.pinned !== active.pinned) return;
  await chrome.tabs.move(active.id, { index: neighbour.index });
}

let pending = Promise.resolve();
let lastCommand = null;
function enqueueCycle(direction, sourceTabId) {
  pending = pending.then(() => cycleTabInGroup(direction, sourceTabId)).catch(console.error);
  return pending;
}
async function captureRegisteredShortcut(command) {
  const { shortcutCapture } = await chrome.storage.session.get("shortcutCapture");
  if (!shortcutCapture) return false;
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.id !== shortcutCapture.tabId) return false;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"],
    documentUrls: [chrome.runtime.getURL("options.html")] });
  if (!contexts.some(context => context.tabId === active.id)) {
    await chrome.storage.session.remove("shortcutCapture");
    return false;
  }
  const binding = (await chrome.commands.getAll()).find(item => item.name === command);
  await chrome.runtime.sendMessage({ type: "shortcut-capture-conflict", tabId: active.id,
    shortcut: binding?.shortcut || "This shortcut", action: binding?.description || command }).catch(() => {});
  return true;
}
let commandCaptureQueue = Promise.resolve();
chrome.commands.onCommand.addListener(command => {
  commandCaptureQueue = commandCaptureQueue.then(async () => {
    if (!await captureRegisteredShortcut(command)) dispatchRegisteredCommand(command);
  }).catch(console.error);
});
function dispatchRegisteredCommand(command) {
  lastCommand = command;
  if (Object.hasOwn(browserCommandActions, command)) {
    pending = pending.then(browserCommandActions[command]).catch(console.error);
    return;
  }
  if (command === "unload-collapse-next-group") {
    pending = pending.then(() => unloadCollapseAndAdvance()).catch(console.error);
    return;
  }
  if (command === "unload-current-tab") {
    pending = pending.then(() => unloadCurrentTab()).catch(console.error);
    return;
  }
  if (command === "expand-all-groups") {
    pending = pending.then(() => expandAllGroups()).catch(console.error);
    return;
  }
  if (command === "toggle-group-collapse") {
    pending = pending.then(() => toggleGroupCollapsed()).catch(console.error);
    return;
  }
  if (command === "previous-tab-section" || command === "next-tab-section") {
    pending = pending.then(() => cycleTabSection(command === "next-tab-section" ? 1 : -1)).catch(console.error);
    return;
  }
  if (command === "create-group-tab" || command === "create-ungrouped-tab") {
    pending = pending.then(() => createTabInGroup(command === "create-group-tab")).catch(console.error);
    return;
  }
  const direction = command === "cycle-group-next" ? 1
    : command === "cycle-group-previous" ? -1 : 0;
  if (!direction) return;
  enqueueCycle(direction);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "separate-split-view" && sender.tab) {
    pending = pending.then(() => separateSplitView(sender.tab.id));
    pending.then(() => sendResponse({ ok: true }), error => sendResponse({ error: error.message }));
    pending = pending.catch(console.error);
    return true;
  }
  if (message?.type === "set-shortcut-capture" && sender.url === chrome.runtime.getURL("options.html")
      && Number.isInteger(message.tabId)) {
    (async () => {
      const contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"],
        documentUrls: [chrome.runtime.getURL("options.html")] });
      const tab = contexts.find(context => context.tabId === message.tabId);
      if (!tab) throw new Error("Invalid settings tab");
      const { shortcutCapture } = await chrome.storage.session.get("shortcutCapture");
      if (message.active) await chrome.storage.session.set({ shortcutCapture: { tabId: tab.tabId } });
      else if (shortcutCapture?.tabId === tab.tabId) await chrome.storage.session.remove("shortcutCapture");
      sendResponse({ ok: true });
    })().catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === "group-cycle-diagnostics" && !sender.tab?.url?.startsWith("http")) {
    sendResponse({ workerVersion: chrome.runtime.getManifest().version, lastCommand });
    return;
  }
  if (message?.type === "mute-collapse-next-group" && sender.tab) {
    pending = pending.then(() => muteCollapseChatGroup()).catch(console.error);
    pending.then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "expand-all-groups" && sender.tab) {
    pending = pending.then(() => expandAllGroups(sender.tab.id)).catch(console.error);
    pending.then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "toggle-group-collapse" && sender.tab) {
    pending = pending.then(() => toggleGroupCollapsed(sender.tab.id)).catch(console.error);
    pending.then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "toggle-group-mute" && sender.tab) {
    pending = pending.then(() => openChatGroup()).catch(console.error);
    pending.then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "create-group-tab" && sender.tab && typeof message.inCurrentGroup === "boolean") {
    pending = pending.then(() => createTabInGroup(message.inCurrentGroup, sender.tab.id)).catch(console.error);
    pending.then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "cycle-tab-section" && sender.tab
      && (message.direction === 1 || message.direction === -1)) {
    pending = pending.then(() => cycleTabSection(message.direction, sender.tab.id)).catch(console.error);
    pending.then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type !== "cycle-tab-in-group" || !sender.tab
      || (message.direction !== 1 && message.direction !== -1)) return;
  enqueueCycle(message.direction, sender.tab.id).then(() => sendResponse({ ok: true }));
  return true;
});

// Coalesce event bursts from muting several tabs and serialize with shortcuts.
let indicatorSyncScheduled = false;
function scheduleMuteIndicatorSync() {
  if (indicatorSyncScheduled) return;
  indicatorSyncScheduled = true;
  pending = pending.then(async () => {
    indicatorSyncScheduled = false;
    await syncAllGroupMuteIndicators();
  }).catch(console.error);
}
chrome.tabs.onUpdated.addListener((_tabId, changes) => {
  if ("mutedInfo" in changes || "groupId" in changes) scheduleMuteIndicatorSync();
});
chrome.tabs.onCreated.addListener(scheduleMuteIndicatorSync);
chrome.tabs.onRemoved.addListener(scheduleMuteIndicatorSync);
chrome.tabs.onAttached.addListener(scheduleMuteIndicatorSync);
chrome.tabs.onDetached.addListener(scheduleMuteIndicatorSync);
chrome.tabGroups.onCreated.addListener(scheduleMuteIndicatorSync);
chrome.tabGroups.onUpdated.addListener(scheduleMuteIndicatorSync);
chrome.tabGroups.onRemoved.addListener(scheduleMuteIndicatorSync);
scheduleMuteIndicatorSync();

// The toolbar button opens the extension's shortcut settings.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
