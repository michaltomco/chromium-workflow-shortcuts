const config = WorkflowShortcuts;
let saved = config.defaults(), draft = config.defaults(), nativeCommands = [], recording = null;
let settingsTabId, saving = false;
const groupEditor = createPresetEditor({ onChange: dirty, onStatus: status });
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function dirty() {
  const changed = JSON.stringify(saved) !== JSON.stringify(draft)
    || groupEditor.dirty();
  $('save').disabled = saving || !changed;
  $('save-state').textContent = changed ? 'Unsaved changes' : 'All changes saved';
}
function finishRecording() {
  recording = null; renderEditable();
  if (settingsTabId !== undefined) chrome.runtime.sendMessage({ type: 'set-shortcut-capture', tabId: settingsTabId, active: false }).catch(() => {});
}
function renderEditable() {
  for (const [group, actions] of [['page', config.pageActions], ['desktop', config.desktopActions]]) {
    const container = $(group === 'page' ? 'page-actions' : 'desktop-actions');
    container.replaceChildren();
    for (const action of actions) {
      const row = document.createElement('div'); row.className = 'action'; row.dataset.search = `${action.label} ${action.hint || ''} ${draft[group][action.id]}`.toLowerCase();
      const text = document.createElement('div');
      const label = document.createElement('div'); label.className = 'action-label'; label.textContent = action.label; text.append(label);
      if (action.hint) { const hint = document.createElement('p'); hint.className = 'action-hint'; hint.textContent = action.hint; text.append(hint); }
      const controls = document.createElement('div'); controls.className = 'key-controls';
      const button = document.createElement('button'); button.className = 'shortcut'; button.type = 'button';
      const isRecording = recording?.group === group && recording?.id === action.id;
      button.textContent = isRecording ? 'Press keys…' : draft[group][action.id] || 'Not assigned';
      button.classList.toggle('recording', isRecording); button.classList.toggle('unassigned', !draft[group][action.id]);
      button.setAttribute('aria-label', `Change ${action.label} shortcut`);
      button.setAttribute('aria-pressed', String(isRecording));
      button.addEventListener('click', async () => {
        if (isRecording) { finishRecording(); status('Recording cancelled.'); return; }
        try {
          const response = await chrome.runtime.sendMessage({ type: 'set-shortcut-capture', tabId: settingsTabId, active: true });
          if (response?.error) throw new Error(response.error);
          recording = { group, id: action.id, plain: action.plain }; renderEditable();
          status('Press your shortcut. Escape cancels; Backspace clears.');
        } catch (error) { status(`Could not record shortcut: ${error.message}`, true); }
      });
      const clear = document.createElement('button'); clear.className = 'clear'; clear.textContent = '×'; clear.title = `Clear ${action.label} shortcut`; clear.setAttribute('aria-label', clear.title);
      clear.addEventListener('click', () => { draft[group][action.id] = ''; finishRecording(); dirty(); status('Shortcut cleared. Save to apply.'); });
      controls.append(button, clear); row.append(text, controls); container.append(row);
    }
  }
  filterRows();
}
function filterRows() {
  const query = $('search').value.toLowerCase().trim();
  document.querySelectorAll('.action').forEach(row => { row.hidden = !row.dataset.search.includes(query); });
  if (query && [...$('desktop-actions').children].some(row => !row.hidden)) $('desktop-section').open = true;
}
async function refreshNative() {
  nativeCommands = (await chrome.commands.getAll()).filter(c => !c.name.startsWith('_'));
  const container = $('browser-actions'); container.replaceChildren();
  groupEditor.updateCommands(nativeCommands);
  for (const command of nativeCommands.filter(command => !WorkflowGroups.commandAction(command.name))) {
    const row = document.createElement('div'); row.className = 'action'; row.dataset.search = `${command.description} ${command.shortcut}`.toLowerCase();
    const label = document.createElement('span'); label.className = 'action-label'; label.textContent = command.description || command.name;
    const key = document.createElement('span'); key.className = 'native-key'; key.classList.toggle('unassigned', !command.shortcut); key.textContent = command.shortcut || 'Not assigned';
    row.append(label, key); container.append(row);
  }
  filterRows();
  try { config.validate(draft, nativeCommands); }
  catch (error) { status(error.message, true); }
}
document.addEventListener('keydown', event => {
  if (!recording) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.repeat) return;
  if (event.key === 'Escape') { finishRecording(); status('Recording cancelled.'); return; }
  if (event.key === 'Backspace') { draft[recording.group][recording.id] = ''; finishRecording(); dirty(); return; }
  try {
    const key = config.fromEvent(event); if (!key) return;
    const next = clone(draft); next[recording.group][recording.id] = key;
    config.validate(next, nativeCommands.filter(command => command.shortcut && config.normalize(command.shortcut) === key));
    draft = next; finishRecording(); dirty(); status('Shortcut recorded. Save to apply.');
  } catch (error) { status(error.message, true); }
}, true);
$('search').addEventListener('input', filterRows);
$('browser-editor').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
$('reset').addEventListener('click', () => { draft = config.defaults(); groupEditor.reset(); finishRecording(); dirty(); status('Shortcut and group defaults restored. Save to apply. Chromium assignments are unchanged.'); });
$('save').addEventListener('click', async () => {
  if (saving) return;
  try {
    const next = clone(draft), snapshot = groupEditor.snapshot();
    const presets = groupEditor.normalize();
    config.validate(next, nativeCommands);
    saving = true; dirty(); status('Saving…');
    await refreshNative(); config.validate(next, nativeCommands);
    const update = { shortcutSettings: next, [WorkflowGroups.key]: presets };
    const chat = presets.find(preset => preset.id === 'chat');
    if (chat) update[WorkflowChat.key] = chat.urls;
    await chrome.storage.local.set(update);
    saved = next; groupEditor.markSaved(presets, snapshot);
    status('Saved. Group changes apply when you open them. Export the config if you changed Hyprland keys.');
  } catch (error) { status(error.message, true); }
  finally { saving = false; dirty(); }
});
$('export-hyprland').addEventListener('click', () => {
  try {
    if (JSON.stringify(saved) !== JSON.stringify(draft)) throw new Error('Save your changes before downloading the Hyprland configuration.');
    config.validate(draft, nativeCommands);
    const url = URL.createObjectURL(new Blob([config.toHyprland(draft)], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'workflow-shortcuts.lua'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Downloaded. Paste above your integration dofile(…) line, then run hyprctl reload.');
  } catch (error) { status(error.message, true); }
});
window.addEventListener('focus', () => refreshNative().catch(error => status(error.message, true)));
window.addEventListener('blur', () => { if (recording) { finishRecording(); status('Recording cancelled.'); } });
chrome.runtime.onMessage.addListener(message => {
  if (recording && message?.type === 'shortcut-capture-conflict' && message.tabId === settingsTabId) {
    status(`${message.shortcut} is assigned to “${message.action}” in Chromium. Change that assignment first.`, true);
  }
});
(async () => {
  try {
    settingsTabId = (await chrome.tabs.getCurrent()).id;
    await chrome.runtime.sendMessage({ type: 'set-shortcut-capture', tabId: settingsTabId, active: false });
    const data = await chrome.storage.local.get(['shortcutSettings', WorkflowChat.key, WorkflowGroups.key]); saved = config.resolve(data.shortcutSettings); draft = clone(saved);
    groupEditor.load(WorkflowGroups.resolve(data[WorkflowGroups.key], data[WorkflowChat.key]));
    renderEditable(); await refreshNative(); dirty();
  } catch (error) { status(`Could not load settings: ${error.message}`, true); }
})();
