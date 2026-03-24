# BugBoard26

BugBoard26 e un issue tracker full-stack per la gestione collaborativa di progetti, issue, attivita operative e notifiche in tempo reale.

Il repository contiene:

- un frontend React 19 + TypeScript + Vite
- un backend Django 5 + Django REST Framework
- PostgreSQL come database
- workflow Docker Compose per sviluppo, test e produzione
- suite Bruno per il collaudo API

## Panoramica

Dal codice attuale emergono queste capacita principali:

- autenticazione con access token JWT, refresh token in cookie HTTP-only e protezione CSRF
- recupero password tramite OTP
- gestione utenti con ruoli globali `admin` e `developer`
- creazione e manutenzione di progetti con team associato
- gestione issue con stato, priorita, tipo, assegnatari, tag e allegati
- timeline attivita issue con commenti e stream Server-Sent Events
- notifiche realtime con stream dedicato e sottoscrizioni admin a progetti e issue
- upload avatar e media con storage locale in sviluppo e Google Cloud Storage in produzione
- documentazione OpenAPI generata con `drf-spectacular`

## Stack Tecnologico

### Frontend

- React 19
- TypeScript
- Vite 7
- Tailwind CSS
- TanStack Query
- React Router 7
- Axios
- Vitest + Testing Library

### Backend

- Python 3.12
- Django 5
- Django REST Framework
- Simple JWT
- drf-spectacular
- django-cors-headers
- django-anymail con provider Brevo
- gunicorn

### Infrastruttura

- PostgreSQL 16
- Docker Compose
- Nginx per HTTPS locale e deploy produzione
- GitHub Actions per safe suites, PR gate e deploy

## Struttura Del Repository

```text
.
|-- backend/                 # API Django, moduli applicativi, test backend
|-- frontend/                # App React/Vite
|-- BrunoTesting/            # Collezioni Bruno e env per test API
|-- Documentazione/          # OpenAPI, deployment guide e documenti di progetto
|-- nginx/                   # Build web production e configurazioni proxy
|-- scripts/                 # Script di bootstrap CI, HTTPS locale e deploy
|-- env/                     # Template ambiente dev/prod
|-- docker-compose.yml       # Stack locale di sviluppo
|-- docker-compose.ci.yml    # Override per test e CI
|-- docker-compose.prod.yml  # Stack production-like / produzione
|-- Makefile                 # Shortcut operativi
```

Nel backend la logica applicativa e organizzata principalmente in `backend/apps/bugboardapi/modules/`:

- `auth`
- `users`
- `projects`
- `issues`
- `notifications`
- `tags`

Nel frontend l'organizzazione e per layer:

- `frontend/src/app` per bootstrap, router e provider
- `frontend/src/pages` per le route
- `frontend/src/features` per le funzionalita verticali
- `frontend/src/shared` per componenti, hook, client API e utility condivise
- `frontend/src/widgets` per layout e blocchi compositi

## Prerequisiti

Per il flusso standard bastano:

- Docker
- Docker Compose plugin

Opzionali, se vuoi lavorare anche fuori dai container:

- Node.js 20
- Python 3.12

## Avvio Rapido In Sviluppo

1. Crea il file ambiente locale dal template:

```bash
cp env/dev.example .env
```

2. Avvia l'intero stack:

```bash
docker compose up --build
```

3. Apri i servizi:

- frontend: `http://localhost:5173`
- health check backend: `http://localhost:8000/api/health`
- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`
- Django admin: `http://localhost:8000/admin`

All'avvio del backend il container esegue automaticamente:

- `python manage.py relabel_bugboardapi`
- `python manage.py migrate`

In sviluppo il frontend usa Vite con proxy su `/api` e `/media`.

## Comandi Utili

Il `Makefile` non sostituisce `docker compose`, ma raccoglie le operazioni piu frequenti:

```bash
make backend
make frontend
make all
make logs
make stop
make shell-backend
make shell-frontend
```

Per test e quality checks:

```bash
make backend-test
make backend-coverage
make frontend-test
make frontend-coverage
```

Per HTTPS locale con Nginx:

```bash
make https
make https-down
```

Per lo stack production-like:

```bash
make prod-up
make prod-down
make prod-config
```

## Configurazione Ambiente

I template ufficiali sono:

- `env/dev.example`
- `env/production.example`

### Variabili Chiave In Sviluppo

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CORS_ALLOW_ALL_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `EMAIL_PROVIDER`
- `VITE_API_BASE_URL`

In sviluppo il template usa:

- backend con `DEBUG=True`
- provider email `console`
- API frontend su `/api`

### Variabili Chiave In Produzione

Oltre a database e sicurezza, la produzione richiede anche:

- `MEDIA_STORAGE_BACKEND=gcs`
- `GS_BUCKET_NAME`
- `GS_PROJECT_ID`
- `GCS_MEDIA_URL`
- `NGINX_SERVER_NAME`
- `SSL_CERTS_HOST_PATH`
- `NGINX_SSL_CERT_PATH`
- `NGINX_SSL_KEY_PATH`

Nota importante: dalle impostazioni Django il backend rifiuta la produzione con storage media locale. In ambiente reale e previsto Google Cloud Storage.

## Test E Verifiche

### Frontend

Da `frontend/`:

```bash
npm run build
npm run lint
npm run test
npm run test:unit
npm run test:integration
npm run test:coverage
```

### Backend

Da `backend/`:

```bash
python manage.py check
python manage.py test apps.bugboardapi.tests -v 2
```

### Bruno

La cartella `BrunoTesting/` contiene la collezione API usata sia localmente sia in CI.

Workflow principali gia presenti in repository:

- `backend-safe.yml`
- `frontend-safe.yml`
- `bruno-safe.yml`
- `main-pr-gate.yml`
- `bruno-full.yml`
- `deploy-prod.yml`

La `main-pr-gate` richiede il passaggio delle tre safe suites.

## Superficie API Principale

La API e montata sotto `/api/`.

Endpoint e aree principali:

- health e docs: `/api/health`, `/api/schema`, `/api/docs`, `/api/redoc`
- sicurezza e sessione: `/api/security/csrf-token`, `/api/sessions`, `/api/sessions/current`
- utenti: `/api/users`, `/api/users/me`, password e profile image
- progetti: `/api/projects`, `/api/projects/{projectId}/members`, `/api/projects/{projectId}/subscriptions/me`
- issue: `/api/projects/{projectId}/issues`, `/api/issues/{issueId}`, `/api/issues/{issueId}/events`
- stream realtime: `/api/issues/{issueId}/events/stream`, `/api/notifications/stream`
- notifiche: `/api/notifications`
- password reset: `/api/password-reset-requests`, `/api/password-reset-verifications`, `/api/password-resets`
- tag e allegati: `/api/tags`, endpoint nested sotto `/api/issues/.../attachments`

La specifica generata lato backend e disponibile anche in repository in [Documentazione/OpenAPI/openapi.yaml](/Users/carminesgariglia/Desktop/BugBoard26/Documentazione/OpenAPI/openapi.yaml).

## Produzione E Deploy

Il progetto supporta due modalita principali:

- stack production-like locale con `make prod-up`
- deploy produzione tramite immagini immutable e workflow GitHub

Dettagli operativi:

- guida deploy: [Documentazione/deployment_guide.md](/Users/carminesgariglia/Desktop/BugBoard26/Documentazione/deployment_guide.md)
- compose produzione: [docker-compose.prod.yml](/Users/carminesgariglia/Desktop/BugBoard26/docker-compose.prod.yml)
- script deploy remoto: [scripts/deploy_prod.sh](/Users/carminesgariglia/Desktop/BugBoard26/scripts/deploy_prod.sh)

Nota architetturale: il realtime backend usa stream in memoria di processo. La documentazione di deploy del progetto considera quindi supportata la topologia con singola istanza backend e `GUNICORN_WORKERS=1`.

## Documentazione Interna

Altri riferimenti utili gia presenti:

- guida deploy: [Documentazione/deployment_guide.md](/Users/carminesgariglia/Desktop/BugBoard26/Documentazione/deployment_guide.md)
- documenti di progetto: [Documentazione](/Users/carminesgariglia/Desktop/BugBoard26/Documentazione)
- collezione Bruno: [BrunoTesting/BugBoard/README.md](/Users/carminesgariglia/Desktop/BugBoard26/BrunoTesting/BugBoard/README.md)

## Contribuire

Le linee guida operative per lavorare sul repository sono in [CONTRIBUTING.md](/Users/carminesgariglia/Desktop/BugBoard26/CONTRIBUTING.md).
