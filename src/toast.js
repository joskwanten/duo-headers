// Content script: toont een toast met de toegepaste profielen en hun headers.
// Gebruikt een shadow root zodat de CSS van de pagina er geen invloed op heeft.
(() => {
  const DURATION = 6000;
  const MAX_VALUE = 60;
  let host, hideTimer;

  const css = `
    .toast { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      max-width: 380px; padding: 12px 14px; border-radius: 10px;
      background: #1e293b; color: #f1f5f9; box-shadow: 0 8px 24px #0006;
      font: 13px/1.4 system-ui, sans-serif; transition: opacity .2s, transform .2s; }
    .toast.hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }
    .title { font-weight: 600; color: #93c5fd; margin-bottom: 6px; padding-right: 20px; }
    .close { position: absolute; top: 6px; right: 8px; border: 0; background: none;
      color: #94a3b8; font-size: 16px; cursor: pointer; }
    .profile + .profile { margin-top: 8px; }
    .name { font-weight: 600; }
    ul { margin: 2px 0 0; padding-left: 16px; }
    li { word-break: break-all; }
    code { font: 12px ui-monospace, monospace; color: #e2e8f0; }
    .removed { color: #fca5a5; }`;

  function el(tag, props = {}, ...children) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
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
      el("button", { className: "close", textContent: "×", title: "Sluiten", onclick: hide }),
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
