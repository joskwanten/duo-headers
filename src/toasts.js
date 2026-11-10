// Detecteert wanneer profielen op requests worden toegepast en laat het
// content script (toast.js) een toast tonen in het betreffende tabblad.
//
// We observeren requests via webRequest (alleen lezen, niet blokkeren) en
// matchen de host met dezelfde logica als de declarativeNetRequest-regels.
// Per tabblad worden de gematchte profielen sinds de laatste paginanavigatie
// bijgehouden; een toast verschijnt bij het laden van de pagina en opnieuw
// zodra er later (bv. via een API-call) een extra profiel bijkomt.

import { getProfiles, getTokens, profileDomains, matchesDomain, effectiveHeaders } from "./storage.js";

let profilesPromise = loadProfiles();
const tabs = new Map(); // tabId -> { matched: Set<profileId>, ready: boolean, shownKey: string }

async function loadProfiles() {
  const [profiles, tokens] = await Promise.all([getProfiles(), getTokens()]);
  return profiles
    .filter((p) => p.enabled)
    .map((p) => ({ ...p, normDomains: profileDomains(p), activeHeaders: effectiveHeaders(p, tokens) }))
    .filter((p) => p.normDomains.length && p.activeHeaders.length);
}

async function onRequest(details) {
  if (details.tabId < 0) return;
  const isMainFrame = details.type === "main_frame";

  let state = tabs.get(details.tabId);
  if (isMainFrame || !state) {
    // Nieuwe pagina: opnieuw tellen. Bij een onbekend tabblad (bv. na het
    // herstarten van de service worker) gaan we ervan uit dat de pagina al geladen is.
    state = { matched: new Set(), ready: !isMainFrame, shownKey: "" };
    tabs.set(details.tabId, state);
  }

  let hostname, port;
  try { ({ hostname, port } = new URL(details.url)); } catch { return; }

  const profiles = await profilesPromise;
  let added = false;
  for (const p of profiles) {
    if (!state.matched.has(p.id) && matchesDomain(hostname, port, p.normDomains)) {
      state.matched.add(p.id);
      added = true;
    }
  }
  if (added) notify(details.tabId);
}

async function notify(tabId) {
  const state = tabs.get(tabId);
  if (!state || !state.ready || state.matched.size === 0) return;

  const profiles = (await profilesPromise).filter((p) => state.matched.has(p.id));
  const key = profiles.map((p) => p.id).sort().join(",");
  if (!profiles.length || key === state.shownKey) return;
  state.shownKey = key;

  const payload = profiles.map((p) => ({
    name: p.name || "(naamloos)",
    headers: p.activeHeaders.map(({ name, value, operation }) => ({ name, value, operation })),
  }));
  chrome.tabs.sendMessage(tabId, { type: "duo-toast", profiles: payload }, { frameId: 0 })
    .catch(() => {}); // geen content script (bv. chrome://-pagina): negeren
}

export function initToasts() {
  chrome.webRequest.onSendHeaders.addListener(onRequest, { urls: ["<all_urls>"] });

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.type !== "duo-ready" || !sender.tab || sender.frameId !== 0) return;
    const state = tabs.get(sender.tab.id);
    if (state) { state.ready = true; notify(sender.tab.id); }
  });

  chrome.tabs.onRemoved.addListener((tabId) => tabs.delete(tabId));

  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === "local" && changes.profiles) || (area === "session" && changes.tokens)) {
      profilesPromise = loadProfiles();
    }
  });
}
