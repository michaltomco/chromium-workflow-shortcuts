// Shared preset engine. The legacy Chat entry points keep existing hotkeys intact.
function chatService(tab, urls = WorkflowChat.defaults) { return WorkflowChat.identify(tab, urls); }
const groupTitle = title => (title || '').replace(/^🔇\s*/, '').trim().toLowerCase();
async function groupContext(slot) {
  const saved = await chrome.storage.local.get([WorkflowGroups.key, WorkflowGroups.stateKey, WorkflowChat.key, 'chatTabGroup', 'reuseExistingTabs']);
  const presets = WorkflowGroups.resolve(saved[WorkflowGroups.key], saved[WorkflowChat.key]);
  const preset = presets.find(p => p.slot === slot);
  if (!preset) return null;
  const refs = { ...(saved[WorkflowGroups.stateKey] || {}) };
  if (!refs.chat && saved.chatTabGroup) refs.chat = { ...saved.chatTabGroup, name: 'Chat' };
  const previous = refs[preset.id];
  const reuse = saved.reuseExistingTabs === true && await chrome.permissions.contains({ permissions: ['tabs'] });
  const previousUrls = previous?.urls || preset.urls;
  const patterns = [...new Set(WorkflowChat.patterns([...preset.urls, ...previousUrls,
    ...presets.flatMap(p => p.urls), ...presets.flatMap(p => refs[p.id]?.urls || [])]))];
  const [window, groups, tabs, allTabs] = await Promise.all([
    chrome.windows.getLastFocused({ windowTypes: ['normal'] }), chrome.tabGroups.query({}),
    reuse ? chrome.tabs.query({ url: patterns }) : Promise.resolve([]), chrome.tabs.query({}),
  ]);
  const byReference = (group, ref) => ref && group.id === ref.id && group.windowId === ref.windowId;
  const remembered = groups.find(group => byReference(group, previous)
    && (groupTitle(group.title) === groupTitle(preset.name) || groupTitle(group.title) === groupTitle(previous.name)
      || tabs.some(tab => tab.groupId === group.id && chatService(tab, previousUrls) >= 0)));
  const others = presets.filter(p => p.id !== preset.id);
  const reserved = new Set(groups.filter(group => others.some(p => byReference(group, refs[p.id]))).map(group => group.id));
  for (const group of groups) {
    if (group.id !== remembered?.id && others.some(p => groupTitle(group.title) === groupTitle(p.name)
      || (refs[p.id]?.name && groupTitle(group.title) === groupTitle(refs[p.id].name)))) reserved.add(group.id);
  }
  const sharesSite = others.some(p => p.urls.some(url => chatService({ url }, preset.urls) >= 0)
    || preset.urls.some(url => chatService({ url }, p.urls) >= 0));
  const named = group => groupTitle(group.title) === groupTitle(preset.name)
    || (preset.id === 'chat' && groupTitle(preset.name) === 'chat' && groupTitle(group.title) === 'chats');
  const complete = group => {
    if (sharesSite) return false;
    const members = allTabs.filter(tab => tab.groupId === group.id);
    const matches = tabs.filter(tab => tab.groupId === group.id && chatService(tab, preset.urls) >= 0);
    return members.length > 0 && members.length === matches.length
      && new Set(matches.map(tab => chatService(tab, preset.urls))).size === preset.urls.length;
  };
  const candidates = groups.filter(group => !reserved.has(group.id) && ((reuse || previous) && named(group) || reuse && complete(group)))
    .sort((a, b) => Number(b.windowId === window.id) - Number(a.windowId === window.id));
  const group = remembered && !reserved.has(remembered.id) ? remembered : candidates[0];
  const members = group ? allTabs.filter(tab => tab.groupId === group.id).sort((a,b)=>a.index-b.index) : [];
  // Remember URLs supplied by the user, not URLs read from pages. IDs preserve
  // mappings across reordering; old installs/restored sessions migrate by order.
  const knownTabs = new Map();
  const records = previous?.tabs;
  const restored = records?.length && !records.some(record => members.some(tab => tab.id === record.id));
  members.forEach((tab,index) => {
    const record = records?.find(record => record.id === tab.id);
    const url = reuse
      ? preset.urls[chatService(tab, preset.urls)] || record?.url
      : record?.url || (!records || restored ? (records?.[index]?.url || previousUrls[index]) : undefined);
    if (url) knownTabs.set(tab.id, url);
  });
  return { preset, presets, refs, group, tabs, window, reserved, reuse, knownTabs };
}
async function rememberPreset(context, group) {
  const { preset, presets, refs } = context;
  const state = Object.fromEntries(Object.entries(refs).filter(([id]) => presets.some(p => p.id === id)));
  const ref = { id: group.id, windowId: group.windowId, name: preset.name, urls: preset.urls,
    tabs: [...context.knownTabs].map(([id,url])=>({id,url})) };
  state[preset.id] = ref;
  const update = { [WorkflowGroups.stateKey]: state };
  if (preset.id === 'chat') update.chatTabGroup = ref;
  await chrome.storage.local.set(update);
}
async function runGroupPreset(slot) {
  const context = await groupContext(slot);
  if (!context) return;
  if (context.group && !context.group.collapsed) {
    return quietPreset(context);
  }
  return openPreset(context);
}
async function openPreset(context) {
  const { preset, tabs, reserved, reuse, knownTabs } = context;
  let { group } = context;
  const isNew = !group, windowId = group?.windowId ?? context.window.id;
  const groupTabs = group ? await chrome.tabs.query({ windowId, groupId: group.id }) : [];
  const present = new Set(groupTabs.map(tab => chatService(reuse ? tab : {url:knownTabs.get(tab.id)}, preset.urls)).filter(index => index >= 0));
  const added = [];
  for (let site = 0; site < preset.urls.length; site++) {
    if (present.has(site)) continue;
    // Do not take tabs belonging to another preset or unpin a user's tab.
    let tab = tabs.filter(tab => !tab.pinned && !reserved.has(tab.groupId) && chatService(tab, preset.urls) === site)
      .sort((a, b) => Number(b.windowId === windowId) - Number(a.windowId === windowId)
        || Number(a.groupId >= 0) - Number(b.groupId >= 0) || a.index - b.index)[0];
    if (!tab) tab = await chrome.tabs.create({ windowId, url: preset.urls[site], active: false });
    knownTabs.set(tab.id, preset.urls[site]);
    const id = await chrome.tabs.group(group ? { tabIds: tab.id, groupId: group.id }
      : { tabIds: tab.id, createProperties: { windowId } });
    if (!group) group = await chrome.tabGroups.update(id, { title: preset.name, color: preset.color });
    await rememberPreset(context, group);
    added.push(tab.id);
  }
  let current = (await chrome.tabs.query({ windowId, groupId: group.id })).sort((a, b) => a.index - b.index);
  if (isNew) {
    const start = current[0].index;
    for (let i = 0; i < added.length; i++) await chrome.tabs.move(added[i], { index: start + i });
    current = (await chrome.tabs.query({ windowId, groupId: group.id })).sort((a, b) => a.index - b.index);
  }
  await rememberPreset(context, group);
  await Promise.all(current.map(tab => chrome.tabs.update(tab.id, { muted: false })));
  await syncGroupMuteIndicator(group.id);
  await chrome.tabGroups.update(group.id, { title: preset.name, color: preset.color, collapsed: false });
  await chrome.tabs.update(current[0].id, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}
async function quietPreset(context) {
  const { group, preset } = context;
  if (!group) return;
  await rememberPreset(context, group);
  if (groupTitle(group.title) !== groupTitle(preset.name)) await chrome.tabGroups.update(group.id, { title: preset.name });
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
function toggleChatGroup() { return runGroupPreset(1); }
