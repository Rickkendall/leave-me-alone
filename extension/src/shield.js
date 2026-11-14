/* Leave Me Alone — fingerprint shield. Runs in the page's own world at document_start.
 * Level 3 (Strict): randomise canvas / WebGL / audio readouts, hide GPU and battery.
 * Level 4 (Paranoid): also flatten hardware, screen and timer details; remove WebRTC.
 *
 * Noise is deterministic per site per day: a site sees a stable fingerprint while you
 * browse it, but it differs from every other site, so fingerprints can't link you. */
(() => {
  const KEY = Symbol.for("lma.cfg");
  const LEVEL = self[KEY] | 0;
  try { delete self[KEY]; } catch {}
  if (LEVEL < 3) return; // config consumed above, so a second run is a no-op too

  // --- seeded PRNG ---------------------------------------------------------
  let h = 2166136261;
  const seedStr = location.hostname + "|" + new Date().toISOString().slice(0, 10);
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  const SEED = h >>> 0;
  const rand = (n) => { // stable pseudo-random in [0,1) for index n
    let x = (SEED ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };

  // --- make our wrappers look native -----------------------------------------
  const nativeStr = new WeakMap();
  const fnToString = Function.prototype.toString;
  const toStringProxy = new Proxy(fnToString, {
    apply(target, self, args) {
      return nativeStr.has(self) ? nativeStr.get(self) : Reflect.apply(target, self, args);
    },
  });
  nativeStr.set(toStringProxy, "function toString() { [native code] }");
  Function.prototype.toString = toStringProxy;

  function wrap(obj, prop, make) {
    if (!obj) return;
    const desc = Object.getOwnPropertyDescriptor(obj, prop);
    if (!desc || typeof desc.value !== "function") return;
    const orig = desc.value;
    const wrapped = new Proxy(orig, { apply: make(orig) });
    nativeStr.set(wrapped, `function ${prop}() { [native code] }`);
    Object.defineProperty(obj, prop, { ...desc, value: wrapped });
  }
  function getter(obj, prop, fn) {
    if (!obj) return;
    const desc = Object.getOwnPropertyDescriptor(obj, prop);
    if (!desc || !desc.get) return;
    const g = new Proxy(desc.get, { apply: (t, self, a) => fn(Reflect.apply(t, self, a), self) });
    nativeStr.set(g, `function get ${prop}() { [native code] }`);
    Object.defineProperty(obj, prop, { ...desc, get: g });
  }

  // --- canvas ----------------------------------------------------------------
  // Flip the lowest bit of a sparse, site-specific set of pixels. Invisible, but it
  // changes every hash a fingerprinter can compute.
  function noisePixels(data, w) {
    for (let i = 0; i < data.length; i += 4) {
      const px = i >> 2;
      if (rand(px % 4093 + (px / w | 0) % 7) < 0.02) {
        const c = (rand(px) * 3) | 0;
        data[i + c] ^= 1;
      }
    }
  }
  const C2D = self.CanvasRenderingContext2D?.prototype;
  wrap(C2D, "getImageData", (orig) => (t, ctx, args) => {
    const img = Reflect.apply(orig, ctx, args);
    noisePixels(img.data, img.width);
    return img;
  });
  function noisyCopy(canvas) {
    const w = canvas.width, h = canvas.height;
    if (!w || !h || w * h > 4096 * 4096) return null;
    try {
      const copy = document.createElement("canvas");
      copy.width = w; copy.height = h;
      const cx = copy.getContext("2d");
      cx.drawImage(canvas, 0, 0);
      const img = cx.getImageData(0, 0, w, h); // already noised by the wrapper above
      cx.putImageData(img, 0, 0);
      return copy;
    } catch { return null; }
  }
  const HC = self.HTMLCanvasElement?.prototype;
  for (const m of ["toDataURL", "toBlob"]) {
    wrap(HC, m, (orig) => (t, canvas, args) => Reflect.apply(orig, noisyCopy(canvas) || canvas, args));
  }
  const OC = self.OffscreenCanvasRenderingContext2D?.prototype;
  wrap(OC, "getImageData", (orig) => (t, ctx, args) => {
    const img = Reflect.apply(orig, ctx, args);
    noisePixels(img.data, img.width);
    return img;
  });
  // Text metrics are another canvas fingerprint: nudge widths by a sub-pixel amount.
  getter(self.TextMetrics?.prototype, "width", (v) => v + (rand(Math.round(v * 100)) - 0.5) * 0.01);

  // --- WebGL -----------------------------------------------------------------
  const GL_VENDOR_UNMASKED = 0x9245, GL_RENDERER_UNMASKED = 0x9246;
  for (const P of [self.WebGLRenderingContext?.prototype, self.WebGL2RenderingContext?.prototype]) {
    wrap(P, "getParameter", (orig) => (t, gl, args) => {
      if (args[0] === GL_VENDOR_UNMASKED) return "Google Inc.";
      if (args[0] === GL_RENDERER_UNMASKED) return "ANGLE (Generic GPU)";
      return Reflect.apply(orig, gl, args);
    });
    wrap(P, "readPixels", (orig) => (t, gl, args) => {
      const r = Reflect.apply(orig, gl, args);
      const buf = args[6];
      if (buf && buf.length) noisePixels(buf, args[2] || 1);
      return r;
    });
  }

  // --- audio -----------------------------------------------------------------
  const tweak = (arr) => { for (let i = 0; i < arr.length; i += 97) arr[i] += (rand(i) - 0.5) * 1e-7; };
  const seen = new WeakSet();
  wrap(self.AudioBuffer?.prototype, "getChannelData", (orig) => (t, buf, args) => {
    const data = Reflect.apply(orig, buf, args);
    if (!seen.has(data)) { seen.add(data); tweak(data); }
    return data;
  });
  wrap(self.AnalyserNode?.prototype, "getFloatFrequencyData", (orig) => (t, node, args) => {
    const r = Reflect.apply(orig, node, args); tweak(args[0]); return r;
  });

  // --- battery & high-entropy UA hints ---------------------------------------
  if (self.Navigator?.prototype && "getBattery" in Navigator.prototype) {
    wrap(Navigator.prototype, "getBattery", () => () => Promise.reject(new DOMException("Not allowed", "NotAllowedError")));
  }
  wrap(self.NavigatorUAData?.prototype, "getHighEntropyValues", (orig) => (t, ua, args) =>
    Reflect.apply(orig, ua, [[]]).then((low) => low));

  if (LEVEL < 4) return;

  // ===== Paranoid ============================================================
  const NP = self.Navigator?.prototype;
  getter(NP, "hardwareConcurrency", () => 4);
  getter(NP, "deviceMemory", () => 8);
  getter(NP, "languages", (v, nav) => Object.freeze([nav.language]));
  getter(NP, "maxTouchPoints", (v) => (v > 0 ? 5 : 0));
  getter(NP, "connection", () => undefined);

  const SP = self.Screen?.prototype;
  getter(SP, "availWidth", (v, s) => s.width);
  getter(SP, "availHeight", (v, s) => s.height);
  getter(SP, "availLeft", () => 0);
  getter(SP, "availTop", () => 0);
  getter(SP, "colorDepth", () => 24);
  getter(SP, "pixelDepth", () => 24);

  // Coarse timers defeat cache/timing side-channels and some hardware fingerprints.
  wrap(self.Performance?.prototype, "now", (orig) => (t, p, a) => Math.floor(Reflect.apply(orig, p, a)));

  // Media devices: reveal that devices exist, never their IDs or count.
  wrap(self.MediaDevices?.prototype, "enumerateDevices", () => () => Promise.resolve([]));

  // WebRTC can expose your real IP even behind a VPN.
  for (const k of ["RTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel"]) {
    try { delete self[k]; } catch {}
  }

  // Font probing via the FontFace API.
  if (document.fonts && self.FontFaceSet) {
    wrap(FontFaceSet.prototype, "check", (orig) => (t, set, args) =>
      /serif|sans-serif|monospace|system-ui/i.test(String(args[0])) ? Reflect.apply(orig, set, args) : false);
  }
})();
