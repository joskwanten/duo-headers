// Service worker: vertaalt profielen naar declarativeNetRequest-regels.
// Bij elke wijziging in storage worden alle dynamische regels opnieuw opgebouwd.

import { getProfiles, getTokens, profileDomains, parseDomain, effectiveHeaders } from "./storage.js";
import { initToasts } from "./toasts.js";
import { initTokens } from "./tokens.js";

const ALL_RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
  "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket",
  "webtransport", "webbundle", "other",
];

function buildRules(profiles, tokens) {
  const rules = [];
  let id = 1;
  profiles.forEach((profile, index) => {
    if (!profile.enabled) return;

    const domains = profileDomains(profile);
    const requestHeaders = effectiveHeaders(profile, tokens).map((h) =>
      h.operation === "remove"
        ? { header: h.name, operation: "remove" }
        : { header: h.name, operation: "set", value: h.value }
    );

    if (domains.length === 0 || requestHeaders.length === 0) return;

    const base = {
      // Profielen bovenaan de lijst winnen bij conflicterende headers.
      priority: profiles.length - index,
      action: { type: "modifyHeaders", requestHeaders },
    };

    // Domeinen zonder poort: één regel met requestDomains (matcht elke poort en subdomeinen).
    const anyPort = domains.filter((d) => !parseDomain(d).port);
    if (anyPort.length) {
      rules.push({ ...base, id: id++, condition: { requestDomains: anyPort, resourceTypes: ALL_RESOURCE_TYPES } });
    }

    // Domeinen met poort: requestDomains kent geen poorten, dus per domein een urlFilter.
    // "||" = begin van (sub)domein; de "/" erachter voorkomt dat :4200 ook :42001 matcht.
    for (const d of domains.filter((d) => parseDomain(d).port)) {
      rules.push({ ...base, id: id++, condition: { urlFilter: `||${d}/`, resourceTypes: ALL_RESOURCE_TYPES } });
    }
  });
  return rules;
}

async function syncRules() {
  const [profiles, tokens] = await Promise.all([getProfiles(), getTokens()]);
  const addRules = buildRules(profiles, tokens);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules,
    });
  } catch (err) {
    console.error("Kon regels niet toepassen:", err, addRules);
  }

  const active = profiles.filter((p) => p.enabled).length;
  await chrome.action.setBadgeText({ text: active ? String(active) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#01689b" });
}

chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "local" && changes.profiles) || (area === "session" && changes.tokens)) syncRules();
});

// Listeners moeten synchroon op top-level geregistreerd worden (MV3).
initToasts();
initTokens();
