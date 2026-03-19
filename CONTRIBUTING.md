# Contributing to BugBoard26

Thanks for taking the time to contribute.

BugBoard26 is a full-stack issue tracking application with:

- a React + TypeScript frontend
- a Django REST backend
- PostgreSQL for persistence
- Docker-based local development and CI workflows

This guide explains how to set up the project, make changes safely, and open a pull request that is easy to review.

## Before You Start

Make sure you have:

- Docker and Docker Compose available locally
- Node.js available if you want to run frontend commands outside containers
- Python available if you want to run backend management commands outside containers

If you only want the standard project setup, Docker is the main requirement.

## Local Setup

1. Create a local environment file:

```bash
cp env/dev.example .env
```

2. Start the development stack:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/api/health`

You can also use the shortcuts in the `Makefile`:

- `make backend`
- `make frontend`
- `make all`
- `make logs`
- `make shell-backend`
- `make shell-frontend`
- `make prod-up`
- `make prod-scale-up`

The `Makefile` is optional. The source of truth for local development is still `docker compose`.

## Recommended Development Workflow

- Keep changes focused and small when possible.
- Update tests in the same change when behavior changes.
- Update documentation when setup, public routes, or contributor workflow changes.
- For UI changes, verify both behavior and visual regressions before opening a PR.
- If you change API contracts, make sure frontend usage and backend tests stay aligned.

## Running Tests

Run the checks that match the area you changed.

### Frontend

From `frontend/`:

```bash
npm run test
npm run test:coverage
```

Useful additional commands:

```bash
npm run build
npm run lint
```

### Backend

From `backend/`:

```bash
python manage.py check
python manage.py test apps.bugboardapi.tests
```

If your change affects models, serializers, permissions, or API responses, backend tests should be part of the PR.

### API / CI-Oriented Testing

This repository also contains Bruno collections under `BrunoTesting/` for API coverage and CI workflows.

Bruno is useful when working on API behavior, but it should not be treated as the only required local check for every contribution. Use it when it helps validate backend flows or when you are touching CI-tested API paths.

## Backend API Conventions

When adding or changing Django REST endpoints, follow these rules:

- Use `GenericViewSet + mixins` for router-backed resource roots.
- Use only the mixins that match the intended public HTTP surface.
- Do not use `ModelViewSet` for router-backed resources unless the resource is truly full CRUD.
- Use `APIView` for flow-oriented, bootstrap, nested, or non-resource endpoints.
- If a method should not exist publicly, do not expose the mixin for it.
- Use kebab-case for multiword custom action paths.
- If an old custom path must be kept for compatibility, keep the frontend on the canonical path and document the alias clearly.

Current router conventions in this project:

- `users`: `list`, `retrieve`, `create`, `update`
- `projects`: `list`, `retrieve`, `create`, `update`, `destroy`
- `issues`: explicit mixins plus custom actions
- `attachments`: explicit mixins
- `notifications`: explicit mixins
- `tags`: `list`, `create`, `destroy`

When changing public routes or supported methods:

- update backend tests in the same change
- update `README.md` if the public contract changed
- verify frontend usage matches the documented path

## Pull Request Expectations

A good pull request should include:

- a short explanation of what changed and why
- the tests you ran
- screenshots or a short GIF for visible UI changes
- notes about breaking changes, migrations, or contract changes when relevant

If a change is intentionally incomplete or has follow-up work, call that out clearly in the PR description.

## Keeping Documentation In Sync

Please update documentation when your change affects:

- local setup
- environment variables
- Docker workflows
- public API routes
- contributor workflow

In most cases:

- `README.md` should stay focused on project setup and architecture
- `CONTRIBUTING.md` should stay focused on how to work on the project

## What Not To Add Here

This repository currently does not define a CLA process, release workflow, or formal governance model in the docs. Please do not add those sections unless the project explicitly adopts them.
