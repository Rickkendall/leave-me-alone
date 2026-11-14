const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

let state = { level: LMA_DEFAULT_LEVEL, allowlist: [] };
let tab, site;

function renderLevel(level) {
  const L = LMA_LEVELS[level];
  document.body.dataset.level = level;
  $("level").value = level;
  $("levelName").textContent = L.name;
  $("levelNum").textContent = `${level} / 4`;
  $("blurb").textContent = L.blurb;
  $("features").replaceChildren(...L.features.map((f) => {
    const li = document.createElement("li"); li.textContent = f; return li;
  }));
}

function renderSite() {
  const trusted = site && state.allowlist.includes(site);
  $("host").textContent = site || "No site";
  $("siteOn").checked = !trusted && state.level > 0;
  $("siteOn").disabled = !site || state.level === 0;
  document.body.classList.toggle("trusted", !!trusted);
}

async function renderCount() {
  if (!tab || !site) return;
  if (state.allowlist.includes(site)) { $("count").textContent = "Trusted — not protected"; return; }
  const r = await api.runtime.sendMessage({ type: "blockedCount", tabId: tab.id }).catch(() => null);
  if (r && r.count != null) $("count").textContent = `${r.count} request${r.count === 1 ? "" : "s"} blocked or cleaned`;
}

const changed = () => { $("reload").hidden = false; };

async function init() {
  state = await api.storage.local.get({ level: LMA_DEFAULT_LEVEL, allowlist: [] });
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol)) site = lmaSite(u.hostname);
  } catch {}
  renderLevel(state.level);
  renderSite();
  renderCount();
}

$("level").addEventListener("input", (e) => renderLevel(+e.target.value));
$("level").addEventListener("change", async (e) => {
  state.level = +e.target.value;
  await api.storage.local.set({ level: state.level });
  renderSite(); changed();
});

$("siteOn").addEventListener("change", async (e) => {
  const set = new Set(state.allowlist);
  e.target.checked ? set.delete(site) : set.add(site);
  state.allowlist = [...set].sort();
  await api.storage.local.set({ allowlist: state.allowlist });
  renderSite(); renderCount(); changed();
});

$("reload").addEventListener("click", () => { api.tabs.reload(tab.id); window.close(); });
$("opts").addEventListener("click", (e) => { e.preventDefault(); api.runtime.openOptionsPage(); });

init();
