// Haalt per profiel een token op bij de geconfigureerde token service en
// houdt het vers. Het token komt in chrome.storage.session; background.js
// bouwt daarna de header-regels opnieuw op (en de toast toont de header).

import { getProfiles, getTokens, saveTokens, tokenService, activeHeaders } from "./storage.js";

const ALARM = "duo-token-refresh";
const REFRESH_MARGIN_MS = 60_000;        // vernieuwen 1 minuut voor verlopen
const DEFAULT_LIFETIME_MS = 15 * 60_000; // als de response geen verloopdatum geeft
const RETRY_AFTER_MS = 60_000;           // na een fout

const inflight = new Map(); // profileId -> Promise

// Alle schrijfacties op tokens na elkaar, zodat gelijktijdige fetches elkaar niet overschrijven.
let writeChain = Promise.resolve();
function updateTokens(fn) {
  writeChain = writeChain.then(async () => {
    const tokens = await getTokens();
    fn(tokens);
    await saveTokens(tokens);
  }).catch((err) => console.error("Tokens opslaan mislukt:", err));
  return writeChain;
}

// Bepaalt of het token opnieuw opgehaald moet worden als de configuratie wijzigt.
function configKey(profile) {
  const ts = tokenService(profile);
  return JSON.stringify([ts.url, ts.method, ts.body, ts.tokenPath, activeHeaders(profile)]);
}

function getPath(obj, path) {
  return path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);
}

function jwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function requestToken(profile) {
  const ts = tokenService(profile);
  const headers = new Headers();
  for (const h of activeHeaders(profile)) {
    // fetch() negeert zelf "verboden" headers zoals Cookie en Host.
    if (h.operation === "set") headers.set(h.name, h.value);
  }
  const init = { method: ts.method, headers, credentials: "include", cache: "no-store" };
  if (ts.method !== "GET" && ts.body) {
    init.body = ts.body;
    if (!headers.has("Content-Type")) {
      let isJson = true;
      try { JSON.parse(ts.body); } catch { isJson = false; }
      headers.set("Content-Type", isJson ? "application/json" : "application/x-www-form-urlencoded");
    }
  }

  const res = await fetch(ts.url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);

  let json;
  try { json = JSON.parse(text); } catch { /* geen JSON */ }

  let token;
  let expiresIn;
  const path = ts.tokenPath.trim();
  if (path) {
    if (json === undefined) throw new Error("Response is geen JSON, maar er is een token-veld ingesteld");
    token = getPath(json, path);
    // expires_in naast het token-veld (bv. data.access_token -> data.expires_in)
    const parentPath = path.split(".").slice(0, -1).join(".");
    const parent = parentPath ? getPath(json, parentPath) : json;
    expiresIn = parent?.expires_in;
  } else {
    token = typeof json === "string" ? json : text.trim();
  }
  if (typeof token !== "string" || !token) throw new Error(`Geen token gevonden op pad "${path}"`);

  const now = Date.now();
  const expiresAt = typeof expiresIn === "number" ? now + expiresIn * 1000
    : jwtExpiry(token) ?? now + DEFAULT_LIFETIME_MS;
  return { token, expiresAt, fetchedAt: now };
}

export function fetchToken(profile) {
  if (inflight.has(profile.id)) return inflight.get(profile.id);
  const key = configKey(profile);
  const p = (async () => {
    try {
      const result = await requestToken(profile);
      await updateTokens((t) => { t[profile.id] = { ...result, configKey: key, error: null, attemptAt: Date.now() }; });
      return { ok: true };
    } catch (err) {
      // Bestaand (nog geldig) token laten staan als de config niet gewijzigd is.
      await updateTokens((t) => {
        const prev = t[profile.id]?.configKey === key ? t[profile.id] : {};
        t[profile.id] = { ...prev, configKey: key, error: err.message, attemptAt: Date.now() };
      });
      return { ok: false, error: err.message };
    } finally {
      inflight.delete(profile.id);
    }
  })();
  inflight.set(profile.id, p);
  return p;
}

function needsRefresh(profile, state, now) {
  if (!state || state.configKey !== configKey(profile)) return true;
  if (state.error && now - (state.attemptAt ?? 0) < RETRY_AFTER_MS) return false;
  if (!state.token) return true;
  return now > state.expiresAt - REFRESH_MARGIN_MS;
}

export async function refreshDueTokens() {
  const [profiles, tokens] = await Promise.all([getProfiles(), getTokens()]);
  const now = Date.now();
  const wanted = profiles.filter((p) => p.enabled && tokenService(p).enabled && tokenService(p).url.trim());

  // Tokens van verwijderde/uitgeschakelde profielen opruimen.
  const keep = new Set(wanted.map((p) => p.id));
  if (Object.keys(tokens).some((id) => !keep.has(id))) {
    await updateTokens((t) => { for (const id of Object.keys(t)) if (!keep.has(id)) delete t[id]; });
  }

  await Promise.all(wanted.filter((p) => needsRefresh(p, tokens[p.id], now)).map(fetchToken));
}

export function initTokens() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM) refreshDueTokens(); });

  // Debounce: niet bij elke toetsaanslag in de URL al een request doen.
  let timer;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.profiles) return;
    clearTimeout(timer);
    timer = setTimeout(refreshDueTokens, 1000);
  });

  // "Nu ophalen" vanaf de opties-pagina.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Alleen vanaf eigen extensiepagina's, niet vanuit content scripts op websites.
    if (msg?.type !== "duo-refresh-token" || !sender.url?.startsWith(chrome.runtime.getURL(""))) return;
    getProfiles().then((profiles) => {
      const profile = profiles.find((p) => p.id === msg.profileId);
      if (!profile) return sendResponse({ ok: false, error: "Profiel niet gevonden" });
      fetchToken(profile).then(sendResponse);
    });
    return true; // async antwoord
  });

  refreshDueTokens();
}
