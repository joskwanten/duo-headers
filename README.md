# Duo Headers

Chrome-extensie (Manifest V3) om request headers te zetten per **profiel**.
Een profiel heeft een naam, een lijst domeinen en een lijst headers, en kan aan/uit gezet worden.

## Installeren (development)

1. Ga naar `chrome://extensions`
2. Zet **Developer mode** aan
3. Klik **Load unpacked** en kies de map `src/`
4. Na code-wijzigingen: klik op het herlaad-icoon bij de extensie

## Gebruik

- **Popup** (klik op het extensie-icoon): profielen snel aan/uit zetten. De badge toont het aantal actieve profielen.
- **Opties-pagina** ("Profielen beheren"): profielen aanmaken, hernoemen, domeinen en headers instellen,
  volgorde wijzigen, in-/uitklappen (status blijft bewaard), en importeren/exporteren als JSON (handig om profielen met het team te delen).

- **Toast**: zodra een profiel op een request wordt toegepast, verschijnt rechtsonder op de pagina een toast
  met de toegepaste profielen en hun headers. Dat geldt ook voor API-calls van de pagina naar een ander domein:
  komt er later een profiel bij, dan wordt de toast bijgewerkt. Lange waarden worden afgekapt (hover toont de
  volledige waarde). De toast verdwijnt na 6 seconden en blijft staan zolang je er met de muis op staat.

Domeinen worden gematcht via `requestDomains`: `example.com` matcht ook alle subdomeinen.
`*.example.com`, `https://` en paden worden automatisch weggestript.
Bij conflicterende headers wint het profiel dat hoger in de lijst staat.

## Hoe het werkt

| Bestand | Rol |
|---|---|
| `src/manifest.json` | MV3-manifest, permissies `declarativeNetRequest`, `webRequest`, `storage` + host access |
| `src/storage.js` | Profielen lezen/schrijven in `chrome.storage.local` |
| `src/background.js` | Service worker: zet bij elke wijziging alle actieve profielen om naar `declarativeNetRequest`-regels (`modifyHeaders`) |
| `src/toasts.js` | Observeert requests (`webRequest`, alleen lezen) en bepaalt per tabblad welke profielen zijn toegepast |
| `src/toast.js` | Content script dat de toast in de pagina toont (in een shadow root, los van de CSS van de pagina) |
| `src/options.*` | Beheerpagina voor profielen |
| `src/popup.*` | Snel aan/uit zetten |

Er wordt gebruikgemaakt van `declarativeNetRequest` (geen `webRequest`): Chrome past de headers zelf toe,
dus de extensie hoeft requests niet te onderscheppen.

## Ideeën voor vervolg

- Response headers (`responseHeaders` in dezelfde regel)
- URL-patronen / regex naast domeinen
- `chrome.storage.sync` of een gedeelde configuratie-URL voor teamprofielen
- Variabelen in header-waarden (bv. `{{token}}`)
- Build-stap (Vite + TypeScript) en publicatie in de Chrome Web Store (eventueel privé voor je organisatie)
