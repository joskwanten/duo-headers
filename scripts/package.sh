#!/usr/bin/env bash
# Maakt dist/duo-headers-<versie>.zip van src/ voor upload naar de Chrome Web Store
# (of om als .crx te laten signeren voor verspreiding via beleid).
#
# Gebruik: scripts/package.sh            -> zip met de versie uit src/manifest.json
#          scripts/package.sh 1.2.0      -> zet eerst de versie in het manifest op 1.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -ge 1 ]]; then
  [[ "$1" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]] || { echo "Ongeldige versie: $1 (verwacht bv. 1.2.0)" >&2; exit 1; }
  python3 - "$1" <<'PY'
import json, sys
p = "src/manifest.json"
m = json.load(open(p))
m["version"] = sys.argv[1]
with open(p, "w") as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
fi

version=$(python3 -c 'import json; print(json.load(open("src/manifest.json"))["version"])')
mkdir -p dist
out="dist/duo-headers-${version}.zip"
rm -f "$out"
(cd src && zip -qr "../$out" . -x '.*')
echo "Gemaakt: $out"
