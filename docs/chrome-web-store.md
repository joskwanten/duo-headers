# Publiceren in de Chrome Web Store

## Eenmalig

1. Ontwikkelaarsaccount aanmaken op https://chrome.google.com/webstore/devconsole (eenmalig $5).
   Gebruik bij voorkeur een groeps-/teamaccount, zodat publiceren niet aan één persoon hangt.
2. De privacyverklaring ([PRIVACY.md](PRIVACY.md)) ergens publiek bereikbaar zetten (bv. via GitHub Pages
   of de raw-URL in een publieke repo); de store vraagt om een URL.

## Per release

1. `scripts/package.sh 1.2.0` (versie moet hoger zijn dan de vorige upload)
2. In de developer console: item openen → **Package** → nieuwe zip uploaden → **Submit for review**.

## Invullen bij de eerste upload

**Zichtbaarheid**: *Unlisted* (alleen via de link vindbaar) of *Private* (alleen voor een Google Workspace-domein).

**Korte beschrijving**: Zet request headers per profiel op gekoppelde domeinen, inclusief tokens van een token service.

**Categorie**: Developer Tools

**Single purpose**: Request headers toevoegen of verwijderen op door de gebruiker gekozen domeinen, gegroepeerd in profielen.

**Verantwoording per permissie** (wordt gevraagd onder *Privacy practices*):

| Permissie | Verantwoording |
|---|---|
| `declarativeNetRequest` | Toevoegen/verwijderen van request headers op de domeinen die de gebruiker aan een profiel koppelt. |
| `webRequest` | Alleen-lezen: vaststellen op welke requests een profiel is toegepast, om de gebruiker daar een melding van te tonen. Requests worden niet geblokkeerd of gewijzigd via deze API. |
| `storage` | Opslaan van de door de gebruiker ingevoerde profielen, en tijdelijk (sessie) van opgehaalde tokens. |
| `alarms` | Tokens van de token service tijdig vernieuwen voordat ze verlopen. |
| Host permissions `<all_urls>` | De gebruiker kiest zelf de domeinen (inclusief interne/test-domeinen en localhost); die zijn vooraf niet bekend. Nodig om headers op die domeinen te zetten en om de token service op een zelf ingestelde URL aan te roepen. |
| Content script op alle sites | Tonen van de melding (toast) op de pagina wanneer een profiel is toegepast. Het script leest geen paginagegevens. |

**Data usage**: geen van de categorieën wordt verzameld of verstuurd (zie privacyverklaring). Vink de drie verklaringen aan
(niet verkopen, niet gebruiken voor ongerelateerde doeleinden, niet voor kredietwaardigheid).

**Remote code**: Nee.

Let op: door `<all_urls>` en `webRequest` kan de review wat langer duren (enkele dagen) dan bij een extensie met beperkte rechten.
