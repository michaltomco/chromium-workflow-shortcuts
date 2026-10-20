function createPresetEditor({ onChange, onStatus }) {
  const container = document.getElementById('group-presets');
  const addButton = document.getElementById('add-group');
  const copy = value => JSON.parse(JSON.stringify(value));
  const editable = presets => presets.map(p => ({ ...p, urls: p.urls.join('\n') }));
  let draft = [], saved = [], commands = [];
  const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);
  function updateKeys() {
    for (const card of container.querySelectorAll('.preset-card')) {
      const names = WorkflowGroups.commands(Number(card.dataset.slot));
      for (const action of ['toggle', 'quiet']) {
        const key = commands.find(command => command.name === names[action])?.shortcut || '';
        const label = card.querySelector(`[data-key="${action}"]`);
        label.textContent = key || 'Not assigned'; label.classList.toggle('unassigned', !key);
      }
    }
  }
  function render() {
    container.replaceChildren(); addButton.disabled = draft.length >= WorkflowGroups.limit;
    if (!draft.length) {
      const empty = document.createElement('p'); empty.className = 'footnote';
      empty.textContent = 'No group presets. Add a group to get started.'; container.append(empty);
    }
    for (const preset of draft) {
      const card = document.createElement('div'); card.className = 'preset-card'; card.dataset.slot = preset.slot; card.dataset.presetId = preset.id; card.setAttribute('role', 'group'); card.setAttribute('aria-label', `Group ${preset.slot} preset`);
      card.innerHTML = '<div class="preset-heading"><strong class="preset-slot"></strong><button class="quiet preset-remove" type="button">Remove</button></div><div class="preset-fields"><label>Name<input class="preset-name" type="text" autocomplete="off"></label><label>Color<select class="preset-color"></select></label></div><label class="chat-label preset-url-label">URLs · one website per line</label><textarea class="preset-urls" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea><div class="preset-keys"><span>Toggle <span class="native-key" data-key="toggle"></span></span><span>Mute &amp; collapse <span class="native-key" data-key="quiet"></span></span><button class="secondary preset-shortcuts" type="button">Set shortcuts ↗</button></div><p class="footnote preset-key-help"></p>';
      card.querySelector('.preset-slot').textContent = `Group ${preset.slot}`;
      const name = card.querySelector('.preset-name'); name.value = preset.name;
      name.addEventListener('input', () => { preset.name = name.value; onChange(); });
      const color = card.querySelector('.preset-color');
      for (const value of WorkflowGroups.colors) {
        const option = document.createElement('option'); option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1); color.append(option);
      }
      color.value = preset.color;
      color.addEventListener('change', () => { preset.color = color.value; onChange(); });
      const urls = card.querySelector('.preset-urls');
      urls.id = preset.id === 'chat' ? 'chat-urls' : `preset-urls-${preset.id}`;
      card.querySelector('.preset-url-label').htmlFor = urls.id; urls.value = preset.urls;
      urls.addEventListener('input', () => { preset.urls = urls.value; onChange(); });
      card.querySelector('.preset-key-help').textContent = `In Chromium's shortcut editor, use “Group ${preset.slot}: toggle” and “Group ${preset.slot}: mute and collapse”.`;
      card.querySelector('.preset-shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
      card.querySelector('.preset-remove').addEventListener('click', () => {
        draft = draft.filter(p => p.id !== preset.id); render(); onChange();
        onStatus('Preset removed. Save to apply. Its browser tabs stay open.');
      });
      if (preset.id === 'chat') {
        const reset = document.createElement('button'); reset.id = 'reset-chat'; reset.type = 'button'; reset.className = 'quiet'; reset.textContent = 'Default chat sites';
        reset.addEventListener('click', () => { preset.urls = WorkflowChat.defaults.join('\n'); urls.value = preset.urls; onChange(); onStatus('Default chat sites restored. Save to apply.'); });
        card.append(reset);
      }
      container.append(card);
    }
    updateKeys();
  }
  addButton.addEventListener('click', () => {
    if (draft.length >= WorkflowGroups.limit) return;
    const slot = Array.from({ length: WorkflowGroups.limit }, (_, index) => index + 1).find(slot => !draft.some(p => p.slot === slot));
    let name = `Group ${slot}`, suffix = 2;
    while (draft.some(p => p.name.trim().toLowerCase() === name.toLowerCase())) name = `Group ${slot} (${suffix++})`;
    const preset = { id: crypto.randomUUID(), slot, name, color: WorkflowGroups.colors[(slot - 1) % WorkflowGroups.colors.length], urls: '' };
    draft.push(preset); render(); onChange();
    container.lastElementChild.querySelector('.preset-name').focus();
    onStatus('Add URLs and save. Use Set shortcuts to assign this group’s browser-wide keys.');
  });
  return {
    load(presets) { saved = editable(presets); draft = copy(saved); render(); },
    reset() { draft = editable(WorkflowGroups.defaults()); render(); onChange(); },
    normalize: () => WorkflowGroups.normalize(draft), dirty,
    snapshot: () => JSON.stringify(draft),
    markSaved(presets, snapshot) {
      saved = editable(presets);
      if (JSON.stringify(draft) === snapshot) { draft = copy(saved); render(); }
    },
    updateCommands(value) { commands = value; updateKeys(); },
  };
}
