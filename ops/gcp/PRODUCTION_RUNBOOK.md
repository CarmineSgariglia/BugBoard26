# BugBoard Production Runbook (GCP VM)

## 1) Prerequisiti VM
- OS: Ubuntu 22.04 LTS
- Docker + Docker Compose plugin installati
- Dominio DNS puntato all'IP pubblico della VM
- Firewall GCP:
  - `tcp:80` e `tcp:443` aperte a Internet
  - `tcp:22` aperta solo a IP amministrativi
  - `tcp:5432` chiusa
  - `tcp:8000` chiusa
  - `tcp:5173` chiusa

## 2) Deploy stack
1. Copia repo in `/opt/bugboard/BugBoard26`
2. Crea file env produzione:
   - `cp .env.production.example .env`
   - sostituisci tutti i `CHANGE_ME_*`
3. Avvio:
   - `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile proxy up -d --build`
4. Verifica:
   - `docker compose ps`
   - `curl -I https://your-domain.com`
   - `curl -I https://your-domain.com/api/health/`

## 3) Certificati TLS
- Usa certificati validi (Let's Encrypt o cert managed).
- Monta i file in `nginx/certs/` con nomi attesi dal config Nginx.
- Evita certificati self-signed in produzione.

## 4) Hardening applicativo (già supportato)
- `DEBUG=False`
- `DJANGO_SECRET_KEY` forte
- `ALLOWED_HOSTS` stretti
- `CORS_ALLOW_ALL_ORIGINS=False`
- `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` solo domini reali
- Cookie secure e HSTS attivi via env

## 5) OTP Cleanup scheduler (systemd timer)
1. Copia unit:
   - `sudo cp ops/gcp/systemd/bugboard-otp-cleanup.service /etc/systemd/system/`
   - `sudo cp ops/gcp/systemd/bugboard-otp-cleanup.timer /etc/systemd/system/`
2. Aggiorna `User` e `WorkingDirectory` nel file `.service` se necessario.
3. Attiva timer:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now bugboard-otp-cleanup.timer`
4. Verifica:
   - `systemctl list-timers | grep bugboard-otp-cleanup`
   - `journalctl -u bugboard-otp-cleanup.service -n 100 --no-pager`

## 6) Backup e restore
- Abilita snapshot periodici volume DB.
- Definisci almeno un backup logico (`pg_dump`) giornaliero.
- Testa restore completo su ambiente staging.

## 7) Monitoraggio minimo
- Log containers: `docker compose logs -f backend nginx`
- Alert su:
  - HTTP 5xx
  - errori auth/OTP anomali
  - saturazione disco VM
  - restart ripetuti dei container
