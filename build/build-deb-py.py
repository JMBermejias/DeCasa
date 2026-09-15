#!/usr/bin/env python3
"""Build .deb de DeCasa sin dpkg-deb (formato ar debian)."""
import io, os, tarfile, time, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = os.environ.get('VERSION', '1.0.1')
PKG = 'decasa'
ARCH = 'amd64'
OUT = os.path.join(ROOT, 'dist', 'deb', f'{PKG}_{VERSION}_{ARCH}.deb')
NOW = int(time.time())

RUNTIME_NODE = os.environ.get('DECASA_RUNTIME_NODE', os.path.expanduser('~/.local/bin/node'))
if not os.path.exists(RUNTIME_NODE):
    # Intentar buscar un node en ubicaciones comunes
    import shutil
    RUNTIME_NODE = shutil.which('node') or RUNTIME_NODE
if not os.path.exists(RUNTIME_NODE):
    sys.exit(f"ERROR: Node runtime not found. Set DECASA_RUNTIME_NODE or install node in ~/.local/bin/node")

CONTROL = f"""Package: {PKG}
Version: {VERSION}
Section: web
Priority: optional
Architecture: {ARCH}
Maintainer: JMBermejias <jmbernabeu@users.noreply.github.com>
Depends: xdg-utils
Description: DeCasa - creador de tiendas online de afiliacion Amazon
 Dashboard de control, buscador de productos con mejores resenas,
 gestion de tiendas online, cuentas de afiliado y cobro de beneficios.
 Instalacion autonoma (incluye runtime de Node.js).
"""

POSTINST = """#!/bin/sh
set -e
chmod 755 /opt/decasa/runtime/node
chmod 755 /usr/bin/decasa
update-desktop-database /usr/share/applications 2>/dev/null || true
DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
mkdir -p "$DATA_DIR" 2>/dev/null || true
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload 2>/dev/null || true
fi
exit 0
"""

LAUNCHER = r"""#!/usr/bin/env bash
# DeCasa - lanzador
export DECASA_DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
export PORT="${DECASA_PORT:-4000}"
RUNTIME=/opt/decasa/runtime/node
SERVER=/opt/decasa/server/index.js
PID_FILE="$DECASA_DATA_DIR/decasa.pid"
LOG_FILE="$DECASA_DATA_DIR/decasa.log"
mkdir -p "$DECASA_DATA_DIR"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

cmd="${1:-open}"
case "$cmd" in
  start)
    if is_running; then echo "DeCasa ya está en marcha (PID $(cat "$PID_FILE")) en http://localhost:$PORT"; exit 0; fi
    nohup "$RUNTIME" "$SERVER" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    READY=0
    for _ in $(seq 1 40); do
      if "$RUNTIME" -e "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
        READY=1; break
      fi
      sleep 0.5
    done
    if [ "$READY" = "0" ]; then
      echo "ERROR: El servidor no arrancó. Revisa el log: $LOG_FILE" >&2
      tail -5 "$LOG_FILE" >&2 2>/dev/null
      rm -f "$PID_FILE"
      exit 1
    fi
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
"""

DESKTOP = f"""[Desktop Entry]
Name=DeCasa
Comment=Tiendas online de afiliación Amazon
Exec=decasa open
Icon=decasa
Terminal=false
Type=Application
Categories=Network;Office;
StartupNotify=true
"""

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5bb0ef"/>
      <stop offset="1" stop-color="#2296d8"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <path d="M64 28 L104 62 H92 V96 H72 V78 H56 V96 H36 V62 H24 Z" fill="#ffffff"/>
</svg>
"""

AUTOSTART = f"""[Desktop Entry]
Type=Application
Name=DeCasa (servidor)
Comment=Inicia el servidor de DeCasa al iniciar sesión
Exec=decasa start
X-GNOME-Autostart-enabled=true
"""

SYSTEMD = """[Unit]
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
"""


def mk_tar_info(name, mode, isdir=False, size=0):
    info = tarfile.TarInfo(name)
    info.mtime = NOW
    info.uid = info.gid = 0
    info.uname = info.gname = ''
    info.mode = mode
    if isdir:
        info.type = tarfile.DIRTYPE
    return info


def build_control_tar():
    buf = io.BytesIO()
    t = tarfile.open(fileobj=buf, mode='w:gz')
    for name, data, mode in [('control', CONTROL.encode(), 0o644), ('postinst', POSTINST.encode(), 0o755)]:
        ti = mk_tar_info('./' + name, mode)
        ti.size = len(data)
        t.addfile(ti, io.BytesIO(data))
    t.close()
    return buf.getvalue()


def add_file_to_tar(t, dest_path, content, mode):
    if isinstance(content, str):
        content = content.encode()
    parts = dest_path.split('/')
    added = set()
    for i in range(1, len(parts)):
        p = './' + '/'.join(parts[:i])
        if p not in added:
            t.addfile(mk_tar_info(p, 0o755, True))
            added.add(p)
    ti = mk_tar_info('./' + dest_path, mode)
    ti.size = len(content)
    t.addfile(ti, io.BytesIO(content))


def add_real_file_to_tar(t, dest_path, src_path, mode):
    with open(src_path, 'rb') as f:
        content = f.read()
    add_file_to_tar(t, dest_path, content, mode)


def build_data_tar():
    buf = io.BytesIO()
    t = tarfile.open(fileobj=buf, mode='w:gz')

    # Node runtime
    print(f"  -> runtime/node ({os.path.getsize(RUNTIME_NODE) // 1024} KB)")
    add_real_file_to_tar(t, 'opt/decasa/runtime/node', RUNTIME_NODE, 0o755)

    # Server files
    for fname in ['index.js', 'db.js']:
        add_real_file_to_tar(t, f'opt/decasa/server/{fname}', os.path.join(ROOT, 'server', fname), 0o644)
    add_real_file_to_tar(t, 'opt/decasa/server/services/amazon.js',
                         os.path.join(ROOT, 'server', 'services', 'amazon.js'), 0o644)

    # Server package.json
    add_real_file_to_tar(t, 'opt/decasa/server/package.json',
                         os.path.join(ROOT, 'server', 'package.json'), 0o644)

    # Server node_modules (only necessary modules)
    server_nm = os.path.join(ROOT, 'server', 'node_modules')
    nm_count = 0
    for dirpath, dirnames, filenames in os.walk(server_nm):
        rel = os.path.relpath(dirpath, ROOT)
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            dest = os.path.join('opt/decasa', rel, fname)
            add_real_file_to_tar(t, dest, fpath, 0o644)
            nm_count += 1
        for d in dirnames:
            dpath = os.path.join(dirpath, d)
            rel_d = os.path.relpath(dpath, ROOT)
            dest_d = os.path.join('opt/decasa', rel_d, '')
    print(f"  -> server node_modules ({nm_count} archivos)")

    # Client dist
    dist_dir = os.path.join(ROOT, 'client', 'dist')
    dist_count = 0
    for dirpath, dirnames, filenames in os.walk(dist_dir):
        rel = os.path.relpath(dirpath, ROOT)
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            dest = os.path.join('opt/decasa', rel, fname)
            add_real_file_to_tar(t, dest, fpath, 0o644)
            dist_count += 1
        for d in dirnames:
            dpath = os.path.join(dirpath, d)
            rel_d = os.path.relpath(dpath, ROOT)
    print(f"  -> client/dist ({dist_count} archivos)")

    # Launcher
    add_file_to_tar(t, 'usr/bin/decasa', LAUNCHER, 0o755)

    # Desktop entry
    add_file_to_tar(t, 'usr/share/applications/decasa.desktop', DESKTOP, 0o644)

    # SVG icon
    add_file_to_tar(t, 'usr/share/icons/hicolor/scalable/apps/decasa.svg', SVG, 0o644)

    # XDG autostart
    add_file_to_tar(t, 'etc/xdg/autostart/decasa.desktop', AUTOSTART, 0o644)

    # systemd user service
    add_file_to_tar(t, 'lib/systemd/user/decasa.service', SYSTEMD, 0o644)

    t.close()
    return buf.getvalue()


def ar_member(name, body):
    header = (name.ljust(16)[:16] + str(NOW).rjust(12) + '0'.rjust(6) + '0'.rjust(6)
              + '100644'.rjust(8) + str(len(body)).rjust(10) + '`\n').encode()
    assert len(header) == 60, f"AR header length {len(header)} != 60"
    return header + body + (b'\n' if len(body) % 2 else b'')


print(f"==> Construyendo .deb {PKG}_{VERSION}_{ARCH}...")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

control_tar = build_control_tar()
print(f"  -> control.tar.gz ({len(control_tar)} bytes)")

data_tar = build_data_tar()
print(f"  -> data.tar.gz ({len(data_tar)} bytes)")

out = b'!<arch>\n'
out += ar_member('debian-binary', b'2.0\n')
out += ar_member('control.tar.gz', control_tar)
out += ar_member('data.tar.gz', data_tar)

with open(OUT, 'wb') as f:
    f.write(out)

size = os.path.getsize(OUT)
print(f"==> .deb generado: {OUT} ({size // (1024*1024)} MB)")
