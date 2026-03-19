# BugBoard26 Three-Tier Setup

Containerized three-tier architecture:
- Presentation Tier: React + TypeScript + Tailwind CSS
- Application Tier: Django + Django REST Framework
- Data Tier: PostgreSQL

## Repository Structure

- `frontend/`: React + TypeScript + Tailwind app
- `backend/`: Django REST API app
- `docker-compose.yml`: Orchestrates all tiers
- `docker-compose.prod.yml`: Single-node production overrides
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
- Configure media storage on GCS via `MEDIA_STORAGE_BACKEND=gcs` and `GS_BUCKET_NAME`.
- Start the standard single-node production stack with:
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- Exposed ports in production:
  - `80` and `443` on the `web` service only
- Internal-only services in the production stack:
  - `backend` and `db` are reachable only on the Docker network
- Frontend delivery in production:
  - nginx serves the compiled files from `dist/`
  - sourcemaps are disabled
  - API and media requests go through the same origin (`/api`, `/media`)
- Realtime runtime mode:
  - production uses in-memory cache/transport and a single Gunicorn worker for single-VM SSE reliability

## API Endpoints

- `GET /api/health`: health check
- `GET /api/projects`: list visible projects
- `GET /api/projects/{id}`: retrieve a project
- `GET /api/projects/{id}/issues`: list issues for a project
- `POST /api/projects/{id}/issues`: create an issue inside a project
- `GET /api/issues/{id}`: retrieve issue
- `PUT/PATCH /api/issues/{id}`: update issue
- `DELETE /api/issues/{id}`: delete issue

## Backend API Conventions

- Router-backed resource roots use `GenericViewSet + mixins`, not `ModelViewSet`.
- `APIView` is reserved for flow-oriented or custom endpoints that are not a resource root.
- Resource roots registered in the router should expose only the HTTP methods the product actually supports.
- Current resource roots follow this rule:
  - `users`: `list`, `retrieve`, `create`, `update`
  - `projects`: `list`, `retrieve`, `create`, `update`, `destroy`
  - `issues`: router-backed resource with explicit mixins plus custom actions
  - `attachments`: router-backed resource with explicit mixins
  - `notifications`: router-backed resource with explicit mixins
  - `tags`: `list`, `create`, `destroy`
- Current flow/custom endpoints stay on `APIView`:
  - auth endpoints under `/api/auth/*`
  - nested project issue flow `/api/projects/{id}/issues`
  - upload flow `/api/issue-events/{id}/attachments`
- Multiword custom action paths should use kebab-case. Legacy aliases may exist temporarily for compatibility.

## Notes

- PostgreSQL data persistence is provided by Docker volume `postgres_data`.
- Docker internal communication uses service names over `bugboard_net`.
- In development, frontend requests use the Vite proxy for `/api`.
- In production, nginx serves the frontend and proxies `/api`, `/media`, and `/admin` to Django.
