const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

async function render() {
  const { allowlist, level } = await api.storage.local.get({ allowlist: [], level: LMA_DEFAULT_LEVEL });
  document.body.dataset.level = level;
  const list = $("list");
  if (!allowlist.length) {
    const li = document.createElement("li"); li.className = "empty"; li.textContent = "No trusted sites yet.";
    list.replaceChildren(li);
  } else {
    list.replaceChildren(...allowlist.map((s) => {
      const li = document.createElement("li");
      const name = document.createElement("span"); name.textContent = s;
      const rm = document.createElement("button"); rm.className = "ghost"; rm.textContent = "Remove";
      rm.onclick = async () => {
        await api.storage.local.set({ allowlist: allowlist.filter((x) => x !== s) });
        render();
      };
      li.append(name, rm);
      return li;
    }));
  }
  $("levels").replaceChildren(...LMA_LEVELS.slice(1).map((L) => {
    const d = document.createElement("div");
    const b = document.createElement("b"); b.textContent = L.name;
    const p = document.createElement("span"); p.className = "muted"; p.textContent = L.features.join(" · ");
    d.append(b, p);
    return d;
  }));
}

$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  let v = $("site").value.trim();
  if (!v) return;
  try { v = new URL(v.includes("://") ? v : "https://" + v).hostname; } catch { return; }
  const { allowlist } = await api.storage.local.get({ allowlist: [] });
  const site = lmaSite(v);
  if (!allowlist.includes(site)) await api.storage.local.set({ allowlist: [...allowlist, site].sort() });
  $("site").value = "";
  render();
});

render();
