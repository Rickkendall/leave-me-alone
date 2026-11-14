const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

function levelSelect(sel, value) {
  sel.replaceChildren(...LMA_LEVELS.map((L, i) => {
    const o = document.createElement("option"); o.value = i; o.textContent = L.name; return o;
  }));
  sel.value = value;
  sel.dataset.level = value;
  return sel;
}

async function load() {
  return api.storage.local.get({ level: LMA_DEFAULT_LEVEL, siteLevels: {} });
}

async function render() {
  const { level, siteLevels } = await load();
  levelSelect($("allLevel"), level);
  if (!$("newLevel").options.length) levelSelect($("newLevel"), 0); // usually: a site that broke

  const sites = Object.keys(siteLevels).sort();
  const list = $("list");
  if (!sites.length) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = "No sites have their own setting yet. You can also set one from the popup.";
    list.replaceChildren(li);
  } else {
    list.replaceChildren(...sites.map((s) => {
      const li = document.createElement("li");
      li.dataset.level = siteLevels[s];
      const name = document.createElement("span"); name.textContent = s;
      const controls = document.createElement("span"); controls.className = "controls";
      const sel = levelSelect(document.createElement("select"), siteLevels[s]);
      sel.setAttribute("aria-label", `Level for ${s}`);
      sel.onchange = () => update((m) => { m[s] = +sel.value; });
      const rm = document.createElement("button"); rm.className = "ghost"; rm.textContent = "Remove";
      rm.title = "Use the everywhere level on this site";
      rm.onclick = () => update((m) => { delete m[s]; });
      controls.append(sel, rm);
      li.append(name, controls);
      return li;
    }));
  }

  $("levels").replaceChildren(...LMA_LEVELS.slice(1).map((L, i) => {
    const d = document.createElement("div");
    d.dataset.level = i + 1;
    const b = document.createElement("b"); b.className = "lvl"; b.textContent = L.name;
    const p = document.createElement("span"); p.className = "muted"; p.textContent = L.features.join(" · ");
    d.append(b, p);
    return d;
  }));
}

async function update(fn) {
  const { siteLevels } = await load();
  fn(siteLevels);
  await api.storage.local.set({ siteLevels });
  render();
}

$("allLevel").addEventListener("change", async (e) => {
  await api.storage.local.set({ level: +e.target.value });
  render();
});

$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  let v = $("site").value.trim();
  if (!v) return;
  try { v = new URL(v.includes("://") ? v : "https://" + v).hostname; } catch { return; }
  const site = lmaSite(v), lvl = +$("newLevel").value;
  await update((m) => { m[site] = lvl; });
  $("site").value = "";
});

render();
