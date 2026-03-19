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
| `GCP_MEDIA_CREDENTIALS_FILE` | Path locale del file JSON del service account media montato nel container backend. |

Assicurati che `DEBUG=False` per disabilitare la modalità di debug in Django.

---

## 2. Certificati SSL (Nginx)

Nginx è configurato per ascoltare sulla porta 443 con SSL (`nginx/default.conf/production.conf`).

Di default, la configurazione cerca questi certificati:
- `/etc/nginx/certs/localhost.pem`
- `/etc/nginx/certs/localhost-key.pem`

### Come procedere:
1. **Certificati Propri**: Copia i tuoi certificati `.pem` e `.key` nella cartella `./nginx/certs`.
2. **Aggiorna Nginx**: Modifica `nginx/default.conf/production.conf` se i nomi dei file differiscono:
   ```nginx
   ssl_certificate /etc/nginx/certs/tuo-certificato.pem;
   ssl_certificate_key /etc/nginx/certs/tua-chiave-privata.pem;
   ```

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
- avvia lo stack con `docker-compose.release.yml`
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
- `docker-compose.release.yml`
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
- il container `backend` deve ricevere la chiave del service account tramite `GOOGLE_APPLICATION_CREDENTIALS`
- Nginx non deve più proxyare `/media/`

Controlla che tutto sia in ordine:
```bash
docker compose logs -f web
docker compose logs -f backend
```
