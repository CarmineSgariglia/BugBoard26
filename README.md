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

## VM Deployment Checklist

If frontend works but `/api/*` calls fail on a VM, verify:
- `ALLOWED_HOSTS` includes your VM public IP/domain (and optionally `localhost,127.0.0.1,backend`)
- If you are serving only HTTP, set:
  - `SESSION_COOKIE_SECURE=False`
  - `CSRF_COOKIE_SECURE=False`
- If frontend and backend are same host via nginx, keep `VITE_API_BASE_URL=/api`
- Rebuild and restart after `.env` changes:
  - `docker compose down && docker compose up --build -d`
