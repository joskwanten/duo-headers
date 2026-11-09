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
