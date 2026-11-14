# Leave Me Alone

An anti-tracking extension for Chrome, Edge, Brave, Opera, Arc and other Chromium browsers, plus Safari on Mac, iPhone and iPad. One slider takes it from **Mild** to **Paranoid**. Everything runs on your device and nothing phones home.

| Level | What it does |
|---|---|
| **Off** | Nothing. |
| **Mild** | Blocks about 200 major ad and analytics networks. Strips `utm_`, `fbclid`, `gclid` and about 90 other tracking tags from URLs (and from links you copy). Unwraps Google, Facebook, YouTube, Reddit, Outlook and other redirect links. Sends Global Privacy Control and DNT. Turns off Chrome's Topics, FLEDGE and ad-measurement APIs. |
| **Balanced** *(default)* | Also strips third-party cookies in both directions, sends no Referer to third parties, and blocks third-party pings, beacons and `<a ping>`. |
| **Strict** | Also blocks session-replay tools (FullStory, LogRocket, Hotjar and others), fingerprinting vendors, IP-lookup services and social widgets. Randomises the canvas, WebGL, audio and text-metric fingerprints per site per day, so sites can't link you to each other. Hides your GPU model and battery and limits user-agent hints. Stops WebRTC leaking your IP. |
| **Paranoid** | Also blocks all third-party iframes, embeds and websockets. Sends no Referer on any navigation. Kills ETag supercookies. Spoofs CPU cores, RAM, screen, touch points and languages. Coarsens timers. Removes WebRTC and hides media devices and font probing. Wipes a site's cookies and storage when you close its last tab. |

If a site breaks, turn it off for that site with the switch in the popup. That adds the site to the trusted list, which you can manage under **Trusted sites** in the popup or on the extension's options page.

## Install: Chrome, Edge, Brave and other Chromium browsers
1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension/` folder.
4. Pin the extension to the toolbar.

## Install: Safari
1. Open `safari/Leave Me Alone/Leave Me Alone.xcodeproj` in Xcode.
2. Pick the **Leave Me Alone (macOS)** scheme and press Run. For iPhone or iPad, pick the iOS scheme and set your Team under Signing.
3. Safari → Settings → Advanced → turn on **Show features for web developers**. Then Develop → **Allow Unsigned Extensions** (you need to do this again after each Safari restart until the app is signed).
4. Safari → Settings → Extensions → enable **Leave Me Alone** and allow it on all websites.

The Safari project points at the same `extension/` folder, so a change there is picked up on the next Xcode build.

**What differs in Safari:** Safari has no `privacy` or `browsingData` APIs. So it skips the Chrome-only settings (WebRTC IP policy, Topics and similar), and Paranoid's close-tab wipe clears cookies but not localStorage or IndexedDB. Fingerprint defence needs Safari 17 or later. The blocked count in the popup may not show.

## Development
```bash
node tools/build-rules.mjs   # after editing tools/lists.mjs
node tools/make-icons.mjs    # regenerate icons
node tools/test-e2e.mjs      # headless Chrome end-to-end test, all 5 levels
```
The e2e test loads the extension into headless Chrome, sends every hostname to a local server and checks each level: trackers blocked, tags stripped, GPC sent, Referer stripped, iframes blocked, canvas randomised, hardware spoofed, links unwrapped, and trusted sites left alone.

## Limits worth knowing
- The block lists are curated by hand rather than full EasyList or EasyPrivacy. Add domains to `tools/lists.mjs`.
- Fingerprint spoofing covers pages and iframes but not Web Workers.
- No extension can beat a site you log in to. It knows who you are.
