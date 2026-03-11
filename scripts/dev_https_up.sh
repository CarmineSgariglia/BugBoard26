#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

normalize_windows_path() {
  p="$1"

  case "$p" in
    //?/*) p="${p#//?/}" ;;
    \\\\?\\*) p="${p#\\\\?\\}" ;;
  esac

  case "$p" in
    /[a-zA-Z]/*)
      drive=$(printf "%s" "$p" | cut -c2 | tr '[:lower:]' '[:upper:]')
      rest=$(printf "%s" "$p" | cut -c3-)
      p="$drive:$rest"
      ;;
  esac

  printf "%s" "$p"
}

if command -v cygpath >/dev/null 2>&1; then
  PROJECT_DIR_WIN=$(cygpath -aw "$PROJECT_DIR")
elif (pwd -W >/dev/null 2>&1); then
  PROJECT_DIR_WIN=$(CDPATH= cd -- "$PROJECT_DIR" && pwd -W)
else
  PROJECT_DIR_WIN="$PROJECT_DIR"
fi

PROJECT_DIR_WIN=$(normalize_windows_path "$PROJECT_DIR_WIN")

compose() {
  docker compose --project-directory "$PROJECT_DIR_WIN" --profile proxy "$@"
}

CERT_DIR="$PROJECT_DIR/nginx/certs"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"
CONF_FILE="$CERT_DIR/localhost.cnf"

mkdir -p "$CERT_DIR"

if command -v mkcert >/dev/null 2>&1; then
  echo "[https] mkcert trovato: genero/aggiorno certificato trusted locale..."
  mkcert -install
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" localhost 127.0.0.1
else
  if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "[https] mkcert non trovato: genero certificato self-signed (browser mostrerà warning)."
    cat > "$CONF_FILE" <<'CNF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
C = IT
ST = NA
L = Local
O = BugBoard26
OU = Dev
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
CNF

    openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
      -keyout "$KEY_FILE" \
      -out "$CERT_FILE" \
      -config "$CONF_FILE"
  else
    echo "[https] certificati locali già presenti (self-signed)."
  fi
fi

echo "[https] avvio stack con Nginx proxy su https://localhost ..."
compose up -d --build

echo "[https] stato servizi:"
compose ps

echo "[https] pronto. Apri: https://localhost"
