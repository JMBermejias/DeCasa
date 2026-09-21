#!/usr/bin/env bash
# Build del paquete .deb de DeCasa
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${VERSION:-1.2.0}"
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
cp "$ROOT/server/index.js" "$ROOT/server/db.js" "$ROOT/server/publish.js" "$STAGE/opt/decasa/server/"
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

cat > "$STAGE/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
chmod 755 /opt/decasa/runtime/node
chmod 755 /usr/bin/decasa
update-desktop-database /usr/share/applications 2>/dev/null || true
# Crear directorio de datos para el usuario que ejecuta postinst
DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
mkdir -p "$DATA_DIR" 2>/dev/null || true
# Activar servicio systemd user si está disponible
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload 2>/dev/null || true
fi
exit 0
POSTINST
chmod 755 "$STAGE/DEBIAN/postinst"

cat > "$STAGE/usr/bin/decasa" <<'EOF'
#!/usr/bin/env bash
# DeCasa - lanzador
export DECASA_DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
export PORT="${DECASA_PORT:-4000}"
RUNTIME=/opt/decasa/runtime/node
SERVER=/opt/decasa/server/index.js
PID_FILE="$DECASA_DATA_DIR/decasa.pid"
LOG_FILE="$DECASA_DATA_DIR/decasa.log"
mkdir -p "$DECASA_DATA_DIR"

[ -x "$RUNTIME" ] || RUNTIME="$(command -v node || true)"
if [ -z "$RUNTIME" ]; then
  echo "ERROR: no se encuentra el runtime de Node.js (/opt/decasa/runtime/node)." >&2
  exit 1
fi

is_up() {
  "$RUNTIME" -e "const http=require('http');const r=http.get('http://127.0.0.1:$PORT/api/health',res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.setTimeout(2000,()=>process.exit(1))" 2>/dev/null \
    || { command -v curl >/dev/null 2>&1 && curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; } \
    || { command -v wget >/dev/null 2>&1 && wget -qO- "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; }
}

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

cmd="${1:-open}"
case "$cmd" in
  start)
    if is_running || is_up; then echo "DeCasa ya está en marcha en http://localhost:$PORT"; exit 0; fi
    rm -f "$PID_FILE"
    nohup "$RUNTIME" "$SERVER" >> "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    echo "$NEW_PID" > "$PID_FILE"
    for _ in $(seq 1 40); do
      if is_up; then echo "DeCasa iniciado en http://localhost:$PORT"; exit 0; fi
      sleep 0.5
    done
    kill "$NEW_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "ERROR: el servidor no arrancó. Revisa el log: $LOG_FILE" >&2
    tail -15 "$LOG_FILE" >&2 2>/dev/null || true
    exit 1
    ;;
  stop)
    if is_running; then kill "$(cat "$PID_FILE")" 2>/dev/null || true; rm -f "$PID_FILE"; echo "DeCasa detenido"; else rm -f "$PID_FILE" 2>/dev/null || true; echo "DeCasa no está en marcha"; fi
    ;;
  status)
    if is_running; then echo "En marcha (PID $(cat "$PID_FILE")) en http://localhost:$PORT"
    elif is_up; then echo "En marcha en http://localhost:$PORT (servidor vivo, PID desactualizado)"
    else echo "Detenido"; fi
    ;;
  open|*)
    if "$0" start; then
      command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true
    else
      exit 1
    fi
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
Environment=PORT=4000
ExecStart=/opt/decasa/runtime/node /opt/decasa/server/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

echo "==> Construyendo .deb..."
dpkg-deb --build --root-owner-group "$STAGE" "$ROOT/dist/deb/${PKG}_${VERSION}_${ARCH}.deb"
echo "==> Hecho: dist/deb/${PKG}_${VERSION}_${ARCH}.deb"
