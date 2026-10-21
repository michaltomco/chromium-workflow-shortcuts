const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({ URL });
for (const file of ['chat-config.js', 'group-config.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const config = context.WorkflowGroups;
const plain = value => JSON.parse(JSON.stringify(value));
const migrated = config.resolve(undefined, ['https://example.org/inbox']);
assert.equal(migrated[0].id, 'chat'); assert.equal(migrated[0].slot, 1);
assert.deepEqual(plain(migrated[0].urls), ['https://example.org/inbox']);
assert.deepEqual(plain(config.resolve([])), [], 'Removing every preset must not recreate Chat');
assert.deepEqual(plain(config.commands(1)), { toggle: 'toggle-group-mute' });
assert.deepEqual(plain(config.commandAction('toggle-preset-3')), { slot: 3, action: 'toggle' });
for (const name of ['mute-collapse-next-group', ...Array.from({length:9}, (_,i)=>`mute-preset-${i+2}`)]) {
  assert.equal(config.commandAction(name), null);
  assert.equal(JSON.parse(fs.readFileSync('manifest.json')).commands[name], undefined);
}
assert.equal(config.commandAction('toggle-preset-11'), null);
assert.equal(config.commandAction('toggle-fullscreen'), null);
const first = { id: 'one', slot: 1, name: ' Work ', color: 'green', urls: 'https://example.org/' };
const second = { id: 'two', slot: 2, name: 'Study', color: 'purple', urls: ['https://example.com/'] };
assert.equal(config.normalize([first])[0].name, 'Work');
assert.throws(() => config.normalize([first, { ...second, name: 'work' }]), /different name/);
assert.throws(() => config.normalize([first, { ...second, slot: 1 }]), /own shortcut slot/);
assert.throws(() => config.normalize([{ ...first, urls: '' }]), /Work: Add at least/);
assert.throws(() => config.normalize([{ ...first, color: 'black' }]), /color/);
assert.throws(() => config.normalize([{ ...first, name: '' }]), /name/);
assert.equal(config.normalize([first, { ...second, urls: first.urls }]).length, 2, 'Different presets may share a site');
console.log('PASS: migration, stable shortcut slots, independent URLs, validation and empty preset list');
