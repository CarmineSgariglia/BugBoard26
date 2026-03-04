#!/usr/bin/env sh
set -eu

COMPOSE_CMD="docker compose --profile proxy"
CERT_DIR="nginx/certs"
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
$COMPOSE_CMD up -d --build

echo "[https] stato servizi:"
$COMPOSE_CMD ps

echo "[https] pronto. Apri: https://localhost"
