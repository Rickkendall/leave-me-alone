/* Leave Me Alone — background service worker. */
importScripts("levels.js");

const api = globalThis.browser ?? globalThis.chrome;
const DNR = api.declarativeNetRequest;
const ALLOW_RULE_BASE = 10000;

async function getState() {
  const s = await api.storage.local.get({ level: LMA_DEFAULT_LEVEL, allowlist: [] });
  return { level: Math.max(0, Math.min(4, s.level | 0)), allowlist: s.allowlist };
}

// --- network rules ----------------------------------------------------------
async function applyRulesets(level) {
  const want = new Set(LMA_LEVELS[level].rulesets);
  await DNR.updateEnabledRulesets({
    enableRulesetIds: LMA_ALL_RULESETS.filter((r) => want.has(r)),
    disableRulesetIds: LMA_ALL_RULESETS.filter((r) => !want.has(r)),
  });
}

async function applyAllowlist(allowlist) {
  const existing = await DNR.getDynamicRules();
  const addRules = allowlist.map((site, i) => ({
    id: ALLOW_RULE_BASE + i,
    priority: 1000,
    action: { type: "allowAllRequests" },
    condition: { requestDomains: [site], resourceTypes: ["main_frame", "sub_frame"] },
  }));
  await DNR.updateDynamicRules({ removeRuleIds: existing.map((r) => r.id), addRules });
}

// --- in-page scripts --------------------------------------------------------
const excludesFor = (allowlist) => allowlist.flatMap((s) => [`*://${s}/*`, `*://*.${s}/*`]);

async function applyContentScripts(level, allowlist) {
  const reg = await api.scripting.getRegisteredContentScripts();
  if (reg.length) await api.scripting.unregisterContentScripts({ ids: reg.map((r) => r.id) });
  if (level === 0) return;

  const common = {
    matches: ["<all_urls>"],
    excludeMatches: excludesFor(allowlist),
    runAt: "document_start",
    allFrames: true,
    persistAcrossSessions: true,
  };
  await register({ ...common, id: "cleaner", js: ["src/params.js", "src/cleaner.js"] });
  if (level >= 3) {
    await register({ ...common, id: "shield", world: "MAIN", js: [`src/shield-cfg-${level}.js`, "src/shield.js"] });
  }
}

// Registered one at a time so a browser that rejects one script (e.g. an older Safari
// without world:"MAIN") still gets the others.
async function register(script) {
  try {
    await api.scripting.registerContentScripts([{ ...script, matchOriginAsFallback: true }]);
  } catch {
    // Safari and older Chromium don't know matchOriginAsFallback.
    try { await api.scripting.registerContentScripts([script]); }
    catch (e) { console.warn("Leave Me Alone: could not register", script.id, e); }
  }
}

// --- browser-level privacy (Chromium only) ---------------------------------
async function applyPrivacy(level) {
  const p = api.privacy;
  if (!p) return;
  const set = (setting, value) => setting?.set({ value }).catch?.(() => {});
  try {
    set(p.network?.webRTCIPHandlingPolicy, level >= 3 ? "disable_non_proxied_udp" : "default");
    set(p.websites?.hyperlinkAuditingEnabled, level < 2);
    set(p.websites?.thirdPartyCookiesAllowed, level < 2);
    set(p.network?.networkPredictionEnabled, level < 3);
    set(p.services?.alternateErrorPagesEnabled, level < 3);
    set(p.websites?.topicsEnabled, level < 1);
    set(p.websites?.fledgeEnabled, level < 1);
    set(p.websites?.adMeasurementEnabled, level < 1);
    set(p.websites?.referrersEnabled, level < 4);
  } catch {}
}

async function applyAll() {
  const { level, allowlist } = await getState();
  await applyRulesets(level);
  await applyAllowlist(allowlist);
  await applyContentScripts(level, allowlist);
  await applyPrivacy(level);
  try { await DNR.setExtensionActionOptions({ displayActionCountAsBadgeText: level > 0 }); } catch {}
  try { await api.action.setBadgeBackgroundColor({ color: "#4b3fd6" }); } catch {}
}

api.runtime.onInstalled.addListener(applyAll);
api.runtime.onStartup.addListener(applyAll);
api.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && (ch.level || ch.allowlist)) applyAll();
});

// --- Paranoid: forget a site when its last tab closes ------------------------
const tabSites = new Map(); // tabId -> site (rebuilt from tabs.query when the worker wakes)

async function rebuildTabSites() {
  for (const t of await api.tabs.query({})) {
    try { if (t.url) tabSites.set(t.id, lmaSite(new URL(t.url).hostname)); } catch {}
  }
}
const ready = rebuildTabSites();

async function forgetIfUnused(site) {
  if (!site) return;
  const { level, allowlist } = await getState();
  if (level < 4 || allowlist.includes(site)) return;
  if ([...tabSites.values()].includes(site)) return;

  const cookies = await api.cookies.getAll({ domain: site });
  await Promise.all(cookies.map((c) => {
    const host = c.domain.replace(/^\./, "");
    return api.cookies.remove({
      url: `http${c.secure ? "s" : ""}://${host}${c.path}`, name: c.name, storeId: c.storeId,
    }).catch(() => {});
  }));
  if (api.browsingData?.remove) {
    const origins = [`https://${site}`, `https://www.${site}`, `http://${site}`, `http://www.${site}`];
    api.browsingData.remove({ origins }, {
      localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true, fileSystems: true,
    }).catch(() => {});
  }
}

api.tabs.onUpdated.addListener(async (tabId, info) => {
  if (!info.url) return;
  await ready;
  const prev = tabSites.get(tabId);
  let next;
  try { next = lmaSite(new URL(info.url).hostname); } catch {}
  tabSites.set(tabId, next);
  if (prev && prev !== next) forgetIfUnused(prev);
});

api.tabs.onRemoved.addListener(async (tabId) => {
  await ready;
  const prev = tabSites.get(tabId);
  tabSites.delete(tabId);
  forgetIfUnused(prev);
});

// --- popup messaging --------------------------------------------------------
api.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "blockedCount") {
    DNR.getMatchedRules({ tabId: msg.tabId })
      .then((r) => reply({ count: r.rulesMatchedInfo.length }))
      .catch(() => reply({ count: null }));
    return true;
  }
});
