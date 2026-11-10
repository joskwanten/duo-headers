# Duo Headers

Chrome-extensie (Manifest V3) om request headers te zetten per **profiel**.
Een profiel heeft een naam, een lijst domeinen en een lijst headers, en kan aan/uit gezet worden.

## Installeren (development)

1. Ga naar `chrome://extensions`
2. Zet **Developer mode** aan
3. Klik **Load unpacked** en kies de map `src/`
4. Na code-wijzigingen: klik op het herlaad-icoon bij de extensie

## Release maken

Ga in GitHub naar **Actions → Release → Run workflow** en vul een versie in (bv. `1.0.0`): de pipeline maakt de tag,
de release en de zip. (Zelf een release maken met een tag als `v1.0.0` werkt ook.)
Lokaal kan ook:

```bash
scripts/package.sh 1.0.0   # zet versie in manifest en maakt dist/duo-headers-1.0.0.zip
```

Die zip upload je in de Chrome Web Store, zie [docs/chrome-web-store.md](docs/chrome-web-store.md)
(inclusief de teksten en permissie-verantwoording die de store vraagt) en [docs/PRIVACY.md](docs/PRIVACY.md).
Iconen opnieuw genereren: `python3 scripts/make-icons.py`.

## Gebruik

- **Popup** (klik op het extensie-icoon): profielen snel aan/uit zetten. De badge toont het aantal actieve profielen.
- **Opties-pagina** ("Profielen beheren"): profielen aanmaken, hernoemen, domeinen en headers instellen,
  volgorde wijzigen en in-/uitklappen (status blijft bewaard).
- **Exporteren/importeren** (JSON, handig om profielen met het team te delen):
  - *Exporteren* bij een profiel: alleen dat profiel naar een bestand.
  - *Profiel importeren*: profielen uit een bestand **toevoegen** aan de lijst (bestaat de naam al, dan komt er `(2)` achter).
  - *Alles exporteren* / *Alles importeren (vervangen)*: alle profielen in één bestand; vervangen vraagt eerst om bevestiging.
  - Alle exportbestanden hebben hetzelfde formaat (een lijst met profielen) en werken met beide import-knoppen.

- **Toast**: zodra een profiel op een request wordt toegepast, verschijnt rechtsonder op de pagina een toast
  met de toegepaste profielen en hun headers. Dat geldt ook voor API-calls van de pagina naar een ander domein:
  komt er later een profiel bij, dan wordt de toast bijgewerkt. Lange waarden worden afgekapt (hover toont de
  volledige waarde). De toast verdwijnt na 6 seconden en blijft staan zolang je er met de muis op staat.

### Token service

Per profiel kun je een token service instellen (vinkje **Token service** op de beheerpagina):

| Veld | Betekenis |
|---|---|
| URL + methode | Endpoint van de token service (`GET` of `POST`, bij `POST` met optionele body; JSON krijgt automatisch `Content-Type: application/json`, anders form-encoded) |
| Token-veld | Pad naar het token in de JSON-response, bv. `access_token` of `data.access_token`. Leeg = de hele response (als tekst) is het token. `header:Naam` (of `HEADER.Naam`) = token uit een response-header, bv. `header:Authorization`; een `Bearer `-prefix wordt eraf gehaald |
| Header | Naam en waarde van de header op de doelsite; `{{token}}` wordt vervangen, standaard `Authorization: Bearer {{token}}` |

- De (`set`-)headers van het profiel gaan mee naar de token service, cookies ook (`credentials: include`).
  Headers die de browser niet toestaat in `fetch` (zoals `Cookie` en `Host`) worden daarbij genegeerd.
- Het token wordt opgehaald zodra het profiel aan staat en vernieuwd 1 minuut voordat het verloopt.
  De verloopdatum komt uit `expires_in` (naast het token-veld), anders uit de `exp`-claim van een JWT,
  anders na 15 minuten. Bij een fout wordt het elke minuut opnieuw geprobeerd; de fout staat in de status.
- Tokens worden alleen in het geheugen bewaard (`chrome.storage.session`) en zijn weg na het sluiten van de browser.
- Met **Nu ophalen** haal je direct een nieuw token op.

Domeinen matchen ook alle subdomeinen (`example.com` geldt ook voor `api.example.com`).
Zonder poort geldt een domein voor alle poorten; met poort (`localhost:4200`) alleen voor die poort.
`*.`, `https://` en paden worden automatisch weggestript (`http://localhost:4200/app` wordt `localhost:4200`).
Een standaardpoort (`:80`, `:443`) opgeven werkt niet: browsers laten die weg uit de URL. Gebruik dan het domein zonder poort.
Bij conflicterende headers wint het profiel dat hoger in de lijst staat.

## Huisstijl

De opmaak volgt duo.nl (Rijkshuisstijl): kleuren `#2b2b2b` op `#f3f3f3`, lintblauw `#01689b`, hemelblauw `#007bc7`,
donkerblauw `#154273`, grijze knoppen en groene primaire knop, rechte hoeken. Licht/donker volgt de instelling van het
systeem/Chrome. Het font RijksoverheidSans wordt **niet** meegeleverd (licentie); staat het op de computer geïnstalleerd,
dan wordt het gebruikt. Anders wordt het meegeleverde Source Sans 3 gebruikt (SIL Open Font License,
`src/fonts/`), in iets zwaardere gewichten zodat het qua dikte en breedte op RijksoverheidSans lijkt. Alle kleuren staan als variabelen bovenin `src/styles.css`.

## Hoe het werkt

| Bestand | Rol |
|---|---|
| `src/manifest.json` | MV3-manifest, permissies `declarativeNetRequest`, `webRequest`, `storage`, `alarms` + host access |
| `src/storage.js` | Profielen lezen/schrijven in `chrome.storage.local` |
| `src/background.js` | Service worker: zet bij elke wijziging alle actieve profielen om naar `declarativeNetRequest`-regels (`modifyHeaders`) |
| `src/toasts.js` | Observeert requests (`webRequest`, alleen lezen) en bepaalt per tabblad welke profielen zijn toegepast |
| `src/tokens.js` | Haalt tokens op bij de token service en vernieuwt ze (via `chrome.alarms`) |
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
