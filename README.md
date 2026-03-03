# BugBoard26 Three-Tier Setup

Containerized three-tier architecture:
- Presentation Tier: React + TypeScript + Tailwind CSS
- Application Tier: Django + Django REST Framework
- Data Tier: PostgreSQL

## Repository Structure

- `frontend/`: React + TypeScript + Tailwind app
- `backend/`: Django REST API app
- `docker-compose.yml`: Orchestrates all tiers
- `.env.example`: Environment variable template

## Quick Start

1. Create environment file:
   - `cp .env.example .env`
2. Build and run:
   - `docker compose up --build`
3. Open applications:
   - Frontend: `http://localhost:5173`
   - Backend API health endpoint: `http://localhost:8000/api/health/`

## Production (GCP VM)

- Use `.env.production.example` as template for production secrets and security flags.
- Configure media storage on GCS via `MEDIA_STORAGE_BACKEND=gcs` and `GS_BUCKET_NAME`.
- Start production-like stack with:
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile proxy up -d --build`
- Full runbook:
  - `ops/gcp/PRODUCTION_RUNBOOK.md`

## API Endpoints

- `GET /api/health/`: health check
- `GET /api/issues/`: list issues
- `POST /api/issues/`: create issue
- `GET /api/issues/{id}/`: retrieve issue
- `PUT/PATCH /api/issues/{id}/`: update issue
- `DELETE /api/issues/{id}/`: delete issue

## Notes

- PostgreSQL data persistence is provided by Docker volume `postgres_data`.
- Docker internal communication uses service names (`frontend`, `backend`, `db`) over `bugboard_net`.
- Frontend uses Vite proxy for `/api` to reach Django backend.
