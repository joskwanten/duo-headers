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

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveProfiles(profiles), 300);
}

function commit() {
  saveProfiles(profiles);
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
  const enabled = el.querySelector(".enabled");
  const name = el.querySelector(".name");
  const domains = el.querySelector(".domains");
  const headers = el.querySelector(".headers");

  const toggle = el.querySelector(".toggle");
  const summary = el.querySelector(".summary");
  const applyCollapsed = () => {
    const isCollapsed = collapsed.has(profile.id);
    el.classList.toggle("collapsed", isCollapsed);
    toggle.textContent = isCollapsed ? "▸" : "▾";
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

  enabled.onchange = () => { profile.enabled = enabled.checked; scheduleSave(); };
  name.oninput = () => { profile.name = name.value; scheduleSave(); };
  domains.oninput = () => {
    profile.domains = domains.value.split("\n").map((d) => d.trim()).filter(Boolean);
    scheduleSave();
  };

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
    clearTimeout(saveTimer);
    await saveProfiles(profiles); // zeker weten dat de laatste wijzigingen er zijn
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

function render() {
  container.replaceChildren();
  statusUpdaters.clear();
  profiles.forEach(renderProfile);
}

document.getElementById("collapse-all").onclick = () => {
  collapsed = new Set(profiles.map((p) => p.id)); saveCollapsed(); render();
};
document.getElementById("expand-all").onclick = () => {
  collapsed.clear(); saveCollapsed(); render();
};

document.getElementById("add").onclick = () => { profiles.push(newProfile()); commit(); };

document.getElementById("export").onclick = () => {
  const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: "duo-headers-profielen.json",
  });
  a.click();
  URL.revokeObjectURL(a.href);
};

const importFile = document.getElementById("import-file");
document.getElementById("import").onclick = () => importFile.click();
importFile.onchange = async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Verwacht een lijst met profielen");
    profiles = imported.map((p) => ({ ...newProfile(), ...p, id: crypto.randomUUID() }));
    commit();
  } catch (err) {
    alert(`Import mislukt: ${err.message}`);
  }
  importFile.value = "";
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
  if (JSON.stringify(incoming) !== JSON.stringify(profiles)) { profiles = incoming; render(); }
});

profiles = await getProfiles();
tokens = await getTokens();
collapsed = new Set((await chrome.storage.local.get(COLLAPSED_KEY))[COLLAPSED_KEY] ?? []);
render();
