#!/usr/bin/env bash
# Build del paquete .deb de DeCasa
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${VERSION:-1.0.0}"
PKG="decasa"
ARCH="amd64"
STAGE="$ROOT/dist/deb/${PKG}_${VERSION}_${ARCH}"
RUNTIME_NODE="${DECASA_RUNTIME_NODE:-$HOME/.local/bin/node}"

echo "==> Compilando frontend..."
(cd "$ROOT/client" && npm run build)

echo "==> Preparando estructura del paquete..."
rm -rf "$STAGE"
mkdir -p "$STAGE/DEBIAN"
mkdir -p "$STAGE/opt/decasa/runtime"
mkdir -p "$STAGE/opt/decasa/server/services"
mkdir -p "$STAGE/opt/decasa/client"
mkdir -p "$STAGE/usr/bin"
mkdir -p "$STAGE/usr/share/applications"
mkdir -p "$STAGE/usr/share/icons/hicolor/scalable/apps"
mkdir -p "$STAGE/etc/xdg/autostart"
mkdir -p "$STAGE/lib/systemd/user"

echo "==> Copiando runtime de Node..."
cp "$RUNTIME_NODE" "$STAGE/opt/decasa/runtime/node"
chmod 755 "$STAGE/opt/decasa/runtime/node"

echo "==> Copiando servidor..."
cp "$ROOT/server/index.js" "$ROOT/server/db.js" "$STAGE/opt/decasa/server/"
cp "$ROOT/server/services/amazon.js" "$STAGE/opt/decasa/server/services/"

echo "==> Instalando dependencias de producción del servidor..."
mkdir -p "$STAGE/opt/decasa/server/node_modules"
(cd "$ROOT/server" && npm install --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null 2>&1)
cp -r "$ROOT/server/node_modules/." "$STAGE/opt/decasa/server/node_modules/"

echo "==> Copiando frontend compilado..."
cp -r "$ROOT/client/dist" "$STAGE/opt/decasa/client/dist"

echo "==> Generando archivos del paquete..."

cat > "$STAGE/DEBIAN/control" <<EOF
Package: decasa
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Maintainer: JMBermejias <jmbernabeu@users.noreply.github.com>
Depends: xdg-utils
Description: DeCasa - creador de tiendas online de afiliacion Amazon
 Dashboard de control, buscador de productos con mejores resenas,
 gestion de tiendas online, cuentas de afiliado y cobro de beneficios.
 Instalacion autonoma (incluye runtime de Node.js).
EOF

cat > "$STAGE/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
chmod 755 /opt/decasa/runtime/node
chmod 755 /usr/bin/decasa
update-desktop-database /usr/share/applications 2>/dev/null || true
exit 0
EOF
chmod 755 "$STAGE/DEBIAN/postinst"

cat > "$STAGE/usr/bin/decasa" <<'EOF'
#!/usr/bin/env bash
# DeCasa - lanzador
DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
export PORT="${DECASA_PORT:-4000}"
RUNTIME=/opt/decasa/runtime/node
SERVER=/opt/decasa/server/index.js
PID_FILE="$DATA_DIR/decasa.pid"
mkdir -p "$DATA_DIR"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

cmd="${1:-open}"
case "$cmd" in
  start)
    if is_running; then echo "DeCasa ya está en marcha (PID $(cat "$PID_FILE")) en http://localhost:$PORT"; exit 0; fi
    nohup "$RUNTIME" "$SERVER" >> "$DATA_DIR/decasa.log" 2>&1 &
    echo $! > "$PID_FILE"
    for _ in $(seq 1 30); do
      "$RUNTIME" -e "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null && break
      sleep 0.3
    done
    echo "DeCasa iniciado en http://localhost:$PORT"
    ;;
  stop)
    if is_running; then kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"; echo "DeCasa detenido"; else echo "DeCasa no está en marcha"; fi
    ;;
  status)
    if is_running; then echo "En marcha (PID $(cat "$PID_FILE")) en http://localhost:$PORT"; else echo "Detenido"; fi
    ;;
  open|*)
    "$0" start
    command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true
    ;;
esac
EOF
chmod 755 "$STAGE/usr/bin/decasa"

cat > "$STAGE/usr/share/applications/decasa.desktop" <<EOF
[Desktop Entry]
Name=DeCasa
Comment=Tiendas online de afiliación Amazon
Exec=decasa open
Icon=decasa
Terminal=false
Type=Application
Categories=Network;Office;
StartupNotify=true
EOF

cat > "$STAGE/usr/share/icons/hicolor/scalable/apps/decasa.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5bb0ef"/>
      <stop offset="1" stop-color="#2296d8"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <path d="M64 28 L104 62 H92 V96 H72 V78 H56 V96 H36 V62 H24 Z" fill="#ffffff"/>
  <circle cx="64" cy="96" r="5" fill="#ffffff" opacity="0.0"/>
  <path d="M64 96 L64 96" stroke="#ffffff" stroke-width="4"/>
</svg>
EOF

cat > "$STAGE/etc/xdg/autostart/decasa.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=DeCasa (servidor)
Comment=Inicia el servidor de DeCasa al iniciar sesión
Exec=decasa start
X-GNOME-Autostart-enabled=true
EOF

cat > "$STAGE/lib/systemd/user/decasa.service" <<'EOF'
[Unit]
Description=DeCasa servidor de afiliación Amazon
After=network.target

[Service]
Type=simple
Environment=DECASA_DATA_DIR=%h/.local/share/decasa
ExecStart=/opt/decasa/runtime/node /opt/decasa/server/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

echo "==> Construyendo .deb..."
dpkg-deb --build --root-owner-group "$STAGE" "$ROOT/dist/deb/${PKG}_${VERSION}_${ARCH}.deb"
echo "==> Hecho: dist/deb/${PKG}_${VERSION}_${ARCH}.deb"
