/* Leave Me Alone — background service worker.
 *
 * There is one "everywhere" level plus optional per-site levels. Every network rule
 * belongs to a level (its tier). Rules are installed as dynamic rules so each can be
 * scoped by site:
 *   - tier at or below the everywhere level: on for all sites, except those set lower;
 *   - tier above it: on only for the sites set to that level or higher.
 * Sites set to Off get one high-priority allowAllRequests rule instead.
 */
importScripts("levels.js");

const api = globalThis.browser ?? globalThis.chrome;
const DNR = api.declarativeNetRequest;
const ALLOW_RULE_BASE = 90000;
const SIGNALS_RANGE = [3000, 3999]; // ruleset #3 ("signals") only adds headers

async function getState() {
  const s = await api.storage.local.get({ level: LMA_DEFAULT_LEVEL, siteLevels: {}, allowlist: null });
  // v1.0 had an on/off "trusted sites" list: those become sites set to Off.
  if (Array.isArray(s.allowlist)) {
    for (const site of s.allowlist) if (!(site in s.siteLevels)) s.siteLevels[site] = 0;
    await api.storage.local.set({ siteLevels: s.siteLevels });
    await api.storage.local.remove("allowlist");
  }
  return { level: Math.max(0, Math.min(4, s.level | 0)), siteLevels: s.siteLevels };
}

// --- network rules ----------------------------------------------------------
const bundled = {};
async function loadRuleset(name) {
  if (!bundled[name]) bundled[name] = await (await fetch(api.runtime.getURL(`rules/${name}.json`))).json();
  return bundled[name];
}

// Page loads are matched on the site being visited; everything else on the page that
// asked for it.
const siteScope = (rule) => (rule.condition.resourceTypes.includes("main_frame")
  ? ["requestDomains", "excludedRequestDomains"]
  : ["initiatorDomains", "excludedInitiatorDomains"]);

async function buildRules({ level, siteLevels }) {
  const entries = Object.entries(siteLevels);
  const rules = [];
  for (const [i, [name, tier]] of LMA_RULESETS.entries()) {
    const below = entries.filter(([, l]) => l < tier).map(([s]) => s);
    const atOrAbove = entries.filter(([, l]) => l >= tier).map(([s]) => s);
    const global = level >= tier;
    if (!global && !atOrAbove.length) continue;
    for (const rule of await loadRuleset(name)) {
      const cond = { ...rule.condition };
      const [include, exclude] = siteScope(rule);
      if (global) { if (below.length) cond[exclude] = below; }
      else cond[include] = atOrAbove;
      rules.push({ ...rule, id: (i + 1) * 1000 + rule.id, condition: cond });
    }
  }
  entries.filter(([, l]) => l === 0).forEach(([site], i) => rules.push({
    id: ALLOW_RULE_BASE + i, priority: 1000, action: { type: "allowAllRequests" },
    condition: { requestDomains: [site], resourceTypes: ["main_frame"] },
  }));
  return rules;
}

async function applyNetworkRules(state) {
  const existing = await DNR.getDynamicRules();
  await DNR.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: await buildRules(state),
  });
}

// --- in-page scripts --------------------------------------------------------
const patterns = (sites) => sites.flatMap((s) => [`*://${s}/*`, `*://*.${s}/*`]);

async function applyContentScripts({ level, siteLevels }) {
  const reg = await api.scripting.getRegisteredContentScripts();
  if (reg.length) await api.scripting.unregisterContentScripts({ ids: reg.map((r) => r.id) });

  const entries = Object.entries(siteLevels);
  const sitesWhere = (fn) => entries.filter(([, l]) => fn(l)).map(([s]) => s);
  const base = { runAt: "document_start", allFrames: true, persistAcrossSessions: true };

  // Script that should run where the level satisfies `want`.
  async function scriptFor(id, want, js, world) {
    let matches, excludeMatches = [];
    if (want(level)) {
      matches = ["<all_urls>"];
      excludeMatches = patterns(sitesWhere((l) => !want(l)));
    } else {
      matches = patterns(sitesWhere(want));
      if (!matches.length) return;
    }
    await register({ ...base, id, js, matches, excludeMatches, ...(world ? { world } : {}) });
  }

  await scriptFor("cleaner", (l) => l >= 1, ["src/levels.js", "src/params.js", "src/cleaner.js"]);
  for (const l of [3, 4]) {
    await scriptFor(`shield${l}`, (x) => x === l, [`src/shield-cfg-${l}.js`, "src/shield.js"], "MAIN");
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

// --- browser-wide privacy settings (Chromium only) --------------------------
// These can't be set per site, so they follow the everywhere level.
async function applyPrivacy({ level, siteLevels }) {
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
    // 1.0 switched referrers off browser-wide on Paranoid; the per-site rules do that now.
    p.websites?.referrersEnabled?.clear?.({}).catch?.(() => {});
  } catch {}

  // Chrome's own third-party cookie block is browser-wide, so give sites set below
  // Balanced an exception, or turning a site down wouldn't fully undo it.
  const cs = api.contentSettings?.cookies;
  if (!cs) return;
  try {
    await cs.clear({}); // only clears exceptions this extension made
    if (level < 2) return;
    for (const [site, l] of Object.entries(siteLevels)) {
      if (l < 2) await cs.set({ primaryPattern: "<all_urls>", secondaryPattern: `*://*.${site}/*`, setting: "allow" });
    }
  } catch (e) { console.warn("Leave Me Alone: cookie exceptions", e); }
}

let applying = Promise.resolve();
function applyAll() {
  // Serialise: two quick changes must not interleave their rule updates.
  applying = applying.then(async () => {
    const state = await getState();
    await applyNetworkRules(state);
    await applyContentScripts(state);
    await applyPrivacy(state);
    try { await DNR.setExtensionActionOptions({ displayActionCountAsBadgeText: true }); } catch {}
    try { await api.action.setBadgeBackgroundColor({ color: "#4b3fd6" }); } catch {}
  }).catch((e) => console.error("Leave Me Alone: apply failed", e));
  return applying;
}

api.runtime.onInstalled.addListener(applyAll);
api.runtime.onStartup.addListener(applyAll);
api.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && (ch.level || ch.siteLevels)) applyAll();
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
  if (lmaLevelFor(await getState(), site) < 4) return;
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
      // The signals rules only add the GPC/DNT headers, and allow rules block nothing.
      .then((r) => reply({ count: r.rulesMatchedInfo.filter(({ rule: { ruleId: id } }) =>
        !(id >= SIGNALS_RANGE[0] && id <= SIGNALS_RANGE[1]) && id < ALLOW_RULE_BASE).length }))
      .catch(() => reply({ count: null }));
    return true;
  }
  if (msg?.type === "applied") { applying.then(() => reply(true)); return true; }
});
