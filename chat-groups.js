const CHAT_SERVICES = [
  { host: 'messenger.com', url: 'https://www.messenger.com/' },
  { host: 'web.whatsapp.com', url: 'https://web.whatsapp.com/' },
  { host: 'discord.com', url: 'https://discord.com/channels/@me' },
];
const CHAT_URL_PATTERNS = CHAT_SERVICES.map(service => `https://*.${service.host}/*`);
const CHAT_GROUP_KEY = 'chatTabGroup';
function chatService(tab) {
  try {
    const url = new URL(tab.pendingUrl || tab.url);
    if (url.protocol !== 'https:') return -1;
    return CHAT_SERVICES.findIndex(service => url.hostname === service.host || url.hostname.endsWith('.' + service.host));
  } catch { return -1; }
}
async function findChatGroup(preferredWindowId) {
  const [groups, tabs, saved] = await Promise.all([
    chrome.tabGroups.query({}), chrome.tabs.query({ url: CHAT_URL_PATTERNS }), chrome.storage.local.get(CHAT_GROUP_KEY),
  ]);
  const services = new Map();
  for (const tab of tabs) {
    const service = chatService(tab);
    if (tab.groupId < 0 || service < 0) continue;
    if (!services.has(tab.groupId)) services.set(tab.groupId, new Set());
    services.get(tab.groupId).add(service);
  }
  const namedChat = group => /^(chat|chats)$/i.test((group.title || '').replace(/^🔇\s*/, ''));
  const remembered = groups.find(group => group.id === saved[CHAT_GROUP_KEY]?.id
    && group.windowId === saved[CHAT_GROUP_KEY]?.windowId
    && (namedChat(group) || services.has(group.id)));
  const candidates = groups.filter(group => namedChat(group) || services.get(group.id)?.size === CHAT_SERVICES.length)
    .sort((a, b) => Number(b.windowId === preferredWindowId) - Number(a.windowId === preferredWindowId));
  return { group: remembered || candidates[0], tabs };
}
async function openChatGroup() {
  const window = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  let { group, tabs } = await findChatGroup(window.id);
  const isNew = !group;
  const windowId = group?.windowId ?? window.id;
  const groupTabs = group ? await chrome.tabs.query({ windowId, groupId: group.id }) : [];
  const present = new Set(groupTabs.map(chatService).filter(index => index >= 0));
  const added = [];
  for (let service = 0; service < CHAT_SERVICES.length; service++) {
    if (present.has(service)) continue;
    // Reuse a real tab, including its navigation and login state. Leave pinned
    // tabs alone, since grouping them would require unpinning them.
    let tab = tabs.filter(tab => !tab.pinned && chatService(tab) === service)
      .sort((a, b) => Number(b.windowId === windowId) - Number(a.windowId === windowId)
        || Number(a.groupId >= 0) - Number(b.groupId >= 0) || a.index - b.index)[0];
    if (!tab) tab = await chrome.tabs.create({ windowId, url: CHAT_SERVICES[service].url, active: false });
    const groupId = await chrome.tabs.group(group
      ? { tabIds: tab.id, groupId: group.id }
      : { tabIds: tab.id, createProperties: { windowId } });
    if (!group) group = await chrome.tabGroups.update(groupId, { title: 'Chat', color: 'blue' });
    await chrome.storage.local.set({ [CHAT_GROUP_KEY]: { id: group.id, windowId } });
    added.push(tab.id);
  }
  // New groups use Messenger, WhatsApp, Discord order. Existing groups keep
  // their user's order and any extra tabs.
  let current = (await chrome.tabs.query({ windowId, groupId: group.id })).sort((a, b) => a.index - b.index);
  if (isNew) {
    const start = current[0].index;
    for (let i = 0; i < added.length; i++) await chrome.tabs.move(added[i], { index: start + i });
    current = (await chrome.tabs.query({ windowId, groupId: group.id })).sort((a, b) => a.index - b.index);
  }
  await chrome.storage.local.set({ [CHAT_GROUP_KEY]: { id: group.id, windowId } });
  await Promise.all(current.map(tab => chrome.tabs.update(tab.id, { muted: false })));
  await syncGroupMuteIndicator(group.id);
  await chrome.tabGroups.update(group.id, { collapsed: false });
  await chrome.tabs.update(current[0].id, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}
async function muteCollapseChatGroup() {
  const window = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  const { group } = await findChatGroup(window.id);
  if (!group) return;
  const tabs = await chrome.tabs.query({ windowId: group.windowId, groupId: group.id });
  await Promise.all(tabs.map(tab => chrome.tabs.update(tab.id, { muted: true })));
  await syncGroupMuteIndicator(group.id);
  const [active] = await chrome.tabs.query({ active: true, windowId: group.windowId });
  if (active?.groupId === group.id) {
    await cycleTabSection(1, active.id);
    const [destination] = await chrome.tabs.query({ active: true, windowId: group.windowId });
    if (!destination || destination.groupId === group.id) {
      await chrome.tabs.create({ windowId: group.windowId, url: 'about:blank', active: true });
    }
  }
  await chrome.tabGroups.update(group.id, { collapsed: true });
  lastCollapsedGroupByWindow.set(group.windowId, { groupId: group.id, tabId: tabs[0]?.id });
}
