// Gedeelde helpers voor het lezen/schrijven van profielen.
//
// Profiel-structuur:
// {
//   id: string,
//   name: string,
//   enabled: boolean,
//   domains: string[],            // bv. ["example.com", "api.test.local"]
//   headers: { name: string, value: string, operation: "set" | "remove" }[],
//   tokenService: {                // optioneel, zie defaultTokenService()
//     enabled, url, method, body, tokenPath, headerName, valueTemplate
//   }
// }

const KEY = "profiles";

export async function getProfiles() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] ?? [];
}

export async function saveProfiles(profiles) {
  await chrome.storage.local.set({ [KEY]: profiles });
}

export function newProfile(name = "Nieuw profiel") {
  return {
    id: crypto.randomUUID(),
    name,
    enabled: false,
    domains: [],
    headers: [{ name: "", value: "", operation: "set" }],
    tokenService: defaultTokenService(),
  };
}

export function defaultTokenService() {
  return {
    enabled: false,
    url: "",
    method: "GET",
    body: "",
    tokenPath: "access_token",       // pad in de JSON-response; leeg = hele response als tekst
    headerName: "Authorization",
    valueTemplate: "Bearer {{token}}",
  };
}

export function tokenService(profile) {
  return { ...defaultTokenService(), ...profile.tokenService };
}

// Opgehaalde tokens staan in chrome.storage.session: alleen in het geheugen,
// niet op schijf, en weg na het afsluiten van de browser.
// Structuur: { [profileId]: { token, configKey, fetchedAt, expiresAt, error, attemptAt } }
const TOKENS_KEY = "tokens";

export async function getTokens() {
  const data = await chrome.storage.session.get(TOKENS_KEY);
  return data[TOKENS_KEY] ?? {};
}

export async function saveTokens(tokens) {
  await chrome.storage.session.set({ [TOKENS_KEY]: tokens });
}

// "*.example.com" en "https://example.com/pad" -> "example.com".
// requestDomains (en matchesDomain hieronder) matchen subdomeinen automatisch.
export function normalizeDomain(input) {
  let d = input.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^\*\./, "");
  d = d.split("/")[0].split(":")[0];
  return d || null;
}

export function profileDomains(profile) {
  return [...new Set(profile.domains.map(normalizeDomain).filter(Boolean))];
}

// Zelfde semantiek als declarativeNetRequest requestDomains.
export function matchesDomain(hostname, domains) {
  return domains.some((d) => hostname === d || hostname.endsWith("." + d));
}

export function activeHeaders(profile) {
  return profile.headers
    .filter((h) => h.name.trim())
    .map((h) => ({ ...h, name: h.name.trim() }));
}

// Statische headers plus (indien beschikbaar) de token-header.
// De token-header overschrijft een statische header met dezelfde naam.
export function effectiveHeaders(profile, tokens = {}) {
  const headers = activeHeaders(profile);
  const ts = tokenService(profile);
  const token = tokens[profile.id]?.token;
  if (!ts.enabled || !token || !ts.headerName.trim()) return headers;
  const name = ts.headerName.trim();
  return [
    ...headers.filter((h) => h.name.toLowerCase() !== name.toLowerCase()),
    { name, value: ts.valueTemplate.replaceAll("{{token}}", token), operation: "set" },
  ];
}
