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

// Domein-invoer normaliseren naar "host" of "host:poort":
//   "*.example.com", "https://example.com/pad" -> "example.com"
//   "localhost:4200", "http://localhost:4200/app" -> "localhost:4200"
// Zonder poort matcht een domein alle poorten; met poort alleen die poort.
// Subdomeinen worden altijd meegenomen.
export function normalizeDomain(input) {
  let d = input.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^\*\./, "");
  d = d.split("/")[0];
  const m = d.match(/^([^:]+)(?::(\d{1,5}))?$/);
  if (!m) return null;
  const [, host, port] = m;
  return port ? `${host}:${Number(port)}` : host;
}

export function parseDomain(entry) {
  const [host, port] = entry.split(":");
  return { host, port: port ?? null };
}

export function profileDomains(profile) {
  return [...new Set(profile.domains.map(normalizeDomain).filter(Boolean))];
}

// Zelfde semantiek als de declarativeNetRequest-regels in background.js.
// `port` is de expliciete poort uit de URL ("" bij de standaardpoort, zoals URL.port).
export function matchesDomain(hostname, port, domains) {
  return domains.some((entry) => {
    const d = parseDomain(entry);
    const hostOk = hostname === d.host || hostname.endsWith("." + d.host);
    return hostOk && (d.port === null || d.port === port);
  });
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
