/* Leave Me Alone — link cleaner (isolated world, document_start).
 * Strips tracking parameters, unwraps redirect links and removes <a ping>. */
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const PARAMS = new Set(LMA_TRACKING_PARAMS);
  let level = 2;
  api.storage.local.get({ level: 2 }).then((s) => { level = s.level; cleanLocation(); });

  // host -> query param that holds the real destination
  const REDIRECTORS = [
    [/(^|\.)google\.[a-z.]+$/, "/url", ["q", "url"]],
    [/^l\.facebook\.com$|^lm\.facebook\.com$/, "/l.php", ["u"]],
    [/^l\.instagram\.com$/, "/", ["u"]],
    [/(^|\.)youtube\.com$/, "/redirect", ["q"]],
    [/^out\.reddit\.com$/, "/", ["url"]],
    [/^disq\.us$/, "/url", ["url"]],
    [/(^|\.)steamcommunity\.com$/, "/linkfilter/", ["url", "u"]],
    [/(^|\.)linkedin\.com$/, "/redir/redirect", ["url"]],
    [/^href\.li$/, "/", null],
    [/(^|\.)safelinks\.protection\.outlook\.com$/, "/", ["url"]],
    [/^(www\.)?bing\.com$/, "/ck/a", null],
  ];

  function unwrap(u) {
    for (const [host, path, keys] of REDIRECTORS) {
      if (!host.test(u.hostname) || !u.pathname.startsWith(path)) continue;
      if (keys === null) { // destination is the whole query string (href.li?https://…)
        const raw = decodeURIComponent(u.search.slice(1));
        if (/^https?:\/\//.test(raw)) return new URL(raw);
        continue;
      }
      for (const k of keys) {
        const v = u.searchParams.get(k);
        if (v && /^https?:\/\//i.test(v)) return new URL(v);
      }
    }
    return u;
  }

  function strip(u) {
    let changed = false;
    for (const k of [...u.searchParams.keys()]) {
      if (PARAMS.has(k)) { u.searchParams.delete(k); changed = true; }
    }
    // Some trackers hide params in the fragment (#utm_source=…)
    if (u.hash.includes("=")) {
      const h = new URLSearchParams(u.hash.slice(1));
      let hc = false;
      for (const k of [...h.keys()]) if (PARAMS.has(k)) { h.delete(k); hc = true; }
      if (hc) { const s = h.toString(); u.hash = s ? "#" + s : ""; changed = true; }
    }
    return changed;
  }

  function cleanHref(href) {
    let u;
    try { u = new URL(href, location.href); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const out = unwrap(u);
    const unwrapped = out !== u;
    const stripped = strip(out);
    return unwrapped || stripped ? out.href : null;
  }

  function cleanLink(a) {
    if (level < 1 || !a || !a.href) return;
    const next = cleanHref(a.href);
    if (next) {
      a.href = next;
      // Stop sites (looking at you, Google) re-wrapping the link on mousedown.
      a.removeAttribute("onmousedown");
      a.removeAttribute("data-jsarwt");
    }
    if (level >= 2 && a.hasAttribute("ping")) a.removeAttribute("ping");
  }

  const onPointer = (e) => cleanLink(e.target?.closest?.("a[href]"));
  for (const ev of ["mousedown", "auxclick", "click", "contextmenu", "touchstart", "keydown"]) {
    addEventListener(ev, onPointer, { capture: true, passive: true });
  }

  // The address bar itself (catches SPA routes and params added after load).
  function cleanLocation() {
    if (level < 1) return;
    const u = new URL(location.href);
    if (strip(u)) history.replaceState(history.state, "", u.href);
  }
  addEventListener("DOMContentLoaded", cleanLocation, { once: true });
  addEventListener("popstate", cleanLocation);

  // Copying a link should copy the clean version.
  addEventListener("copy", (e) => {
    if (level < 1) return;
    const text = getSelection()?.toString().trim();
    if (!text || /\s/.test(text) || !/^https?:\/\//.test(text)) return;
    const next = cleanHref(text);
    if (next) { e.clipboardData.setData("text/plain", next); e.preventDefault(); }
  }, true);
})();
