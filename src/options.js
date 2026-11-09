import { getProfiles, saveProfiles, newProfile } from "./storage.js";

const container = document.getElementById("profiles");
const profileTpl = document.getElementById("profile-tpl");
const headerTpl = document.getElementById("header-tpl");

let profiles = [];
let saveTimer;

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
    if (confirm(`Profiel "${profile.name}" verwijderen?`)) { profiles.splice(index, 1); commit(); }
  };
  el.querySelector(".up").onclick = () => move(index, -1);
  el.querySelector(".down").onclick = () => move(index, 1);
  el.querySelector(".add-header").onclick = () => {
    profile.headers.push({ name: "", value: "", operation: "set" });
    commit();
  };

  profile.headers.forEach((h) => renderHeader(profile, h, headers));
  container.append(el);
}

function move(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= profiles.length) return;
  [profiles[index], profiles[target]] = [profiles[target], profiles[index]];
  commit();
}

function render() {
  container.replaceChildren();
  profiles.forEach(renderProfile);
}

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
  if (area !== "local" || !changes.profiles) return;
  const incoming = changes.profiles.newValue ?? [];
  if (JSON.stringify(incoming) !== JSON.stringify(profiles)) { profiles = incoming; render(); }
});

profiles = await getProfiles();
render();
