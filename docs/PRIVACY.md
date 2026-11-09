# Privacyverklaring Duo Headers

Duo Headers is een hulpmiddel voor ontwikkelaars en testers om HTTP-request headers te zetten op zelf gekozen domeinen.

## Welke gegevens worden verwerkt

- **Profielen** (namen, domeinen, headers, instellingen van de token service) die de gebruiker zelf invoert.
  Deze worden lokaal in de browser opgeslagen (`chrome.storage.local`) en verlaten het apparaat niet,
  behalve als de gebruiker ze zelf exporteert.
- **Tokens** die van een door de gebruiker ingestelde token service worden opgehaald. Deze staan alleen in het
  geheugen van de browser (`chrome.storage.session`) en verdwijnen bij het sluiten van de browser.
- **Request-URL's**: de extensie kijkt naar de host van requests om te bepalen of een profiel van toepassing is
  (voor de melding op de pagina). Deze informatie wordt niet opgeslagen en niet verstuurd.

## Delen met derden

De extensie verstuurt geen gegevens naar de ontwikkelaar of naar derden. De enige netwerkverzoeken die de extensie
zelf doet, gaan naar de token service-URL die de gebruiker zelf instelt. De ingestelde headers worden alleen
toegevoegd aan requests naar de domeinen die de gebruiker zelf aan een profiel koppelt.

Er worden geen analytics, tracking of advertenties gebruikt.
