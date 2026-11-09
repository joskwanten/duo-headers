// Gedeelde helpers voor het lezen/schrijven van profielen.
//
// Profiel-structuur:
// {
//   id: string,
//   name: string,
//   enabled: boolean,
//   domains: string[],            // bv. ["example.com", "api.test.local"]
//   headers: { name: string, value: string, operation: "set" | "remove" }[]
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
  };
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
