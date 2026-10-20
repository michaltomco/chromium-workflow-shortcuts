(() => {
  const key = 'groupPresets', stateKey = 'managedTabGroups', limit = 10;
  const colors = ['blue', 'green', 'purple', 'orange', 'cyan', 'pink', 'yellow', 'red', 'grey'];
  function defaults(urls = WorkflowChat.defaults) {
    return [{ id: 'chat', slot: 1, name: 'Chat', color: 'blue', urls: [...urls] }];
  }
  function normalize(value) {
    if (!Array.isArray(value) || value.length > limit) throw Error(`Use up to ${limit} group presets.`);
    const ids = new Set(), slots = new Set(), names = new Set();
    return value.map(preset => {
      if (!preset || typeof preset.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(preset.id)
          || ids.has(preset.id)) throw Error('Invalid group preset.');
      if (!Number.isInteger(preset.slot) || preset.slot < 1 || preset.slot > limit || slots.has(preset.slot)) throw Error('Each group needs its own shortcut slot.');
      const name = typeof preset.name === 'string' ? preset.name.trim() : '';
      if (!name) throw Error(`Group ${preset.slot}: enter a name.`);
      if (names.has(name.toLowerCase())) throw Error('Give each group a different name.');
      if (!colors.includes(preset.color)) throw Error(`${name}: choose a group color.`);
      let urls;
      try { urls = WorkflowChat.normalize(preset.urls); } catch (error) { throw Error(`${name}: ${error.message}`); }
      ids.add(preset.id); slots.add(preset.slot); names.add(name.toLowerCase());
      return { id: preset.id, slot: preset.slot, name, color: preset.color, urls };
    });
  }
  function resolve(saved, legacyUrls) {
    if (saved !== undefined) { try { return normalize(saved); } catch {} }
    return defaults(WorkflowChat.resolve(legacyUrls));
  }
  function commands(slot) {
    return slot === 1 ? { toggle: 'toggle-group-mute', quiet: 'mute-collapse-next-group' }
      : { toggle: `toggle-preset-${slot}`, quiet: `mute-preset-${slot}` };
  }
  function commandAction(command) {
    for (let slot = 1; slot <= limit; slot++) {
      for (const [action, name] of Object.entries(commands(slot))) if (command === name) return { slot, action };
    }
    return null;
  }
  globalThis.WorkflowGroups = { key, stateKey, limit, colors, defaults, normalize, resolve, commands, commandAction };
})();
