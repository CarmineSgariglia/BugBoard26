# BugBoard26 Three-Tier Setup

Containerized three-tier architecture:
- Presentation Tier: React + TypeScript + Tailwind CSS
- Application Tier: Django + Django REST Framework
- Data Tier: PostgreSQL

## Repository Structure

- `frontend/`: React + TypeScript + Tailwind app
- `backend/`: Django REST API app
- `docker-compose.yml`: Orchestrates all tiers
- `docker-compose.prod.yml`: Production overrides
- `.env.example`: Environment variable template

## Development

1. Create environment file:
   - `cp .env.example .env`
2. Build and run the development stack:
   - `docker compose up --build`
3. Open applications:
   - Frontend: `http://localhost:5173`
   - Backend API / health: `http://localhost:8000/api/health`

Notes:
- In development, the frontend is served by the Vite dev server.
- Browser DevTools can inspect the client source more directly in this mode.

## Production (GCP VM)

- Use `.env.production.example` as template for production secrets and security flags.
- Configure media storage on GCS via `MEDIA_STORAGE_BACKEND=gcs` and `GS_BUCKET_NAME`.
- Start production stack with:
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- Exposed ports in production:
  - `80` and `443` on the `web` service only
- Internal-only services in production:
  - `backend` and `db` are reachable only on the Docker network
- Frontend delivery in production:
  - nginx serves the compiled files from `dist/`
  - sourcemaps are disabled
  - API and media requests go through the same origin (`/api`, `/media`)
- Full runbook:
  - `ops/gcp/PRODUCTION_RUNBOOK.md`

## API Endpoints

- `GET /api/health`: health check
- `GET /api/issues`: list issues
- `POST /api/issues`: create issue
- `GET /api/issues/{id}`: retrieve issue
- `PUT/PATCH /api/issues/{id}`: update issue
- `DELETE /api/issues/{id}`: delete issue

## Notes

- PostgreSQL data persistence is provided by Docker volume `postgres_data`.
- Docker internal communication uses service names over `bugboard_net`.
- In development, frontend requests use the Vite proxy for `/api`.
- In production, nginx serves the frontend and proxies `/api`, `/media`, and `/admin` to Django.
