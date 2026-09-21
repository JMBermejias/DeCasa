#!/usr/bin/env bash
# Build del APK de DeCasa sin Android Studio (aapt2 + javac + d8 + zipalign + apksigner)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_DIR="$ROOT/build/android"
APP_DIR="$ANDROID_DIR/app"
OUT_DIR="$ANDROID_DIR/out"

ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android}"
JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk}"
BT="$ANDROID_HOME/build-tools/34.0.0"
PLATFORM="$ANDROID_HOME/platforms/android-34/android.jar"
PATH="$JAVA_HOME/bin:$PATH"

VERSION_NAME="1.2.0"
NODE_BIN="$(command -v node || echo "$HOME/.local/bin/node")"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/gen" "$OUT_DIR/obj" "$OUT_DIR/dex" "$OUT_DIR/compiled"

echo "==> Generando iconos..."
"$NODE_BIN" "$ANDROID_DIR/scripts/make-icon.mjs" "$APP_DIR/res"

echo "==> Compilando recursos (aapt2)..."
while IFS= read -r -d '' f; do
  "$BT/aapt2" compile -o "$OUT_DIR/compiled" "$f"
done < <(find "$APP_DIR/res" \( -name '*.xml' -o -name '*.png' \) -print0)

echo "==> Enlazando (aapt2 link)..."
FLATS=()
while IFS= read -r -d '' f; do
  FLATS+=("$f")
done < <(find "$OUT_DIR/compiled" -name '*.flat' -print0)

"$BT/aapt2" link \
  -o "$OUT_DIR/base.apk" \
  -I "$PLATFORM" \
  --manifest "$APP_DIR/AndroidManifest.xml" \
  --java "$OUT_DIR/gen" \
  --auto-add-overlay \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 4 \
  --version-name "$VERSION_NAME" \
  "${FLATS[@]}"

echo "==> Compilando Java (javac)..."
find "$OUT_DIR/gen" "$APP_DIR/src" -name '*.java' -exec echo '"{}"' \; > "$OUT_DIR/sources.txt"
javac -encoding UTF-8 -source 1.8 -target 1.8 -cp "$PLATFORM" \
  -d "$OUT_DIR/obj" @"$OUT_DIR/sources.txt"

echo "==> Generando classes.dex (d8)..."
find "$OUT_DIR/obj" -name '*.class' > "$OUT_DIR/classes.txt"
CLASSES=()
while IFS= read -r line; do
  CLASSES+=("$line")
done < "$OUT_DIR/classes.txt"
"$BT/d8" --lib "$PLATFORM" --release --output "$OUT_DIR/dex" "${CLASSES[@]}"
cp "$OUT_DIR/dex/classes.dex" "$OUT_DIR/classes.dex"

echo "==> Insertando classes.dex en el APK..."
(cd "$OUT_DIR" && "$JAVA_HOME/bin/jar" uf base.apk classes.dex)

echo "==> Alineando (zipalign)..."
"$BT/zipalign" -f 4 "$OUT_DIR/base.apk" "$OUT_DIR/unaligned.apk"

echo "==> Firmando (apksigner)..."
KEYSTORE="$ANDROID_DIR/decasa.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias decasa -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass decasa123 -keypass decasa123 \
    -dname "CN=DeCasa, OU=DeCasa, O=DeCasa, L=Madrid, S=Madrid, C=ES" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:decasa123 --key-pass pass:decasa123 \
  --out "$OUT_DIR/DeCasa.apk" "$OUT_DIR/unaligned.apk"

echo "==> Verificando firma..."
"$BT/apksigner" verify --print-certs "$OUT_DIR/DeCasa.apk" >/dev/null 2>&1 && echo "Firma OK"

mkdir -p "$ROOT/dist/apk"
cp "$OUT_DIR/DeCasa.apk" "$ROOT/dist/apk/DeCasa-${VERSION_NAME}.apk"
echo "==> Hecho: dist/apk/DeCasa-${VERSION_NAME}.apk"
