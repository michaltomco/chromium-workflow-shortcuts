const $ = id => document.getElementById(id);
let current, entries=[], visible=[], selected=0, filter='all', busy=false, refreshGeneration=0;
function error(error) { $('status').textContent=error.message || String(error); }
function focusQuery() { if (document.hasFocus()) $('query').focus(); }
window.addEventListener('focus',focusQuery);
function render() {
  const query=$('query').value;
  visible=SplitPicker.matches(entries,query,filter);
  const target=SplitPicker.destination(query);
  if (target) visible.push({kind:'input',...target,title:target.url?'Open '+target.url:'Search for “'+target.search+'”',section:'URL / search',sectionId:'input',color:'grey'});
  selected=Math.min(selected,Math.max(0,visible.length-1));
  $('results').replaceChildren();
  const sections=new Map();
  visible.forEach((entry,index)=>{
    let section=sections.get(entry.sectionId);
    if (!section) {
      section=document.createElement('div');section.setAttribute('role','group');section.setAttribute('aria-label',entry.section);
      const heading=document.createElement('div');heading.className='section';heading.setAttribute('role','presentation');
      const dot=document.createElement('span');dot.className='dot';dot.style.background=SplitPicker.colors[entry.color];
      heading.append(dot,document.createTextNode(entry.section));section.append(heading);$('results').append(section);sections.set(entry.sectionId,section);
    }
    const row=document.createElement('div');row.className='result';row.id='result-'+index;row.setAttribute('role','option');row.setAttribute('aria-selected',String(index===selected));
    const dot=document.createElement('span');dot.className='dot';dot.style.background=SplitPicker.colors[entry.color];
    const details=document.createElement('div');details.className='details';const name=document.createElement('div');name.className='name';name.textContent=entry.title;
    const url=document.createElement('div');url.className='url';url.textContent=entry.url||'Default search engine';details.append(name,url);row.append(dot,details);
    row.addEventListener('mousedown',event=>event.preventDefault());row.addEventListener('click',()=>open(entry).catch(error));section.append(row);
  });
  if (visible.length) $('query').setAttribute('aria-activedescendant','result-'+selected);else $('query').removeAttribute('aria-activedescendant');
  $('status').textContent=visible.length ? `${visible.length} ${visible.length===1?'result':'results'}` : 'No matching pages. Type a URL or search.';
}
function move(direction) {
  if (!visible.length) return;
  selected=(selected+direction+visible.length)%visible.length;
  for (const row of $('results').querySelectorAll('[role=option]')) row.setAttribute('aria-selected',String(row.id==='result-'+selected));
  $('query').setAttribute('aria-activedescendant','result-'+selected);
  $('result-'+selected)?.scrollIntoView({block:'nearest'});
}
async function open(entry) {
  if (!entry || busy || !current) return;
  busy=true;
  try {
    // Never switch to the source tab: navigate only this pane.
    if (entry.search) await chrome.search.query({text:entry.search,tabId:current.id});
    else await chrome.tabs.update(current.id,{url:entry.url});
  } catch (failure) {busy=false;throw failure;}
}
async function refresh() {
  const generation=++refreshGeneration;
  const allowed=await chrome.permissions.contains({permissions:['tabs']});
  const saved=await chrome.storage.local.get([WorkflowGroups.key,WorkflowChat.key]);
  const [tabs,groups]=await Promise.all([allowed?chrome.tabs.query({}):[],chrome.tabGroups.query({})]);
  if (generation!==refreshGeneration) return;
  entries=SplitPicker.entries(tabs,groups,WorkflowGroups.resolve(saved[WorkflowGroups.key],saved[WorkflowChat.key]),current);
  $('permission').hidden=allowed;render();
}
$('query').addEventListener('input',()=>{selected=0;render();});
document.addEventListener('keydown',event=>{
  if (event.isComposing) return;
  if (event.target!==$('query') && event.key!=='Escape') return;
  if (event.key==='ArrowDown'||event.ctrlKey&&!event.altKey&&event.key==='j') {event.preventDefault();move(1);}
  else if(event.key==='ArrowUp'||event.ctrlKey&&!event.altKey&&event.key==='k') {event.preventDefault();move(-1);}
  else if(event.key==='Enter') {event.preventDefault();open(event.shiftKey?SplitPicker.destination($('query').value):visible[selected]).catch(error);}
  else if(event.key==='Escape') {event.preventDefault();if($('query').value){$('query').value='';selected=0;render();focusQuery();}else cancel().catch(error);}
});
async function cancel() {
  if (!current) return;
  const tab=await chrome.tabs.get(current.id);
  if (!(tab.splitViewId>=0)) return;
  const peers=await chrome.tabs.query({windowId:tab.windowId});
  const source=peers.find(t=>t.id!==tab.id&&t.splitViewId===tab.splitViewId);
  if (source) await chrome.tabs.update(source.id,{active:true});
  await chrome.tabs.remove(tab.id);
}
for(const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click',()=>{
  filter=button.dataset.filter;selected=0;
  for(const item of document.querySelectorAll('[data-filter]')) item.setAttribute('aria-pressed',String(item===button));
  render();focusQuery();
});
$('allow-tabs').addEventListener('click',async()=>{
  try {if(await chrome.permissions.request({permissions:['tabs']})) await refresh();else $('status').textContent='Open-tab access declined. Presets and URL/search are still available.';}catch(failure){error(failure);}focusQuery();
});
chrome.permissions.onAdded.addListener(()=>{if(current)refresh().catch(error);});
chrome.permissions.onRemoved.addListener(()=>{if(current)refresh().catch(error);});
(async()=>{current=await chrome.tabs.getCurrent();await refresh();focusQuery();})().catch(error);
