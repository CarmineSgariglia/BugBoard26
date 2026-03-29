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

Link al Notion: [Link ->](https://urly.it/31f8z7)

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

Nel backend la logica applicativa è organizzata principalmente in `backend/apps/bugboardapi/modules/`:

- `auth`
- `users`
- `projects`
- `issues`
- `notifications`
- `tags`

Nel frontend l'organizzazione è per layer:

- `frontend/src/app` per bootstrap, router e provider
- `frontend/src/pages` per le route
- `frontend/src/features` per le funzionalita verticali
- `frontend/src/shared` per componenti, hook, client API e utility condivise
- `frontend/src/widgets` per layout e blocchi compositi

## Prerequisiti

Per l'esecuzione e la valutazione del progetto in ambiente isolato, è richiesta l'installazione dei seguenti strumenti:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

Per l'ambiente di sviluppo locale e la compilazione manuale (opzionale), sono necessari inoltre:
- Node.js (versione 20)
- Python (versione 3.12)

## Istruzioni per l'Esecuzione (Ambiente Locale)

Di seguito sono riportati i passaggi per avviare l'intera infrastruttura dell'applicazione tramite Docker.

**1. Configurazione dell'Ambiente**
Prima di avviare i container, è necessario configurare le variabili d'ambiente. Eseguire il seguente comando nella root del progetto per generare il file di configurazione a partire dal template fornito:
```bash
cp env/dev.example .env
```

**2. Costruzione e Avvio dei Servizi**
Avviare l'applicazione utilizzando Docker Compose. Il flag `--build` assicura che le immagini vengano ricompilate per includere eventuali ultime modifiche:
```bash
docker compose up --build
```
*I container si occuperanno automaticamente di configurare il database ed eseguire le migrazioni necessarie (`python manage.py migrate` e `relabel_bugboardapi`).*

**3. Accesso ai Servizi**
Una volta completato l'avvio, i servizi saranno accessibili ai seguenti indirizzi locali:

| Servizio | URL Locale | Descrizione |
|---|---|---|
| **App Frontend** | [http://localhost:5173](http://localhost:5173) | Interfaccia utente principale (in sviluppo Vite agisce come proxy su `/api` e `/media`). |
| **Backend Health** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | Endpoint per verificare lo stato del server. |
| **API Docs (Swagger)**| [http://localhost:8000/api/docs](http://localhost:8000/api/docs) | Documentazione interattiva delle API REST (formato Swagger UI). |
| **API Docs (ReDoc)**  | [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc) | Documentazione API alternativa (formato ReDoc). |
| **Amministrazione**  | [http://localhost:8000/admin](http://localhost:8000/admin) | Pannello di amministrazione di Django. |

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

## Stato del Progetto

Questo è un progetto accademico realizzato per un esame universitario. Essendo un progetto chiuso, **non si accettano contributi esterni o Pull Request**. Il codice è disponibile esclusivamente per fini valutativi.
