import { getProfiles, saveProfiles } from "./storage.js";

const list = document.getElementById("list");
const profiles = await getProfiles();

if (profiles.length === 0) {
  list.innerHTML = '<p class="muted">Nog geen profielen.</p>';
}

for (const profile of profiles) {
  const row = document.createElement("label");
  row.className = "row";
  const cb = Object.assign(document.createElement("input"), { type: "checkbox", checked: profile.enabled });
  const name = document.createElement("span");
  name.textContent = profile.name || "(naamloos)";
  const count = document.createElement("small");
  count.className = "muted";
  count.textContent = `${profile.domains.length} dom.`;
  cb.onchange = async () => { profile.enabled = cb.checked; await saveProfiles(profiles); };
  row.append(cb, name, count);
  list.append(row);
}

document.getElementById("options").onclick = () => chrome.runtime.openOptionsPage();
