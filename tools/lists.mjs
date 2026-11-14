// Curated block lists. Edit these, then run `node tools/build-rules.mjs`.
// Each domain matches itself and all subdomains.

// Level 1+ (Mild): the big ad networks and analytics beacons.
export const TRACKERS = [
  // Google ads / analytics
  "doubleclick.net", "googleadservices.com", "googlesyndication.com", "google-analytics.com",
  "googletagmanager.com", "googletagservices.com", "adservice.google.com", "pagead2.googlesyndication.com",
  "2mdn.net", "app-measurement.com", "firebase-settings.crashlytics.com",
  // Meta
  "connect.facebook.net", "pixel.facebook.com", "an.facebook.com", "graph.instagram.com",
  // Microsoft / LinkedIn / X / TikTok / Snap / Pinterest / Reddit
  "bat.bing.com", "clarity.ms", "ads.linkedin.com", "px.ads.linkedin.com", "snap.licdn.com",
  "analytics.twitter.com", "ads-twitter.com", "static.ads-twitter.com", "ads-api.twitter.com",
  "analytics.tiktok.com", "ads.tiktok.com", "business-api.tiktok.com", "tr.snapchat.com", "sc-static.net",
  "ct.pinterest.com", "trk.pinterest.com", "events.redditmedia.com", "alb.reddit.com", "pixel.reddit.com",
  // Amazon / Yahoo / Yandex / Baidu / Criteo
  "amazon-adsystem.com", "aax.amazon-adsystem.com", "analytics.yahoo.com", "ads.yahoo.com",
  "advertising.com", "mc.yandex.ru", "mc.yandex.com", "an.yandex.ru", "hm.baidu.com", "criteo.com", "criteo.net",
  // Ad exchanges / SSPs / DSPs
  "adnxs.com", "adsrvr.org", "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com",
  "indexww.com", "smartadserver.com", "taboola.com", "outbrain.com", "revcontent.com", "mgid.com",
  "sharethrough.com", "triplelift.com", "3lift.com", "media.net", "contextweb.com", "yieldmo.com",
  "sovrn.com", "lijit.com", "33across.com", "gumgum.com", "teads.tv", "spotxchange.com", "spotx.tv",
  "springserve.com", "adform.net", "adition.com", "zemanta.com", "bidswitch.net", "mathtag.com",
  "turn.com", "rlcdn.com", "liadm.com", "bluekai.com", "exelator.com", "demdex.net", "everesttech.net",
  "agkn.com", "tapad.com", "crwdcntrl.net", "krxd.net", "adsafeprotected.com", "doubleverify.com",
  "moatads.com", "serving-sys.com", "flashtalking.com", "innovid.com", "eyeota.net", "lotame.com",
  "quantserve.com", "quantcount.com", "scorecardresearch.com", "imrworldwide.com", "chartbeat.com",
  "chartbeat.net", "parsely.com", "comscore.com", "adroll.com", "steelhousemedia.com", "perfectaudience.com",
  "zedo.com", "popads.net", "propellerads.com", "exoclick.com", "juicyads.com", "trafficjunky.net",
  "adcolony.com", "unityads.unity3d.com", "applovin.com", "inmobi.com", "vungle.com", "chartboost.com",
  "ib-ibi.com", "id5-sync.com", "uidapi.com", "prebid.org", "intentiq.com", "permutive.com", "permutive.app",
  // Analytics / product analytics / marketing automation
  "hotjar.com", "hotjar.io", "mixpanel.com", "segment.io", "segment.com", "cdn.segment.com",
  "amplitude.com", "heapanalytics.com", "kissmetrics.com", "matomo.cloud", "statcounter.com",
  "newrelic.com", "nr-data.net", "omtrdc.net", "2o7.net", "hs-analytics.net", "hs-banner.com",
  "hubspot.com/__ptq.gif", "hsadspixel.net", "marketo.net", "mktoresp.com", "pardot.com",
  "branch.io", "app.link", "adjust.com", "appsflyer.com", "kochava.com", "singular.net",
  "braze.com", "onesignal.com", "pushwoosh.com", "optimizely.com", "vwo.com", "visualwebsiteoptimizer.com",
  "crazyegg.com", "mouseflow.com", "luckyorange.com", "luckyorange.net", "inspectlet.com",
  "pingdom.net", "yandex.ru/clck", "bounceexchange.com", "bouncex.net", "wunderkind.co",
  "tealiumiq.com", "tiqcdn.com", "ensighten.com", "zdassets.com/ekr", "trustpilot.com/tracking",
];

// Level 3+ (Strict): fingerprinting vendors, session-replay, social widgets, data brokers.
export const STRICT_EXTRA = [
  "fullstory.com", "logrocket.io", "lr-ingest.io", "lr-in.com", "smartlook.com", "smartlook.cloud",
  "quantummetric.com", "contentsquare.net", "clicktale.net", "decibelinsight.net", "glassboxdigital.io",
  "sessioncam.com", "uxcam.com", "sentry-cdn.com/replay", "posthog.com", "i.posthog.com",
  "fingerprint.com", "fpjs.io", "fpcdn.io", "openfpcdn.io", "iovation.com", "threatmetrix.com",
  "online-metrix.net", "deviceatlas.com", "51degrees.com", "maxmind.com", "ipinfo.io", "ipapi.co",
  "ip-api.com", "geoip-db.com", "ipify.org",
  "platform.twitter.com", "syndication.twitter.com", "platform.linkedin.com", "assets.pinterest.com",
  "widgets.pinterest.com", "addthis.com", "addtoany.com", "sharethis.com", "shareaholic.com",
  "disqus.com/count", "disquscdn.com/count", "gravatar.com/avatar",
  "acxiom.com", "liveramp.com", "oracleinfinity.io", "zeotap.com", "the-trade-desk.com",
  "nielsen.com", "yieldify.com", "drift.com/track", "intercom-metrics.com", "intercomcdn.com/track",
  "fls.doubleclick.net", "stats.g.doubleclick.net", "cm.g.doubleclick.net",
  "ad.doubleclick.net", "securepubads.g.doubleclick.net",
];

// Tracking parameters stripped from URLs (all levels).
export const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_name",
  "utm_cid", "utm_reader", "utm_referrer", "utm_social", "utm_social-type", "utm_brand",
  "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "gad_source", "srsltid",
  "fbclid", "fb_action_ids", "fb_action_types", "fb_ref", "fb_source", "igshid", "igsh",
  "msclkid", "mc_cid", "mc_eid", "mkt_tok", "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsCtaTracking",
  "yclid", "ymclid", "_openstat", "twclid", "ttclid", "li_fat_id", "epik", "sc_cid", "rdt_cid",
  "oly_anon_id", "oly_enc_id", "vero_id", "vero_conv", "wickedid", "s_cid", "s_kwcid",
  "ref_src", "ref_url", "spm", "scm", "_ga", "_gl", "_ke", "trk", "trkCampaign", "trackingId",
  "cmpid", "ncid", "ocid", "guccounter", "guce_referrer", "guce_referrer_sig", "si", "share_id",
  "irclickid", "irgwc", "zanpid", "awc", "cjevent", "pk_campaign", "pk_kwd", "pk_source", "pk_medium",
  "mtm_campaign", "mtm_source", "mtm_medium", "piwik_campaign", "piwik_kwd", "rb_clickid",
  "__s", "ss_source", "ss_campaign_id", "ml_subscriber", "ml_subscriber_hash", "obOrigUrl", "dicbo",
];
