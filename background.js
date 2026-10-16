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
  lastTabBySection.set(`${active.windowId}:${active.groupId}`, active.id);
  const index = groups.indexOf(active.groupId);
  const nextGroup = groups[(index + direction + groups.length) % groups.length];
  const candidates = sections.get(nextGroup);
  const remembered = lastTabBySection.get(`${active.windowId}:${nextGroup}`);
  const target = candidates.find(tab => tab.id === remembered) || candidates[0];
  await chrome.tabs.update(target.id, { active: true });
}

// Serialize rapid keypresses so each one advances from the preceding result.
let pending = Promise.resolve();
let lastCommand = null;
function enqueueCycle(direction, sourceTabId) {
  pending = pending.then(() => cycleTabInGroup(direction, sourceTabId)).catch(console.error);
  return pending;
}
chrome.commands.onCommand.addListener(command => {
  lastCommand = command;
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
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "group-cycle-diagnostics" && !sender.tab?.url?.startsWith("http")) {
    sendResponse({ workerVersion: "1.4.0", lastCommand });
    return;
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
