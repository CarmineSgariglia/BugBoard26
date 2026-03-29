# BugBoard26

BugBoard26 è un'applicazione web progettata per raccogliere, organizzare e monitorare in modo semplice ed efficace bug, segnalazioni, idee e attività di miglioramento. Attraverso un approccio pratico e strutturato, mira a favorire la collaborazione tra i membri del team, aumentare la visibilità sulle criticità e rendere più fluido il processo di gestione e risoluzione delle issue.

La repository contiene:

- Frontend React 19 + TypeScript + Vite.
- Backend Django 5 + Django REST Framework.
- PostgreSQL come database.
- Workflow Docker Compose per sviluppo, test e produzione.
- Suite Bruno per il collaudo API.

## Organizzazione del lavoro
Tramite un sistema di task su Notion, è stato organizzato il lavoro del team in modo da avere una chiara visione di cosa fare e come farlo.

Link al Notion: urly.it/31f8z7

## Panoramica

Le funzionalità principali del software sono:

- Autenticazione con access token JWT, refresh token in cookie HTTP-only e protezione CSRF.
- Recupero password tramite OTP inviato via email.
- Gestione utenti con ruoli globali `admin` e `developer`.
- Creazione e manutenzione di progetti con team associato.
- Gestione issue con stato, priorita, tipo, assegnatari, tag e allegati.
- Timeline attivita issue con commenti e stream Server-Sent Events (SSE).
- Notifiche realtime con stream dedicato e sottoscrizioni admin a progetti e issue.
- Upload avatar e media con storage locale in sviluppo e Google Cloud Storage in produzione.
- Documentazione OpenAPI generata con `drf-spectacular`.
- Funzionalià per la compressione di immagini.
- Filtri per ricerche di issue e utenti.

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
- issue: `/api/projects/{projectId}/issues`, `/api/issues/{issueId}`, `/api/issues/{issueId}/assignees/{userId}`, `/api/issues/{issueId}/events`
- stream realtime: `/api/issues/{issueId}/events/stream`, `/api/notifications/stream`
- notifiche: `/api/notifications`
- password reset: `/api/password-reset-requests`, `/api/password-reset-verifications`, `/api/password-resets`

La specifica generata lato backend e disponibile anche in repository in [Documentazione/OpenAPI/openapi.yaml].

## Produzione E Deploy

Il progetto supporta due modalita principali:

- stack production-like locale con `make prod-up`
- deploy produzione tramite immagini immutable e workflow GitHub

Dettagli operativi:

- compose produzione: [docker-compose.prod.yml]
- script deploy remoto: [scripts/deploy_prod.sh]

Nota architetturale: il realtime backend usa stream in memoria di processo. La configurazione Django rifiuta quindi l'avvio fuori da debug/test se `REALTIME_EVENT_BACKEND=memory` e `GUNICORN_WORKERS` e diverso da `1`.

## Documentazione Interna

Altri riferimenti utili gia presenti:

- documenti di progetto: [Documentazione]
- collezione Bruno: [BrunoTesting/BugBoard/README.md]

## Contribuire

Le linee guida operative per lavorare sul repository sono in [CONTRIBUTING.md].
