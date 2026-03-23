# BugBoard26 Three-Tier Setup

Containerized three-tier architecture:
- Presentation Tier: React + TypeScript + Tailwind CSS
- Application Tier: Django + Django REST Framework
- Data Tier: PostgreSQL

## Repository Structure

- `frontend/`: React + TypeScript + Tailwind app
- `backend/`: Django REST API app
- `docker-compose.yml`: Orchestrates all tiers
- `docker-compose.prod.yml`: Immutable-image production definition for VM deploys
- `env/dev.example`: Local development environment template
- `BrunoTesting/env/bruno-safe.ci.env`: Safe CI environment for Bruno and CI workflows
- `env/production.example`: Production environment template

## Development

1. Create environment file:
   - `cp env/dev.example .env`
2. Build and run the development stack:
   - `docker compose up --build`
3. Open applications:
   - Frontend: `http://localhost:5173`
   - Backend API / health: `http://localhost:8000/api/health`

Notes:
- In development, the frontend is served by the Vite dev server.
- Browser DevTools can inspect the client source more directly in this mode.

## CI

- The CI workflows generate `.env` from `BrunoTesting/env/bruno-safe.ci.env`.
- `BrunoTesting/env/bruno-safe.ci.env` is intentionally minimal and uses only fake/local-safe values.
- Do not use the CI env file for local development or production.
- Backend changes are validated on push by `.github/workflows/backend-safe.yml`, which runs the Django suite with coverage.
- SonarCloud analysis runs from `.github/workflows/sonar.yml` only for backend-related changes and analyzes the backend codebase only.
- Pull requests targeting `main` are gated by `.github/workflows/main-pr-gate.yml`, which aggregates the safe backend, frontend, and Bruno suites into a single required check.
- Production releases run from `.github/workflows/deploy-prod.yml`: the workflow rebuilds `backend` and `web`, pushes immutable images to Artifact Registry, and deploys to the VM only after GitHub Environment approval.
- SonarCloud is intentionally informational: keep `Main PR Gate` as the only required status check on `main`.
- GitHub secret required for SonarCloud: `SONAR_TOKEN`.

## Code Quality

- SonarCloud publishes coverage, code smells, bugs, vulnerabilities, and security hotspots for the backend only.
- The repository is configured so the SonarCloud scan reads only backend Python sources and the backend coverage XML.
- SonarCloud should remain non-blocking in branch protection; use it for backend visibility and review, not as a required merge gate.
- Recommended branch protection for `main`: require only the `Main PR Gate` status check.
- For local editor feedback in VS Code, install the `SonarLint` extension. The workspace already contains the connected-mode mapping for project `CarmineSgariglia_BugBoard26` in `.vscode/settings.json`.
- Local SonarLint feedback is expected only for `backend/**/*.py`. Frontend files are not part of the current SonarCloud scope.
- Terminal output will not match the SonarCloud web UI unless `sonar-scanner` is installed and authenticated separately.

## Backend Testing

- Run the backend suite in the running backend container:
  - `docker compose exec -T backend python manage.py test apps.bugboardapi.tests -v 2`
  - `make backend-test`
- Run backend coverage and generate terminal, XML, and HTML reports:
  - `docker compose exec -T backend sh -lc 'mkdir -p coverage && export COVERAGE_RCFILE=.coveragerc && coverage erase && coverage run manage.py test apps.bugboardapi.tests -v 2 && coverage report -m && coverage xml -o coverage/coverage.xml && coverage html -d coverage/htmlcov'`
  - `make backend-coverage`
- Coverage artifacts are written under `backend/coverage/`.
- Native fallback for low-level inspection without extra tooling:
  - `docker compose exec -T backend sh -lc 'python -m trace --count --missing --summary --coverdir=/tmp/backend-trace manage.py test apps.bugboardapi.tests'`
  - Prefer `coverage.py` for CI and release gating; use `trace` only as a diagnostic fallback.

## Frontend Testing

- Run the frontend unit/integration suite in the CI test container:
  - `docker compose -f docker-compose.yml -f docker-compose.ci.yml run --rm frontend-test npm run test`
  - `make frontend-test`
- Run frontend coverage:
  - `docker compose -f docker-compose.yml -f docker-compose.ci.yml run --rm frontend-test npm run test:coverage`
  - `make frontend-coverage`
- Frontend artifacts are written under `frontend/coverage/`.

## Production

- Use `env/production.example` as template for production secrets and security flags.
- Configure media storage on GCS via `MEDIA_STORAGE_BACKEND=gcs`, `GS_BUCKET_NAME`, and VM IAM / ADC credentials.
- Production deployment model:
  - CI validates the repo
  - release workflow builds immutable `backend` and `web` images
  - the VM deploys by pulling validated images from Artifact Registry
  - production must never rely on `git pull` or local `docker compose build`
- Start a production-like stack locally with:
  - `make prod-up`
- Validate the production compose with sample production values:
  - `make prod-config`
- Exposed ports in production:
  - `80` and `443` on the `web` service only
- TLS certificates are managed on the VM host with Let's Encrypt / `certbot` and mounted into `web` from `${SSL_CERTS_HOST_PATH}`.
- Internal-only services in the production stack:
  - `backend` and `db` are reachable only on the Docker network
- Frontend delivery in production:
  - nginx serves the compiled files from `dist/`
  - sourcemaps are disabled
  - API requests go through the same origin (`/api`)
  - media files are served directly by GCS using the absolute URLs returned by the backend
- Recommended production VM baseline on Google Cloud:
  - `e2-standard-2`
  - `pd-balanced` disk `50-100 GB`
  - region `europe-west8`
- Realtime runtime mode:
  - production uses in-memory cache/transport and a single Gunicorn worker for single-VM SSE reliability

## API Endpoints

- `GET /api/health`: health check
- `GET /api/schema`: OpenAPI 3.0.3 schema
- `GET /api/docs`: Swagger UI
- `GET /api/redoc`: Redoc
- `GET /api/projects`: list visible projects
- `GET /api/projects/{projectId}`: retrieve a project
- `GET /api/projects/{projectId}/issues`: list issues for a project
- `POST /api/projects/{projectId}/issues`: create an issue inside a project
- `GET /api/issues/{issueId}`: retrieve issue
- `PUT/PATCH /api/issues/{issueId}`: update issue
- `DELETE /api/issues/{issueId}`: delete issue

## Backend API Conventions

- Router-backed resource roots use `GenericViewSet + mixins`, not `ModelViewSet`.
- Router registration uses `SimpleRouter(trailing_slash=False)` so the API does not expose an API root or format suffix routes such as `.json`.
- `APIView` is reserved for flow-oriented or custom endpoints that are not a resource root.
- Resource roots registered in the router should expose only the HTTP methods the product actually supports.
- Current resource roots follow this rule:
  - `users`: `list`, `retrieve`, `create`, `update`
  - `projects`: `list`, `retrieve`, `create`, `update`, `destroy`
  - `issues`: router-backed resource with explicit mixins plus custom actions
  - `notifications`: router-backed resource with explicit mixins
  - `tags`: `list`, `create`, `destroy`
- Current flow/custom endpoints stay on `APIView`:
  - session/auth flows under `/api/security/csrf-token`, `/api/sessions`, `/api/sessions/current`, `/api/sessions/current/access-token`, `/api/users/me`, and `/api/password-reset-*`
  - user password/profile image flows under `/api/users/me/password`, `/api/users/{userId}/password`, `/api/users/me/profile-image`, and `/api/users/{userId}/profile-image`
  - nested project issue flow `/api/projects/{projectId}/issues`
  - nested issue attachment/event resources under `/api/issues/{issueId}/attachments` and `/api/issues/{issueId}/events/{eventId}/attachments`
- Public path params use camelCase names such as `userId`, `projectId`, `issueId`, `eventId`, `attachmentId`, `notificationId`, and `tagId`.
- Multiword custom action paths use kebab-case. Phase 1 removes legacy aliases such as `/users/{userId}/status`, `/issues/{issueId}/details`, `/users/me/upload_profile_image`, and router-generated `.json` paths.
- `DELETE /api/issues/{issueId}` is bodyless; any UI confirmation stays in the frontend only.
- Server-side JWT revocation remains enabled intentionally as a documented security exception to pure statelessness.

## Notes

- PostgreSQL data persistence is provided by Docker volume `postgres_data`.
- Docker internal communication uses service names over `bugboard_net`.
- In development, frontend requests use the Vite proxy for `/api`.
- In production, nginx serves the frontend and proxies `/api` and `/admin` to Django; media URLs are served directly from GCS.
