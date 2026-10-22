(() => {
  const colors = {blue:'#1a73e8',green:'#188038',purple:'#a142f4',orange:'#fa903e',cyan:'#007b83',pink:'#d01884',yellow:'#fbbc04',red:'#d93025',grey:'#5f6368'};
  function destination(text) {
    text = text.trim();
    if (!text) return null;
    if (/^(https?:|file:|chrome:|about:)/i.test(text)) {
      try { return {url:new URL(text).href}; } catch { return {search:text}; }
    }
    // Never turn executable schemes into navigations, including pasted links.
    if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^[\w.-]+:\d+(?:[/?#]|$)/.test(text)) return {search:text};
    if (!/\s/.test(text) && /^(localhost|\[[\da-f:]+\]|[\w-]+(?:\.[\w-]+)+)(?::\d+)?(?:[/?#].*)?$/i.test(text)) {
      try { return {url:new URL('http' + (/^(localhost|127\.)/.test(text)?'':'s')+'://'+text).href}; } catch {}
    }
    return {search:text};
  }
  function entries(tabs, groups, presets, current) {
    const result = [], byGroup = new Map(groups.map(g=>[g.id,g]));
    for (const tab of [...tabs].sort((a,b)=>Number(b.windowId===current.windowId)-Number(a.windowId===current.windowId)||a.windowId-b.windowId||a.index-b.index)) {
      if (tab.id===current.id || tab.splitViewId>=0 && tab.splitViewId===current.splitViewId || !tab.url || !destination(tab.url)?.url) continue;
      const group=byGroup.get(tab.groupId), where=tab.windowId===current.windowId?'This window':'Other window';
      result.push({kind:'tabs',url:tab.url,title:tab.title||tab.url,color:group?.color||'grey',section:where+' · '+(group?.title|| (group?'Unnamed group':'Ungrouped')),sectionId:'tabs:'+tab.windowId+':'+tab.groupId});
    }
    for (const preset of presets) for (const url of preset.urls) {
      result.push({kind:'presets',url,title:new URL(url).hostname,color:preset.color,section:'Preset · '+preset.name,sectionId:'preset:'+preset.id});
    }
    const sections = new Map();
    for (const entry of result) {
      if (!sections.has(entry.sectionId)) sections.set(entry.sectionId, []);
      sections.get(entry.sectionId).push(entry);
    }
    return [...sections.values()].flat();
  }
  function matches(entries, query, filter='all') {
    const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return entries.filter(e=>(filter==='all'||e.kind===filter)&&words.every(word=>(e.title+' '+e.url+' '+e.section).toLocaleLowerCase().includes(word)));
  }
  globalThis.SplitPicker = {colors,destination,entries,matches};
})();
