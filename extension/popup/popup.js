const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

let state = { level: LMA_DEFAULT_LEVEL, siteLevels: {} };
let tab, site;

function list(ul, items) {
  ul.replaceChildren(...items.map((f) => {
    const li = document.createElement("li"); li.textContent = f; return li;
  }));
}

function render() {
  const all = state.level;
  $("allBox").dataset.level = all;
  $("allLevel").value = all;
  $("allName").textContent = LMA_LEVELS[all].name;

  // With no web page open, the everywhere level is the only thing to describe.
  $("allBlurb").hidden = $("allFeatures").hidden = !!site;
  if (!site) {
    $("allBlurb").textContent = LMA_LEVELS[all].blurb;
    list($("allFeatures"), LMA_LEVELS[all].features);
    return;
  }
  const custom = site in state.siteLevels;
  const lvl = lmaLevelFor(state, site);
  const L = LMA_LEVELS[lvl];
  $("siteBox").hidden = false;
  $("siteBox").dataset.level = lvl;
  $("host").textContent = site;
  $("siteLevel").value = lvl;
  $("siteName").textContent = L.name;
  $("blurb").textContent = L.blurb;
  list($("features"), L.features);

  const tag = $("siteTag");
  tag.replaceChildren();
  if (custom) {
    const reset = document.createElement("a");
    reset.href = "#"; reset.textContent = "Reset";
    reset.title = "Use the everywhere level on this site";
    reset.onclick = (e) => { e.preventDefault(); setSite(undefined); };
    tag.append(reset);
  } else {
    tag.textContent = "as everywhere";
  }
}

async function renderCount() {
  if (!tab || !site) return;
  if (lmaLevelFor(state, site) === 0) { $("count").textContent = "Protection off"; return; }
  const r = await api.runtime.sendMessage({ type: "blockedCount", tabId: tab.id }).catch(() => null);
  if (r && r.count != null) $("count").textContent = `${r.count} blocked or cleaned`;
}

async function save(patch) {
  Object.assign(state, patch);
  await api.storage.local.set(patch);
  render();
  $("reload").hidden = !site;
}

function setSite(level) {
  const siteLevels = { ...state.siteLevels };
  // Picking the same level as everywhere just follows it, so it keeps following later.
  if (level === undefined || level === state.level) delete siteLevels[site];
  else siteLevels[site] = level;
  return save({ siteLevels });
}

function preview(box, level, nameEl) {
  box.dataset.level = level;
  nameEl.textContent = LMA_LEVELS[level].name;
}

$("siteLevel").addEventListener("input", (e) => {
  const l = +e.target.value;
  preview($("siteBox"), l, $("siteName"));
  $("blurb").textContent = LMA_LEVELS[l].blurb;
  list($("features"), LMA_LEVELS[l].features);
});
$("siteLevel").addEventListener("change", (e) => setSite(+e.target.value));

$("allLevel").addEventListener("input", (e) => preview($("allBox"), +e.target.value, $("allName")));
$("allLevel").addEventListener("change", async (e) => {
  const level = +e.target.value;
  // Sites that had been set to the new everywhere level no longer need their own setting.
  const siteLevels = Object.fromEntries(Object.entries(state.siteLevels).filter(([, l]) => l !== level));
  await save({ level, siteLevels });
});

$("reload").addEventListener("click", async (e) => {
  e.preventDefault();
  await api.runtime.sendMessage({ type: "applied" }).catch(() => {});
  api.tabs.reload(tab.id);
  window.close();
});
$("opts").addEventListener("click", (e) => { e.preventDefault(); api.runtime.openOptionsPage(); });

(async () => {
  state = await api.storage.local.get({ level: LMA_DEFAULT_LEVEL, siteLevels: {} });
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol)) site = lmaSite(u.hostname);
  } catch {}
  render();
  renderCount();
})();
