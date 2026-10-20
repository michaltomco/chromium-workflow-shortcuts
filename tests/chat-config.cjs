const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({ URL });
vm.runInContext(fs.readFileSync('chat-config.js', 'utf8'), context);
const config = context.WorkflowChat;
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(config.normalize('  https://EXAMPLE.com/messages\r\n\nhttp://localhost:3000/chat  ')),
  ['https://example.com/messages', 'http://localhost:3000/chat']);
for (const input of ['', 'not a URL', 'javascript:alert(1)', 'file:///tmp/page', 'https://name:password@example.com']) {
  assert.throws(() => config.normalize(input));
}
assert.throws(() => config.normalize('https://www.example.com/\nhttps://example.com/chat'), /one URL per website/);
assert.deepEqual(plain(config.resolve(undefined)), plain(config.defaults));
assert.deepEqual(plain(config.resolve(['invalid'])), plain(config.defaults));
assert.deepEqual(plain(config.patterns(['https://www.example.com/path', 'http://localhost:3000/chat', 'http://127.0.0.1:8080/'])),
  ['https://*.example.com/*', 'http://localhost/*', 'http://127.0.0.1/*']);
const urls = ['https://example.com/chat', 'https://team.example.com/messages', 'http://localhost:3000/chat'];
assert.equal(config.identify({ url: 'https://www.example.com/other' }, urls), 0);
assert.equal(config.identify({ url: 'https://team.example.com/inbox' }, urls), 1, 'Prefer an explicitly configured subdomain');
assert.equal(config.identify({ url: 'http://localhost:3000/channel' }, urls), 2);
assert.equal(config.identify({ url: 'http://localhost:3001/channel' }, urls), -1);
assert.equal(config.identify({ url: 'https://example.com.evil.test/' }, urls), -1);
console.log('PASS: URL validation, defaults, site matching, subdomains, local ports and scoped permissions');
