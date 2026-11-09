# Publiceren in de Chrome Web Store (Unlisted)

Met *Unlisted* is de extensie alleen te vinden via de directe link. Collega's installeren met één klik
en krijgen updates automatisch (Chrome controleert dat zelf, meestal binnen enkele uren).

## Eenmalig: account

1. Ga naar https://chrome.google.com/webstore/devconsole en log in met een Google-account.
   Gebruik bij voorkeur een team-/groepsaccount (of voeg later collega's toe via een *group publisher*),
   zodat publiceren niet aan één persoon hangt.
2. Betaal de eenmalige registratie ($5) en bevestig je e-mailadres.
3. Vul onder **Account** een contact-e-mailadres in (verplicht om te kunnen publiceren).

## Eerste publicatie

1. Maak een release in GitHub met tag `v1.0.0` (**Releases → Draft a new release**).
   De workflow *Release* hangt automatisch `duo-headers-1.0.0.zip` aan de release.
   Lokaal kan ook: `scripts/package.sh 1.0.0`.
2. In de developer console: **New item** → upload de zip.
3. Vul de tabbladen in met de teksten hieronder en klik op **Submit for review**.

### Tabblad *Store listing*

| Veld | Invullen |
|---|---|
| Beschrijving | zie hieronder |
| Categorie | Developer Tools |
| Taal | Nederlands |
| Store-icoon (128×128) | `src/icons/icon-128.png` |
| Schermafbeeldingen (1280×800) | `docs/store/screenshot-1-profielen.png`, `screenshot-2-toast.png`, `screenshot-3-popup.png` |

**Beschrijving**:

> Duo Headers zet HTTP-request headers op de domeinen die jij kiest, gegroepeerd in profielen.
>
> • Maak profielen met een naam, gekoppelde domeinen (inclusief subdomeinen) en headers (zetten of verwijderen)
> • Zet profielen met één klik aan of uit via de knop in de werkbalk
> • Optioneel per profiel: haal een token op bij een token service en stuur het mee als header; het token wordt automatisch vernieuwd voor het verloopt
> • Een melding op de pagina laat zien welke profielen en headers zijn toegepast
> • Importeer en exporteer profielen als JSON om ze met je team te delen
>
> Alle instellingen blijven lokaal in je browser. De extensie verstuurt geen gegevens naar derden.

### Tabblad *Privacy practices*

**Single purpose**: Request headers toevoegen of verwijderen op door de gebruiker gekozen domeinen, gegroepeerd in profielen.

**Verantwoording per permissie**:

| Permissie | Verantwoording |
|---|---|
| `declarativeNetRequest` | Toevoegen/verwijderen van request headers op de domeinen die de gebruiker aan een profiel koppelt. |
| `webRequest` | Alleen-lezen: vaststellen op welke requests een profiel is toegepast, om de gebruiker daar een melding van te tonen. Requests worden niet geblokkeerd of gewijzigd via deze API. |
| `storage` | Opslaan van de door de gebruiker ingevoerde profielen, en tijdelijk (sessie) van opgehaalde tokens. |
| `alarms` | Tokens van de token service tijdig vernieuwen voordat ze verlopen. |
| Host permissions `<all_urls>` | De gebruiker kiest zelf de domeinen (inclusief interne/test-domeinen en localhost); die zijn vooraf niet bekend. Nodig om headers op die domeinen te zetten en om de token service op een zelf ingestelde URL aan te roepen. |
| Content script op alle sites | Tonen van de melding (toast) op de pagina wanneer een profiel is toegepast. Het script leest geen paginagegevens. |

**Remote code**: Nee, ik gebruik geen remote code.

**Data usage**: vink geen datacategorieën aan, en vink de drie verklaringen aan
(niet verkopen, niet gebruiken voor ongerelateerde doeleinden, niet voor kredietwaardigheid).

**Privacy policy URL**: de tekst van [PRIVACY.md](PRIVACY.md) moet op een publiek bereikbare URL staan.
Omdat deze repo privé is, werkt een GitHub-link niet. Mogelijkheden: een pagina op een publieke (team)site,
een publieke GitHub Gist, of GitHub Pages vanuit een aparte publieke repo.

### Tabblad *Distribution*

- **Visibility**: *Unlisted*
- **Regions**: Nederland (of alle regio's)

De review duurt bij een nieuwe extensie met brede rechten (`<all_urls>`, `webRequest`) meestal enkele dagen.
Na goedkeuring staat de installatielink bovenaan het item in de developer console; deel die met je team.

## Nieuwe versie uitbrengen

1. Maak een GitHub-release met een hogere versie, bv. `v1.1.0` (de store weigert een gelijke of lagere versie).
2. Download de zip uit de release.
3. Developer console → item → **Package** → **Upload new package** → **Submit for review**.

Updates gaan meestal sneller door de review dan de eerste versie. Wijzigen de permissies in het manifest,
dan zet Chrome de extensie bij gebruikers uit tot ze de nieuwe rechten accepteren; vermijd dat waar mogelijk.

## Schermafbeeldingen bijwerken

Na UI-wijzigingen: `node scripts/store-screenshots.js` (vereist Node + Playwright met Chromium).
