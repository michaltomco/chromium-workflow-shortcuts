const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c=vm.createContext({URL});vm.runInContext(fs.readFileSync('split-picker-model.js','utf8'),c);const p=c.SplitPicker;
assert.equal(p.destination('example.com/path').url,'https://example.com/path');
assert.equal(p.destination('localhost:8080/a').url,'http://localhost:8080/a');
assert.equal(p.destination('search words').search,'search words');
assert.equal(p.destination('javascript:alert(1)').url,undefined);
assert.equal(p.destination(''),null);
const current={id:2,windowId:1,splitViewId:8};
const rows=p.entries([{id:1,windowId:1,splitViewId:8,url:'https://source.test'},current,
 {id:3,windowId:1,index:2,groupId:4,title:'Design notes',url:'https://example.com/notes'},
 {id:4,windowId:2,index:0,groupId:-1,title:'Other',url:'https://other.test'},
 {id:5,windowId:1,index:3,groupId:-1}], [{id:4,title:'Research',color:'green'}],
 [{id:'chat',name:'Chat',color:'blue',urls:['https://discord.com/']}],current);
assert.equal(rows.length,3);assert.equal(rows[0].title,'Design notes');
assert.equal(p.matches(rows,'research notes').length,1);assert.equal(p.matches(rows,'chat')[0].kind,'presets');
assert.equal(p.matches(rows,'','tabs').length,2);assert.equal(p.matches(rows,'','presets').length,1);
assert.equal(p.entries([],[],[{id:'chat',name:'Chat',color:'blue',urls:['https://discord.com/']}],current).length,1);
console.log('PASS: group/title/URL filtering, presets without tab access, source-pane exclusion and safe URL/search parsing');
