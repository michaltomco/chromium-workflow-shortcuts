(() => {
  const pageActions = [
    { id: 'videoFullscreen', label: 'Video fullscreen', hint: 'Toggle fullscreen for the playing video.', default: 'Alt+P' },
    { id: 'pictureInPicture', label: 'Picture-in-Picture', hint: 'Pop a video out or return it to the page.', default: 'Alt+Shift+P' },
    { id: 'vimiumSearch', label: 'Search in a new tab', hint: 'Open Vimium C search outside text fields.', default: 'T', plain: true },
  ];
  const desktopActions = [
    { id: 'verticalSidebar', label: 'Vertical-tab sidebar', default: 'Alt+Shift+S' },
    { id: 'newGroup', label: 'Native group editor', default: 'Alt+G' },
    { id: 'back', label: 'Back', default: 'Ctrl+H' },
    { id: 'forward', label: 'Forward', default: 'Ctrl+L' },
    { id: 'savePage', label: 'Save page', default: 'Ctrl+Alt+Shift+S' },
  ];
  const specialKeys = { ' ': 'Space', space: 'Space', arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right',
    up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
    enter: 'Enter', insert: 'Insert', delete: 'Delete' };
  function normalize(value) {
    if (typeof value !== 'string') throw new Error('Choose a shortcut.');
    if (!value.trim()) return '';
    const parts = value.split('+').map(p => p.trim());
    const raw = parts.pop();
    const key = /^[a-z0-9]$/i.test(raw) ? raw.toUpperCase() : /^f([1-9]|1[0-9]|2[0-4])$/i.test(raw) ? raw.toUpperCase() : specialKeys[raw.toLowerCase()];
    if (!key) throw new Error('Use a letter, number, function key, arrow, or navigation key.');
    const mods = parts.map(p => ({ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta', command: 'Meta'})[p.toLowerCase()]);
    if (mods.some(m => !m) || new Set(mods).size !== mods.length) throw new Error('Invalid shortcut modifiers.');
    return ['Ctrl', 'Alt', 'Shift', 'Meta'].filter(m => mods.includes(m)).concat(key).join('+');
  }
  function fromEvent(event) {
    if (event.isComposing || ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'Dead'].includes(event.key)) return null;
    return normalize([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta',
      event.key === ' ' ? 'Space' : event.key].filter(Boolean).join('+'));
  }
  function defaults() {
    return { page: Object.fromEntries(pageActions.map(a => [a.id, a.default])), desktop: Object.fromEntries(desktopActions.map(a => [a.id, a.default])) };
  }
  function resolve(saved) {
    const result = defaults();
    for (const [group, actions] of [['page', pageActions], ['desktop', desktopActions]]) {
      for (const action of actions) {
        if (typeof saved?.[group]?.[action.id] === 'string') {
          try { result[group][action.id] = normalize(saved[group][action.id]); } catch {}
        }
      }
    }
    return result;
  }
  function validate(settings, commands = []) {
    const seen = new Map();
    const native = new Map(commands.filter(c => c.shortcut).map(c => [normalize(c.shortcut), c.description || c.name]));
    for (const [group, actions] of [['page', pageActions], ['desktop', desktopActions]]) {
      for (const action of actions) {
        const key = normalize(settings[group][action.id]);
        if (!key) continue;
        if (!action.plain && !/(Ctrl|Alt|Meta)\+/.test(key)) throw new Error(`${action.label}: include Ctrl, Alt, or Meta.`);
        if (seen.has(key)) throw new Error(`${key} is already assigned to ${seen.get(key)}.`);
        if (native.has(key)) throw new Error(`${key} is assigned to “${native.get(key)}” in Chromium. Change that assignment first.`);
        seen.set(key, action.label);
      }
    }
    return settings;
  }
  function toHyprland(settings) {
    const keys = { ...settings.desktop, videoFullscreen: settings.page.videoFullscreen, pictureInPicture: settings.page.pictureInPicture };
    const value = shortcut => shortcut.split('+').map(p => ({Ctrl:'CTRL',Alt:'ALT',Shift:'SHIFT',Meta:'SUPER'})[p] || p.toUpperCase()).join(' + ');
    return '-- Paste above the existing integration dofile(...) line, then reload Hyprland.\nchromium_workflow_shortcuts = {\n'
      + Object.entries(keys).map(([id, key]) => `  ${id} = ${JSON.stringify(key ? value(key) : '')},`).join('\n') + '\n}\n';
  }
  globalThis.WorkflowShortcuts = { pageActions, desktopActions, normalize, fromEvent, defaults, resolve, validate, toHyprland };
})();
