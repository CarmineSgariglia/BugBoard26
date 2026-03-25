# Contribuire A BugBoard26

Questo documento descrive come lavorare sul repository in modo coerente con il progetto reale: stack Docker-first, frontend React/Vite, backend Django REST e suite di controllo gia integrate in CI.

## Principi Di Lavoro

Quando contribuisci a BugBoard26 cerca di mantenere ogni modifica:

- focalizzata su un singolo obiettivo
- coperta dai test pertinenti
- coerente con la struttura esistente del codice
- accompagnata da documentazione quando cambia setup, API o workflow

Il progetto ha gia una `main-pr-gate` che dipende da:

- backend safe suite
- frontend safe suite
- Bruno safe suite

Conviene quindi lavorare pensando fin dall'inizio a questi tre livelli di verifica.

## Setup Locale

Il setup di riferimento e Docker Compose.

1. Crea l'ambiente locale:

```bash
cp env/dev.example .env
```

2. Avvia lo stack:

```bash
docker compose up --build
```

3. Verifica che i servizi siano raggiungibili:

- frontend: `http://localhost:5173`
- backend health: `http://localhost:8000/api/health`
- Swagger: `http://localhost:8000/api/docs`

Shortcut utili:

```bash
make all
make backend
make frontend
make logs
make shell-backend
make shell-frontend
```

## Prerequisiti

Minimi:

- Docker
- Docker Compose plugin

Opzionali per eseguire comandi direttamente fuori dai container:

- Node.js 20
- Python 3.12

## Mappa Del Codice

### Backend

Il backend vive in `backend/` ed e organizzato soprattutto in:

- `backend/apps/bugboardapi/modules/auth`
- `backend/apps/bugboardapi/modules/users`
- `backend/apps/bugboardapi/modules/projects`
- `backend/apps/bugboardapi/modules/issues`
- `backend/apps/bugboardapi/modules/notifications`
- `backend/apps/bugboardapi/modules/tags`
- `backend/apps/bugboardapi/tests`

### Frontend

Il frontend vive in `frontend/` con struttura a layer:

- `frontend/src/app`
- `frontend/src/pages`
- `frontend/src/features`
- `frontend/src/shared`
- `frontend/src/widgets`

Gli alias Vite gia configurati sono:

- `@app`
- `@pages`
- `@features`
- `@shared`
- `@widgets`
- `@legacy`

### Altri Percorsi Rilevanti

- `BrunoTesting/` per test API e bootstrap CI
- `Documentazione/` per deployment guide e specifica OpenAPI
- `scripts/` per bootstrap test, HTTPS locale e deploy

## Workflow Consigliato

1. Crea un branch dedicato.

Naming consigliato, non imposto dal repository:

- `feature/...`
- `fix/...`
- `docs/...`
- `refactor/...`

2. Mantieni la modifica piccola e mirata.

3. Aggiorna test e documentazione nello stesso branch se cambi:

- comportamento utente
- route API
- variabili ambiente
- compose / deploy
- workflow contributivo

4. Esegui i controlli dell'area toccata prima di aprire la PR.

## Test Da Eseguire

Esegui i check minimi compatibili con il tipo di modifica.

### Se tocchi il frontend

Da `frontend/`:

```bash
npm run build
npm run test
npm run test:coverage
```

Se stai lavorando soprattutto su componenti o integrazione locale:

```bash
npm run test:unit
npm run test:integration
```

Oppure via Docker/Makefile:

```bash
make frontend-test
make frontend-coverage
```

### Se tocchi il backend

Da `backend/`:

```bash
python manage.py check
python manage.py test apps.bugboardapi.tests -v 2
```

Oppure via Docker/Makefile:

```bash
make backend-test
make backend-coverage
```

### Se tocchi contratti API o flussi end-to-end

Valuta anche la suite Bruno in `BrunoTesting/`.

Le safe suites in CI coprono i casi critici minimi, mentre il workflow `bruno-full.yml` e pensato per controlli piu estesi o manuali.

## Convenzioni Backend

Quando modifichi o aggiungi endpoint Django REST, allineati alle convenzioni gia presenti nel progetto:

- usa `GenericViewSet + mixins` per resource root gestite dal router
- usa solo i mixin che corrispondono davvero alla superficie HTTP pubblica
- evita `ModelViewSet` se la risorsa non e davvero full CRUD
- usa `APIView` per flow endpoint, nested endpoint o route non strettamente resource-oriented
- usa `kebab-case` per custom action path multiword
- se cambi route o metodi pubblici, aggiorna test backend e documentazione

Convenzioni gia osservabili nel codice:

- `users`: list, retrieve, create, update
- `projects`: list, retrieve, create, update, destroy
- `issues`: retrieve, update, destroy + action dedicate
- `tags`: list, create, destroy
- `notifications`: endpoint dedicati con list, update singolo, update bulk e stream

Se tocchi i modelli:

- genera e includi le migration Django
- verifica che serializer, permission e test restino coerenti

## Convenzioni Frontend

Per il frontend conviene seguire i pattern gia usati:

- tieni la logica di business dentro `features`
- usa `pages` solo per composizione di route
- riusa `shared/api/core/client.ts` per non rompere il flusso CSRF + refresh token
- preferisci React Query per fetch, cache e invalidazioni
- usa gli alias gia configurati invece di import relativi lunghi

Quando cambi il comportamento UI:

- verifica sia lo stato loading/error sia il percorso nominale
- se la modifica e visibile, prepara screenshot o breve video per la PR

## Contratti E Realtime

Questo progetto usa stream Server-Sent Events per:

- notifiche
- activity stream delle issue

Quando tocchi queste aree:

- verifica la compatibilita del payload backend
- controlla eventuali listener frontend
- evita modifiche silenziose al formato dati senza aggiornare test o documentazione

## Variabili D'Ambiente

Le sorgenti di riferimento sono:

- `env/dev.example`
- `env/production.example`

Se aggiungi una nuova variabile:

- documentala nel template giusto
- usa un default sensato se possibile
- aggiorna `README.md` se impatta setup o deploy

Ricorda che in produzione il backend richiede storage media `gcs`, quindi modifiche a upload, avatar o allegati vanno pensate anche per quel contesto.

## Bruno E Test API

Usa `BrunoTesting/` quando lavori su:

- autenticazione
- sessioni
- password reset
- route utenti/progetti/issue/notifiche
- regressioni sui contratti API

La collezione ha gia bootstrap e environment dedicati. Se cambi endpoint o payload, aggiorna anche la documentazione Bruno pertinente.

## Cosa Non Committare

Rispetta il `.gitignore`. In particolare non vanno committati:

- `.env`
- certificati locali in `nginx/certs/`
- file temporanei in `BrunoTesting/.tmp/`
- coverage report
- media upload locali
- log e file macchina-specifici

## Pull Request

Una PR buona per questo progetto dovrebbe includere:

- descrizione breve del problema e della soluzione
- elenco dei test eseguiti
- screenshot o GIF se hai cambiato UI
- note su migrazioni, variabili ambiente o impatti deploy se presenti

Se la modifica e deliberatamente parziale o introduce follow-up, dichiaralo esplicitamente nella descrizione.

## Documentazione Da Aggiornare Quando Serve

Aggiorna la documentazione quando tocchi:

- setup locale
- env vars
- Docker / Compose
- deploy
- route pubbliche
- workflow di contribuzione

Di norma:

- `README.md` resta il punto di ingresso al progetto
- `CONTRIBUTING.md` resta il riferimento per il lavoro sul repository
- `Documentazione/deployment_guide.md` resta la guida operativa per la produzione

## Riferimenti Utili

- [README.md]
- [BrunoTesting/BugBoard/README.md]
