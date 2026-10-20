(() => {
  const key = 'chatGroupUrls';
  const defaults = [
    'https://www.messenger.com/',
    'https://web.whatsapp.com/',
    'https://discord.com/channels/@me',
  ];
  function host(url) {
    return url.hostname.split('.').length >= 3 ? url.hostname.replace(/^www\./, '') : url.hostname;
  }
  function site(url) { return `${url.protocol}//${host(url)}:${url.port}`; }
  function normalize(value) {
    const entries = typeof value === 'string' ? value.split(/\r?\n/) : value;
    if (!Array.isArray(entries)) throw Error('Enter one URL per line.');
    const urls = [], sites = new Set();
    for (const entry of entries) {
      if (typeof entry !== 'string') throw Error('Enter one URL per line.');
      if (!entry.trim()) continue;
      let url;
      try { url = new URL(entry.trim()); } catch { throw Error(`Invalid URL: ${entry.trim()}`); }
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname) throw Error('Group URLs must start with https:// or http://.');
      if (url.username || url.password) throw Error('Group URLs cannot contain a username or password.');
      if (sites.has(site(url))) throw Error(`Use only one URL per website: ${url.hostname}`);
      sites.add(site(url)); urls.push(url.href);
    }
    if (!urls.length) throw Error('Add at least one URL.');
    return urls;
  }
  function resolve(saved) {
    try { return normalize(saved); } catch { return [...defaults]; }
  }
  function patterns(urls) {
    return urls.map(value => {
      const url = new URL(value), hostname = host(url);
      const wildcard = hostname.includes('.') && !/^[\d.]+$/.test(hostname) && !hostname.includes(':');
      return `${url.protocol}//${wildcard ? '*.' : ''}${hostname}/*`;
    });
  }
  function identify(tab, urls = defaults) {
    try {
      const url = new URL(tab.pendingUrl || tab.url);
      return urls.map((value, index) => ({ target: new URL(value), index }))
        .filter(({ target }) => url.protocol === target.protocol && url.port === target.port
          && (url.hostname === host(target) || url.hostname.endsWith('.' + host(target))))
        .sort((a, b) => host(b.target).length - host(a.target).length)[0]?.index ?? -1;
    } catch { return -1; }
  }
  globalThis.WorkflowChat = { key, defaults, normalize, resolve, patterns, identify };
})();
