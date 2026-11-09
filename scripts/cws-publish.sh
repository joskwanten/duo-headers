#!/usr/bin/env bash
# Uploadt een zip naar de Chrome Web Store en dient hem in voor review/publicatie
# (Chrome Web Store API v2, met een service account).
#
# Vereiste omgevingsvariabelen:
#   CWS_SERVICE_ACCOUNT_JSON  inhoud van het JSON-sleutelbestand van het service account
#   CWS_PUBLISHER_ID          publisher-ID uit de developer console
#   CWS_EXTENSION_ID          ID van het item (de extensie) in de store
#
# Gebruik: scripts/cws-publish.sh dist/duo-headers-1.2.0.zip
#
# Let op: de eerste versie van een item moet handmatig via de developer console worden geüpload;
# de API kan geen nieuw item aanmaken.
set -euo pipefail

zip_file="${1:?Gebruik: $0 <zip>}"
: "${CWS_SERVICE_ACCOUNT_JSON:?ontbreekt}" "${CWS_PUBLISHER_ID:?ontbreekt}" "${CWS_EXTENSION_ID:?ontbreekt}"

api="https://chromewebstore.googleapis.com"
item="publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# --- Access token via JWT van het service account (geen extra tooling nodig) ---
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
python3 -c 'import json,os; print(json.loads(os.environ["CWS_SERVICE_ACCOUNT_JSON"])["private_key"], end="")' > "$workdir/key.pem"
client_email=$(python3 -c 'import json,os; print(json.loads(os.environ["CWS_SERVICE_ACCOUNT_JSON"])["client_email"])')

now=$(date +%s)
header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
claims=$(printf '{"iss":"%s","scope":"https://www.googleapis.com/auth/chromewebstore","aud":"https://oauth2.googleapis.com/token","iat":%d,"exp":%d}' \
  "$client_email" "$now" "$((now + 600))" | b64url)
signature=$(printf '%s.%s' "$header" "$claims" | openssl dgst -sha256 -sign "$workdir/key.pem" | b64url)
assertion="${header}.${claims}.${signature}"

token=$(curl -sS --fail-with-body https://oauth2.googleapis.com/token \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion=${assertion}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
auth=(-H "Authorization: Bearer ${token}")

# --- Upload ---
echo "Uploaden: ${zip_file}"
upload=$(curl -sS --fail-with-body -X POST "${auth[@]}" \
  -H "Content-Type: application/zip" --data-binary "@${zip_file}" \
  "${api}/upload/v2/${item}:upload")
echo "$upload"
if grep -q '"FAILED"' <<<"$upload"; then echo "Upload mislukt" >&2; exit 1; fi

# Verwerking kan even duren: status opvragen tot de upload niet meer bezig is.
for _ in $(seq 1 30); do
  grep -q 'IN_PROGRESS' <<<"$upload" || break
  sleep 5
  upload=$(curl -sS --fail-with-body "${auth[@]}" "${api}/v2/${item}:fetchStatus")
  echo "$upload"
done
if grep -q '"FAILED"' <<<"$upload"; then echo "Upload mislukt" >&2; exit 1; fi

# --- Indienen voor review (na goedkeuring automatisch gepubliceerd) ---
echo "Indienen voor publicatie"
curl -sS --fail-with-body -X POST "${auth[@]}" -H "Content-Type: application/json" -d '{}' \
  "${api}/v2/${item}:publish"
echo
