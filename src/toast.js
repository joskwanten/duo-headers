// Content script: toont een toast met de toegepaste profielen en hun headers.
// Gebruikt een shadow root zodat de CSS van de pagina er geen invloed op heeft.
(() => {
  const DURATION = 6000;
  const MAX_VALUE = 60;
  let host, hideTimer;

  // DUO-huisstijl: donkerblauw vlak, rechte hoeken, RijksoverheidSans (indien geïnstalleerd).
  const css = `
    .toast { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      max-width: 400px; padding: 12px 16px 14px; border-radius: 0;
      background: #154273; color: #fff; border-top: 5px solid #007bc7;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
      font: 14px/1.45 "RijksoverheidSans", "RijksoverheidSansText", "RO Sans", Helvetica, Arial, sans-serif;
      transition: opacity .2s, transform .2s; }
    .toast.hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }
    .title { font-weight: 700; font-size: 15px; margin-bottom: 6px; padding-right: 24px; }
    .close { position: absolute; top: 8px; right: 8px; border: 0; background: none; padding: 2px;
      color: #cfe3f3; cursor: pointer; line-height: 0; }
    .close svg { width: 16px; height: 16px; }
    .close:hover { color: #fff; }
    .profile + .profile { margin-top: 8px; }
    .name { font-weight: 700; color: #ffb612; }
    ul { margin: 2px 0 0; padding-left: 18px; }
    li { word-break: break-all; }
    code { font: 12.5px ui-monospace, Consolas, monospace; color: #e6f0f8; }
    .removed { color: #ffb4ab; }`;

  function el(tag, props = {}, ...children) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  }

  // Dik kruisje als SVG (los van het font van de pagina).
  function closeButton() {
    const btn = el("button", { className: "close", title: "Sluiten", onclick: hide });
    btn.setAttribute("aria-label", "Sluiten");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M6 6l12 12M18 6L6 18");
    for (const [k, v] of Object.entries({ fill: "none", stroke: "currentColor", "stroke-width": "3.2", "stroke-linecap": "round" })) path.setAttribute(k, v);
    svg.append(path);
    btn.append(svg);
    return btn;
  }

  function truncate(v) {
    return v.length > MAX_VALUE ? v.slice(0, MAX_VALUE) + "…" : v;
  }

  function show(profiles) {
    if (!host) {
      host = el("div");
      host.attachShadow({ mode: "open" }).append(el("style", { textContent: css }));
      document.documentElement.append(host);
    }
    const root = host.shadowRoot;
    root.querySelector(".toast")?.remove();

    const toast = el("div", { className: "toast hidden" },
      closeButton(),
      el("div", { className: "title", textContent: "Duo Headers toegepast" }),
      ...profiles.map((p) =>
        el("div", { className: "profile" },
          el("div", { className: "name", textContent: p.name }),
          el("ul", {}, ...p.headers.map((h) =>
            h.operation === "remove"
              ? el("li", {}, el("code", { textContent: h.name }), el("span", { className: "removed", textContent: " (verwijderd)" }))
              : el("li", { title: `${h.name}: ${h.value}` }, el("code", { textContent: `${h.name}: ${truncate(h.value)}` }))
          ))
        ))
    );
    toast.onmouseenter = () => clearTimeout(hideTimer);
    toast.onmouseleave = () => { hideTimer = setTimeout(hide, DURATION / 2); };
    root.append(toast);
    requestAnimationFrame(() => toast.classList.remove("hidden"));

    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, DURATION);
  }

  function hide() {
    const toast = host?.shadowRoot.querySelector(".toast");
    if (!toast) return;
    toast.classList.add("hidden");
    setTimeout(() => toast.remove(), 250);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "duo-toast") show(msg.profiles);
  });
  chrome.runtime.sendMessage({ type: "duo-ready" }).catch(() => {});
})();
