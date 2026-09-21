#!/usr/bin/env bash
# Arranca el servidor DeCasa en segundo plano y abre el navegador.
set -e

cd "$(dirname "$0")"

PORT="${DECASA_PORT:-4000}"
export PORT
export DECASA_DATA_DIR="${DECASA_DATA_DIR:-$HOME/.local/share/decasa}"
mkdir -p "$DECASA_DATA_DIR"
LOG="$DECASA_DATA_DIR/server.log"
PID_FILE="$DECASA_DATA_DIR/decasa.pid"
SERVER="$(pwd)/server/index.js"

# Runtime preferido: un node empaquetado (build .deb) o el node del sistema.
if [ -n "$DECASA_RUNTIME" ] && [ -x "$DECASA_RUNTIME" ]; then
  RUNTIME="$DECASA_RUNTIME"
elif [ -x /opt/decasa/runtime/node ]; then
  RUNTIME=/opt/decasa/runtime/node
elif command -v node >/dev/null 2>&1; then
  RUNTIME="$(command -v node)"
else
  echo "Node.js no encontrado. Instálalo, usa el paquete .deb o define DECASA_RUNTIME." >&2
  exit 1
fi

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

health() {
  "$RUNTIME" -e "const http=require('http');const r=http.get('http://127.0.0.1:$PORT/api/health',res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.setTimeout(2000,()=>process.exit(1))" 2>/dev/null \
    || { command -v curl >/dev/null 2>&1 && curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; } \
    || { command -v wget >/dev/null 2>&1 && wget -qO- "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; }
}

start() {
  if is_running; then
    echo "DeCasa ya está en marcha en http://localhost:$PORT"
    return 0
  fi

  # Si el puerto ya responde, es un servidor vivo aunque el PID esté desactualizado.
  if health; then
    echo "DeCasa ya está disponible en http://localhost:$PORT"
    return 0
  fi

  rm -f "$PID_FILE"
  setsid nohup "$RUNTIME" "$SERVER" >> "$LOG" 2>&1 < /dev/null &
  NEW_PID=$!
  echo "$NEW_PID" > "$PID_FILE"

  for _ in $(seq 1 30); do
    if health; then
      echo "DeCasa iniciado en http://localhost:$PORT (log: $LOG)"
      return 0
    fi
    sleep 0.3
  done

  kill "$NEW_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "ERROR: el servidor no arrancó. Revisa el log: $LOG" >&2
  tail -15 "$LOG" >&2 2>/dev/null || true
  return 1
}

stop() {
  if is_running; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "DeCasa detenido"
  else
    # PID obsoleto o proceso muerto: se elimina el archivo.
    rm -f "$PID_FILE" 2>/dev/null || true
    echo "DeCasa no está en marcha"
  fi
}

status() {
  if is_running; then
    echo "En marcha en http://localhost:$PORT (PID $(cat "$PID_FILE"))"
  elif health; then
    echo "En marcha en http://localhost:$PORT (servidor vivo, PID desactualizado)"
  else
    echo "Detenido"
  fi
}

case "${1:-open}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  open|*)
    if start; then
      command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true
    else
      exit 1
    fi
    ;;
esac