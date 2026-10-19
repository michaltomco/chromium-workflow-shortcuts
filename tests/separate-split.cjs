const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('background.js', 'utf8').split('const lastCollapsedGroupByWindow')[0];
async function check({ groupId = -1, pinned = false, activeIndex = 0, split = true, fail = false } = {}) {
  let tabs = [0, 1].map(index => ({ id: index + 1, index, active: index === activeIndex,
    windowId: 3, groupId, pinned, splitViewId: split ? 7 : -1 }));
  const original = JSON.parse(JSON.stringify(tabs));
  let created = false, failed = false;
  const chrome = { tabs: {
    query: async query => tabs.filter(t => !query.active || t.active).map(t => ({ ...t })),
    get: async id => ({ ...tabs.find(t => t.id === id) }),
    create: async props => { created = true; const tab = { ...props, id: 9, groupId: -1, splitViewId: -1 };
      tabs.splice(props.index, 0, tab); return { ...tab }; },
    group: async ({ tabIds, groupId }) => { tabs.find(t => t.id === tabIds).groupId = groupId; },
    move: async (id, { index }) => {
      if (fail && !failed) { failed = true; throw Error('Move rejected'); }
      const from = tabs.findIndex(t => t.id === id), [tab] = tabs.splice(from, 1);
      tabs.splice(index, 0, tab); tabs.forEach((t, i) => { t.index = i; t.splitViewId = -1; });
    },
    remove: async id => { tabs = tabs.filter(t => t.id !== id); tabs.forEach((t, i) => { t.index = i; }); },
  } };
  const context = vm.createContext({ chrome }); vm.runInContext(source, context);
  if (fail) await assert.rejects(context.separateSplitView(), /Move rejected/);
  else await context.separateSplitView();
  assert.equal(created, split);
  assert.deepEqual(tabs.map(({ splitViewId, ...t }) => t), original.map(({ splitViewId, ...t }) => t),
    'Keep every real tab, index, group, pin and focused pane; remove the placeholder');
}
(async () => {
  for (const groupId of [-1, 5]) for (const activeIndex of [0, 1]) await check({ groupId, activeIndex });
  await check({ pinned: true }); await check({ split: false }); await check({ fail: true });
  console.log('PASS: separate either pane, grouped/pinned tabs, non-split no-op, failure cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
