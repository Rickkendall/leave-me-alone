// End-to-end test: loads the unpacked extension into headless Chrome, maps every hostname to a
// local test server, and checks each protection level actually does what it claims.
// Usage: node tools/test-e2e.mjs [path/to/chrome]
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = process.argv[2] || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EXT = fileURLToPath(new URL("../extension", import.meta.url));
const PORT = 8771, DBG = 9339;
const hits = [];

createServer((req, res) => {
  const host = req.headers.host.split(":")[0];
  hits.push({ host, path: req.url, cookie: req.headers.cookie || "", referer: req.headers.referer || "",
    gpc: req.headers["sec-gpc"] || "" });
  if (req.url.startsWith("/page")) {
    res.setHeader("content-type", "text/html");
    return res.end(`<!doctype html><a id=g href="https://www.google.com/url?q=https%3A%2F%2Fexample.org%2F%3Fa%3D1%26utm_source%3Dx">x</a>
      <script src="http://pixel.quantserve.com:${PORT}/q.js"></script>
      <script src="http://cdn.friendly.test:${PORT}/lib.js"></script>
      <img src="http://cdn.friendly.test:${PORT}/pixel.gif">
      <iframe src="http://embed.other.test:${PORT}/frame"></iframe>`);
  }
  res.setHeader("set-cookie", "tp=1; Path=/; SameSite=None");
  res.end("");
}).listen(PORT);

const profile = mkdtempSync(join(tmpdir(), "lma-test-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--user-data-dir=${profile}`, `--remote-debugging-port=${DBG}`,
  "--enable-unsafe-extension-debugging", // lets us load the unpacked extension over CDP
  `--host-resolver-rules=MAP * 127.0.0.1`, "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); } catch { await sleep(200); }
  }
  throw new Error("Chrome did not start");
}
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); pending.delete(d.id); };
  const open = new Promise((r) => (ws.onopen = r));
  return {
    async send(method, params = {}) {
      await open; const i = ++id; ws.send(JSON.stringify({ id: i, method, params }));
      const d = await new Promise((r) => pending.set(i, r));
      if (d.error) throw new Error(`${method}: ${d.error.message}`);
      return d.result;
    },
    async eval(expr) {
      const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
      return r.result.value;
    },
    close: () => ws.close(),
  };
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
};

try {
  await targets();
  const browserWs = (await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json()).webSocketDebuggerUrl;
  const browser = cdp(browserWs);
  const { id: extId } = await browser.send("Extensions.loadUnpacked", { path: EXT });
  console.log("Loaded extension", extId);
  let sw;
  for (let i = 0; i < 40 && !sw; i++) {
    sw = (await targets()).find((t) => t.type === "service_worker" && t.url.endsWith("/src/background.js"));
    if (!sw) await sleep(250);
  }
  if (!sw) throw new Error("Extension service worker not found — Chrome refused --load-extension?");
  const bg = cdp(sw.webSocketDebuggerUrl);
  const page = cdp((await targets()).find((t) => t.type === "page").webSocketDebuggerUrl);
  await page.send("Page.enable");

  const setLevel = async (level, allowlist = []) => {
    await bg.eval(`chrome.storage.local.set({level:${level}, allowlist:${JSON.stringify(allowlist)}})`);
    await sleep(600);
  };
  const visit = async (url) => {
    hits.length = 0;
    await page.send("Page.navigate", { url });
    await sleep(1500);
    return page.eval("location.href");
  };
  const hit = (host) => hits.find((h) => h.host === host);

  // Seed a third-party cookie so we can see whether it is sent.
  await setLevel(0);
  await visit(`http://cdn.friendly.test:${PORT}/seed`);

  for (const level of [0, 1, 2, 3, 4]) {
    console.log(`\nLevel ${level}`);
    await setLevel(level);
    const url = await visit(`http://news.site.test:${PORT}/page?id=7&utm_source=mail&fbclid=abc`);
    const trk = !!hit("pixel.quantserve.com"), cdn = hit("cdn.friendly.test");
    check("tracker blocked", trk === (level === 0), `tracker hit=${trk}`);
    check("tracking params stripped", (url.includes("utm_source")) === (level === 0), url);
    check("normal third-party script still loads", !!cdn);
    check("GPC sent", (cdn?.gpc === "1") === (level >= 1));
    check("3p Referer stripped", !!cdn?.referer === (level < 2), `referer="${cdn?.referer}"`);
    check("3p iframe blocked", !hit("embed.other.test") === (level >= 4));
    const fp = await page.eval(`(() => { const c = document.createElement('canvas'); c.width = 60; c.height = 20;
      const x = c.getContext('2d'); x.fillStyle = '#f60'; x.fillRect(0,0,60,20); x.fillStyle = '#069';
      x.font = '14px Arial'; x.fillText('fp test', 2, 15);
      return { data: c.toDataURL().slice(-40), cores: navigator.hardwareConcurrency,
        rtc: typeof RTCPeerConnection, ts: Function.prototype.toString.call(HTMLCanvasElement.prototype.toDataURL) }; })()`);
    if (level === 0) var baseline = fp.data;
    check("canvas fingerprint randomised", (fp.data !== baseline) === (level >= 3));
    check("spoofed function looks native", fp.ts.includes("[native code]"), fp.ts);
    check("hardware spoofed / WebRTC removed", (fp.cores === 4 && fp.rtc === "undefined") === (level >= 4),
      `cores=${fp.cores} rtc=${fp.rtc}`);
    const link = await page.eval(`(() => { const a = document.getElementById('g');
      a.dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); return a.href; })()`);
    check("redirect link unwrapped + cleaned", (link === "https://example.org/?a=1") === (level >= 1), link);
  }

  console.log("\nTrusted site");
  await setLevel(4, ["site.test"]);
  const url = await visit(`http://news.site.test:${PORT}/page?utm_source=mail`);
  check("trusted site is left alone", !!hit("pixel.quantserve.com") && url.includes("utm_source"));

  bg.close(); page.close();
} catch (e) {
  console.error(e.message); failures++;
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
  console.log(failures ? `\n${failures} failure(s)` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
