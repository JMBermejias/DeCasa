#!/usr/bin/env bash
# Arranca el servidor DeCasa en segundo plano y abre el navegador.
set -e
cd "$(dirname "$0")"

PORT="${DECASA_PORT:-4000}"
export DECASA_DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
mkdir -p "$DECASA_DATA_DIR"
LOG="$DECASA_DATA_DIR/server.log"
PID_FILE="$DECASA_DATA_DIR/decasa.pid"

command -v node >/dev/null 2>&1 || { echo "Node.js no encontrado. Instálalo o usa el paquete .deb."; exit 1; }

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "${1:-open}" in
  start)
    if is_running; then echo "DeCasa ya está en marcha en http://localhost:$PORT"; exit 0; fi
    setsid nohup node server/index.js >> "$LOG" 2>&1 < /dev/null &
    echo $! > "$PID_FILE"
    for _ in $(seq 1 30); do
      node -e "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null && break
      sleep 0.3
    done
    echo "DeCasa iniciado en http://localhost:$PORT (log: $LOG)"
    ;;
  stop)
    if is_running; then kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"; echo "DeCasa detenido"; else echo "DeCasa no está en marcha"; fi
    ;;
  status)
    if is_running; then echo "En marcha en http://localhost:$PORT (PID $(cat "$PID_FILE"))"; else echo "Detenido"; fi
    ;;
  open|*)
    "$0" start
    command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true
    ;;
esac
