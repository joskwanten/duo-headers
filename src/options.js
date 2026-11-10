import { getProfiles, saveProfiles, newProfile, getTokens, defaultTokenService } from "./storage.js";

const container = document.getElementById("profiles");
const profileTpl = document.getElementById("profile-tpl");
const headerTpl = document.getElementById("header-tpl");

let profiles = [];
let saveTimer;

// Inklap-status is puur weergave: apart bewaard (niet in de profielen),
// zodat in-/uitklappen geen nieuwe header-regels laat opbouwen.
const COLLAPSED_KEY = "collapsedProfiles";
let collapsed = new Set();

function saveCollapsed() {
  chrome.storage.local.set({ [COLLAPSED_KEY]: [...collapsed] });
}

// Token-status per profiel (uit chrome.storage.session), live bijgewerkt.
let tokens = {};
const statusUpdaters = new Map(); // profileId -> () => void

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function tokenStatus(profile) {
  const ts = profile.tokenService;
  if (!ts.url.trim()) return { text: "Vul een URL in.", cls: "" };
  if (!profile.enabled) return { text: "Profiel staat uit; token wordt niet opgehaald.", cls: "" };
  const t = tokens[profile.id];
  if (!t) return { text: "Nog geen token opgehaald…", cls: "" };
  if (t.error) {
    const still = t.token && t.expiresAt > Date.now() ? ` (vorig token geldig tot ${formatTime(t.expiresAt)})` : "";
    return { text: `Fout om ${formatTime(t.attemptAt)}: ${t.error}${still}`, cls: "error" };
  }
  const preview = t.token.length > 16 ? t.token.slice(0, 16) + "…" : t.token;
  return { text: `Token ${preview} opgehaald om ${formatTime(t.fetchedAt)}, geldig tot ${formatTime(t.expiresAt)}`, cls: "ok" };
}

function summarize(profile) {
  const d = profile.domains.length;
  const h = profile.headers.filter((x) => x.name.trim()).length;
  const domains = d ? profile.domains.slice(0, 3).join(", ") + (d > 3 ? ` +${d - 3}` : "") : "geen domeinen";
  const token = profile.tokenService?.enabled ? " · token service" : "";
  return `${domains} · ${h} header${h === 1 ? "" : "s"}${token}`;
}

// Vergelijking los van sleutelvolgorde: chrome.storage geeft objecten
// terug met gesorteerde sleutels, dus JSON.stringify is niet betrouwbaar.
function canonical(value) {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v
  );
}

// Laatst door deze pagina opgeslagen versie: meldingen daarvan negeren we,
// anders wordt de pagina na elke opslag opnieuw opgebouwd (en ben je je focus kwijt).
let lastSaved = "";

function save() {
  clearTimeout(saveTimer);
  lastSaved = canonical(profiles);
  return saveProfiles(profiles);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function commit() {
  save();
  render();
}

function renderHeader(profile, header, list) {
  const row = headerTpl.content.firstElementChild.cloneNode(true);
  const op = row.querySelector(".h-op");
  const name = row.querySelector(".h-name");
  const value = row.querySelector(".h-value");

  op.value = header.operation;
  name.value = header.name;
  value.value = header.value;
  value.disabled = header.operation === "remove";

  op.onchange = () => { header.operation = op.value; value.disabled = op.value === "remove"; scheduleSave(); };
  name.oninput = () => { header.name = name.value; scheduleSave(); };
  value.oninput = () => { header.value = value.value; scheduleSave(); };
  row.querySelector(".h-delete").onclick = () => {
    profile.headers.splice(profile.headers.indexOf(header), 1);
    commit();
  };
  list.append(row);
}

function renderProfile(profile, index) {
  const el = profileTpl.content.firstElementChild.cloneNode(true);
  el.dataset.id = profile.id;
  const enabled = el.querySelector(".enabled");
  const name = el.querySelector(".name");
  const domains = el.querySelector(".domains");
  const headers = el.querySelector(".headers");

  const toggle = el.querySelector(".toggle");
  const summary = el.querySelector(".summary");
  const applyCollapsed = () => {
    const isCollapsed = collapsed.has(profile.id);
    el.classList.toggle("collapsed", isCollapsed);
    toggle.setAttribute("aria-expanded", String(!isCollapsed)); // pijltje draait via CSS
    summary.textContent = summarize(profile);
  };
  applyCollapsed();
  toggle.onclick = () => {
    collapsed.has(profile.id) ? collapsed.delete(profile.id) : collapsed.add(profile.id);
    saveCollapsed();
    applyCollapsed();
  };

  enabled.checked = profile.enabled;
  name.value = profile.name;
  domains.value = profile.domains.join("\n");

  el.classList.toggle("is-enabled", profile.enabled);
  enabled.onchange = () => { profile.enabled = enabled.checked; el.classList.toggle("is-enabled", enabled.checked); scheduleSave(); };
  name.oninput = () => { profile.name = name.value; scheduleSave(); };
  domains.oninput = () => {
    profile.domains = domains.value.split("\n").map((d) => d.trim()).filter(Boolean);
    scheduleSave();
  };

  el.querySelector(".export").onclick = () => exportProfile(profile);
  el.querySelector(".delete").onclick = () => {
    if (confirm(`Profiel "${profile.name}" verwijderen?`)) { collapsed.delete(profile.id); saveCollapsed(); profiles.splice(index, 1); commit(); }
  };
  el.querySelector(".up").onclick = () => move(index, -1);
  el.querySelector(".down").onclick = () => move(index, 1);
  el.querySelector(".add-header").onclick = () => {
    profile.headers.push({ name: "", value: "", operation: "set" });
    commit();
  };

  profile.headers.forEach((h) => renderHeader(profile, h, headers));
  renderTokenService(profile, el);
  container.append(el);
}

function renderTokenService(profile, el) {
  profile.tokenService = { ...defaultTokenService(), ...profile.tokenService };
  const ts = profile.tokenService;
  const $ = (sel) => el.querySelector(sel);
  const enabled = $(".ts-enabled"), method = $(".ts-method"), url = $(".ts-url"), body = $(".ts-body"),
    path = $(".ts-path"), header = $(".ts-header"), template = $(".ts-template"), status = $(".ts-status");

  enabled.checked = ts.enabled;
  method.value = ts.method;
  url.value = ts.url;
  body.value = ts.body;
  path.value = ts.tokenPath;
  header.value = ts.headerName;
  template.value = ts.valueTemplate;

  const updateVisibility = () => {
    el.classList.toggle("ts-on", ts.enabled);
    const showBody = ts.method !== "GET";
    body.hidden = $(".ts-body-label").hidden = !showBody;
  };
  const updateStatus = () => {
    const { text, cls } = tokenStatus(profile);
    status.textContent = text;
    status.className = `ts-status muted ${cls}`;
  };
  updateVisibility();
  updateStatus();
  statusUpdaters.set(profile.id, updateStatus);

  const bind = (input, key, event = "oninput") => {
    input[event] = () => {
      ts[key] = input.type === "checkbox" ? input.checked : input.value;
      updateVisibility();
      updateStatus();
      scheduleSave();
    };
  };
  bind(enabled, "enabled", "onchange");
  bind(method, "method", "onchange");
  bind(url, "url");
  bind(body, "body");
  bind(path, "tokenPath");
  bind(header, "headerName");
  bind(template, "valueTemplate");

  $(".ts-refresh").onclick = async () => {
    const btn = $(".ts-refresh");
    await save(); // zeker weten dat de laatste wijzigingen er zijn
    btn.disabled = true;
    btn.textContent = "Bezig…";
    await chrome.runtime.sendMessage({ type: "duo-refresh-token", profileId: profile.id });
    btn.disabled = false;
    btn.textContent = "Nu ophalen";
  };
}

function move(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= profiles.length) return;
  [profiles[index], profiles[target]] = [profiles[target], profiles[index]];
  commit();
}

// Onthoudt welk veld focus had (profiel-id + klasse + volgnummer) en de cursorpositie,
// zodat een herbouw van de lijst het typen niet onderbreekt.
function captureFocus() {
  const el = document.activeElement;
  const section = el?.closest?.(".profile");
  if (!section || !el.classList.length) return null;
  const cls = el.classList[0];
  return {
    profileId: section.dataset.id,
    cls,
    index: [...section.querySelectorAll(`.${cls}`)].indexOf(el),
    start: el.selectionStart,
    end: el.selectionEnd,
  };
}

function restoreFocus(f) {
  if (!f) return;
  const section = container.querySelector(`.profile[data-id="${CSS.escape(f.profileId)}"]`);
  const el = section?.querySelectorAll(`.${f.cls}`)[f.index];
  if (!el) return;
  el.focus();
  if (typeof f.start === "number" && "setSelectionRange" in el) {
    try { el.setSelectionRange(f.start, f.end); } catch { /* bv. checkbox */ }
  }
}

function render() {
  const focus = captureFocus();
  container.replaceChildren();
  statusUpdaters.clear();
  profiles.forEach(renderProfile);
  restoreFocus(focus);
}

document.getElementById("collapse-all").onclick = () => {
  collapsed = new Set(profiles.map((p) => p.id)); saveCollapsed(); render();
};
document.getElementById("expand-all").onclick = () => {
  collapsed.clear(); saveCollapsed(); render();
};

document.getElementById("add").onclick = () => { profiles.push(newProfile()); commit(); };

// --- Exporteren / importeren ---------------------------------------------
// Bestandsformaat: altijd een JSON-lijst met profielen (ook bij één profiel),
// zodat elk exportbestand op beide manieren geïmporteerd kan worden.

function slug(text) {
  return (text || "profiel").toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "profiel";
}

function download(list, filename) {
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportProfile(profile) {
  const { id, ...rest } = profile; // id is lokaal; bij import krijgt het profiel een nieuwe
  download([rest], `duo-headers-${slug(profile.name)}.json`);
  notify(`Profiel "${profile.name || "(naamloos)"}" geëxporteerd.`);
}

// Maakt van onbekende invoer een geldig profiel (met nieuw id).
function sanitizeProfile(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Ongeldig profiel in bestand");
  const str = (v) => (typeof v === "string" ? v : "");
  const base = newProfile();
  return {
    ...base,
    name: str(p.name) || base.name,
    enabled: p.enabled === true,
    domains: Array.isArray(p.domains) ? p.domains.filter((d) => typeof d === "string") : [],
    headers: Array.isArray(p.headers)
      ? p.headers.filter((h) => h && typeof h === "object").map((h) => ({
          name: str(h.name), value: str(h.value), operation: h.operation === "remove" ? "remove" : "set",
        }))
      : [],
    tokenService: { ...defaultTokenService(), ...(p.tokenService && typeof p.tokenService === "object" ? p.tokenService : {}) },
  };
}

async function readProfilesFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error("Bestand is geen geldige JSON"); }
  const list = Array.isArray(data) ? data : [data]; // los profielobject ook toestaan
  if (list.length === 0) throw new Error("Geen profielen in bestand");
  return list.map(sanitizeProfile);
}

function uniqueName(name) {
  const names = new Set(profiles.map((p) => p.name));
  if (!names.has(name)) return name;
  let i = 2;
  while (names.has(`${name} (${i})`)) i++;
  return `${name} (${i})`;
}

let noticeTimer;
function notify(text, isError = false) {
  const n = document.getElementById("notice");
  n.textContent = text;
  n.className = `notice ${isError ? "notice--error" : ""}`;
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { n.hidden = true; }, 5000);
}

// Eén bestandskiezer voor beide import-varianten.
const importFile = document.getElementById("import-file");
let importMode = "add";
function pickImport(mode) { importMode = mode; importFile.click(); }

importFile.onchange = async () => {
  const file = importFile.files[0];
  importFile.value = "";
  if (!file) return;
  try {
    const imported = await readProfilesFile(file);
    if (importMode === "replace") {
      if (!confirm(`Alle ${profiles.length} huidige profielen vervangen door ${imported.length} profiel(en) uit "${file.name}"?`)) return;
      profiles = imported;
      commit();
      notify(`${imported.length} profiel(en) geïmporteerd; bestaande profielen vervangen.`);
    } else {
      for (const p of imported) { p.name = uniqueName(p.name); profiles.push(p); }
      commit();
      container.querySelector(`.profile[data-id="${CSS.escape(imported[0].id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      notify(imported.length === 1 ? `Profiel "${imported[0].name}" toegevoegd.` : `${imported.length} profielen toegevoegd.`);
    }
  } catch (err) {
    notify(`Import mislukt: ${err.message}`, true);
  }
};

document.getElementById("import-add").onclick = () => pickImport("add");
document.getElementById("import-replace").onclick = () => pickImport("replace");
document.getElementById("export-all").onclick = () => {
  download(profiles.map(({ id, ...rest }) => rest), "duo-headers-profielen.json");
  notify(`${profiles.length} profiel(en) geëxporteerd.`);
};

// Wijzigingen vanuit de popup direct tonen (bv. profiel aan/uit).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.tokens) {
    tokens = changes.tokens.newValue ?? {};
    statusUpdaters.forEach((update) => update());
    return;
  }
  if (area !== "local" || !changes.profiles) return;
  const incoming = changes.profiles.newValue ?? [];
  const key = canonical(incoming);
  if (key === lastSaved) return; // onze eigen opslag
  // Echte wijziging van buitenaf (popup, ander tabblad): overnemen. Focus en cursor blijven behouden.
  clearTimeout(saveTimer);
  lastSaved = key;
  profiles = incoming;
  render();
});

profiles = await getProfiles();
lastSaved = canonical(profiles);
tokens = await getTokens();
collapsed = new Set((await chrome.storage.local.get(COLLAPSED_KEY))[COLLAPSED_KEY] ?? []);
render();
