// Shared by the background worker, popup and options page.
var LMA_LEVELS = [
  {
    name: "Off",
    blurb: "Nothing is blocked. You're on your own.",
    features: [],
    rulesets: [],
  },
  {
    name: "Mild",
    blurb: "Blocks the big ad and analytics networks. Almost nothing breaks.",
    features: [
      "Blocks ~200 major ad & analytics networks",
      "Strips tracking tags from links (utm_, fbclid, gclid…)",
      "Unwraps Google / Facebook / YouTube redirect links",
      "Sends Global Privacy Control + Do Not Track",
    ],
    rulesets: ["trackers", "params", "signals"],
  },
  {
    name: "Balanced",
    blurb: "Third parties can't use cookies on you. Recommended.",
    features: [
      "Everything in Mild",
      "Third-party cookies stripped both ways",
      "No Referer sent to third parties",
      "Blocks tracking pings & beacons to third parties",
    ],
    rulesets: ["trackers", "params", "signals", "balanced"],
  },
  {
    name: "Strict",
    blurb: "Fights fingerprinting and session recording. Occasional breakage.",
    features: [
      "Everything in Balanced",
      "Blocks session-replay, fingerprinting & social widgets",
      "Canvas, WebGL & audio fingerprints randomised per site",
      "Hides your GPU and battery; WebRTC can't leak your IP",
    ],
    rulesets: ["trackers", "params", "signals", "balanced", "strict"],
  },
  {
    name: "Paranoid",
    blurb: "Totally over the top. Things will break — trust sites as needed.",
    features: [
      "Everything in Strict",
      "No third-party iframes, embeds or websockets",
      "No Referer on any navigation; ETag supercookies killed",
      "Hardware, screen & timer precision spoofed; WebRTC off",
      "Site cookies & storage wiped when you close its last tab",
    ],
    rulesets: ["trackers", "params", "signals", "balanced", "strict", "paranoid"],
  },
];
var LMA_ALL_RULESETS = ["trackers", "params", "signals", "balanced", "strict", "paranoid"];
var LMA_DEFAULT_LEVEL = 2;

// Reduce a hostname to its "site" (good-enough eTLD+1 without shipping the PSL).
function lmaSite(host) {
  host = (host || "").toLowerCase().replace(/^www\./, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
  const p = host.split(".");
  if (p.length <= 2) return host;
  const sl = p[p.length - 2];
  const twoPart = /^(co|com|net|org|gov|ac|edu|ltd|plc|me|ne|or|go)$/.test(sl) && p[p.length - 1].length === 2;
  return p.slice(twoPart ? -3 : -2).join(".");
}
