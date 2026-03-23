# Guida alla Messa in Produzione

Questa guida spiega come configurare e avviare lo stack in modalità produzione.

## 1. Preparazione delle Variabili d'Ambiente

Crea un file `.env` per la produzione partendo dal template `env/production.example`.

```bash
cp env/production.example .env
```

Modifica il file `.env` con i tuoi parametri di produzione:

| Variabile | Descrizione / Azione |
| :--- | :--- |
| `POSTGRES_PASSWORD` | Imposta una password robusta per il database. |
| `DJANGO_SECRET_KEY` | Genera una chiave segreta lunga e casuale. |
| `ALLOWED_HOSTS` | Aggiungi il tuo dominio (es. `tuo-dominio.com`). |
| `CORS_ALLOWED_ORIGINS` | Inserisci l'URL del tuo dominio (es. `https://tuo-dominio.com`). |
| `CSRF_TRUSTED_ORIGINS` | Inserisci l'URL del tuo dominio (es. `https://tuo-dominio.com`). |

Assicurati che `DEBUG=False` per disabilitare la modalità di debug in Django.

---

## 2. Certificati SSL (Let's Encrypt su VM host)

In produzione i certificati TLS non devono stare nella repository: vengono ottenuti sulla VM host con `certbot` e montati nel container `web`.

Percorsi consigliati sulla VM:
- `/opt/bugboard26/certs/live/tuo-dominio.com/fullchain.pem`
- `/opt/bugboard26/certs/live/tuo-dominio.com/privkey.pem`

Variabili da allineare nel file `.env` di produzione:
- `NGINX_SERVER_NAME=tuo-dominio.com www.tuo-dominio.com`
- `SSL_CERTS_HOST_PATH=/opt/bugboard26/certs`
- `NGINX_SSL_CERT_PATH=/etc/nginx/certs/live/tuo-dominio.com/fullchain.pem`
- `NGINX_SSL_KEY_PATH=/etc/nginx/certs/live/tuo-dominio.com/privkey.pem`

### Prerequisiti DNS e rete
1. Punta il dominio e l'eventuale `www` all'IP statico pubblico della VM.
2. Apri pubblicamente solo le porte `80` e `443`.
3. Tieni `22` chiusa al pubblico o limitata a IP amministrativi / IAP.

### Emissione iniziale del certificato
Installa `certbot` direttamente sulla VM host, non nel container:

```bash
sudo apt-get update
sudo apt-get install -y certbot
sudo mkdir -p /opt/bugboard26/certs /opt/bugboard26/certbot/{work,logs}
```

Prima del primo deploy HTTPS del container `web`, ottieni il certificato con challenge standalone:

```bash
sudo certbot certonly \
  --standalone \
  --preferred-challenges http \
  --config-dir /opt/bugboard26/certs \
  --work-dir /opt/bugboard26/certbot/work \
  --logs-dir /opt/bugboard26/certbot/logs \
  -d tuo-dominio.com \
  -d www.tuo-dominio.com
```

Una volta emesso il certificato:
1. verifica che i file esistano in `/opt/bugboard26/certs/live/tuo-dominio.com/`
2. imposta `NGINX_SERVER_NAME`, `NGINX_SSL_CERT_PATH` e `NGINX_SSL_KEY_PATH` nel `.env`
3. avvia o aggiorna lo stack con `docker-compose.prod.yml`

### Rinnovo automatico
Configura il rinnovo sulla VM host con `systemd timer` o `cron`. Con `certbot renew` in modalità standalone devi liberare temporaneamente la porta `80`, quindi il modo più semplice è fermare solo `web`, rinnovare e poi ricaricare Nginx:

```bash
sudo certbot renew \
  --pre-hook "cd /opt/bugboard26 && docker compose -f docker-compose.prod.yml stop web" \
  --post-hook "cd /opt/bugboard26 && docker compose -f docker-compose.prod.yml up -d web && docker compose -f docker-compose.prod.yml exec -T web nginx -s reload"
```

Verifica il flusso senza consumare il rate limit con:

```bash
sudo certbot renew --dry-run
```

Nota: `localhost.pem` e `localhost-key.pem` non sono più il default di produzione. Se vuoi usarli, fallo solo come placeholder temporaneo durante test locali.

---

## 3. Avvio dello Stack

Usa il `Makefile` per avviare uno stack locale production-like o il workflow GitHub per il deploy sulla VM.

### Opzione A: Standalone (Standard)
Per un'installazione singola non scalabile orizzontalmente:
```bash
make prod-up
```
Questo target:
- builda localmente le immagini `backend` e `web`
- avvia lo stack con `docker-compose.prod.yml`
- usa lo stesso modello a immagini immutable del deploy reale

Questa modalità usa il realtime in memoria del processo backend ed è quindi compatibile con il contratto di deploy supportato: singola istanza backend e `GUNICORN_WORKERS=1`.

### Deploy automatico production-grade
Per l'ambiente reale la strategia raccomandata non è `git pull` sulla VM:
- GitHub Actions esegue le safe suites
- costruisce le immagini immutable `backend` e `web`
- le pubblica su Artifact Registry
- attende approvazione sull'environment GitHub `production`
- la VM esegue solo `docker compose pull` + `up -d` tramite `scripts/deploy_prod.sh`

File principali:
- `.github/workflows/deploy-prod.yml`
- `docker-compose.prod.yml`
- `scripts/deploy_prod.sh`

Segreti/variabili GitHub richiesti:
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `PROD_VM_HOST`
- `PROD_VM_USER`
- `PROD_VM_SSH_PRIVATE_KEY`
- variabili repo/environment: `GCP_PROJECT_ID`, `GCP_ARTIFACT_REGISTRY_REGION`, `GCP_ARTIFACT_REGISTRY_REPOSITORY`, `PROD_VM_APP_DIR`, opzionale `PROD_VM_PORT`

Configurazione VM consigliata:
- Google Compute Engine `e2-standard-2`
- `2 vCPU`, `8 GB RAM`
- disco `pd-balanced` da `50-100 GB`
- region `europe-west8`

---

## 4. Verifica e Log

Una volta avviato, Nginx si occuperà di:
1. Servire i file statici del Frontend (compilati durante la build).
2. Proxy delle chiamate `/api/` al Backend (Django).

In produzione i media non devono più essere serviti dal filesystem locale del backend:
- avatar e allegati vengono salvati su Google Cloud Storage
- il backend restituisce URL assoluti del bucket
- il backend in VM usa l'identità IAM della macchina oppure ADC standard, senza montare un JSON locale
- Nginx non deve più proxyare `/media/`

Controlla che tutto sia in ordine:
```bash
docker compose logs -f web
docker compose logs -f backend
```
