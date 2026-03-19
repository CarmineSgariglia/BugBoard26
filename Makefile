SHELL := /bin/sh

COMPOSE := docker compose
COMPOSE_PROXY := docker compose --profile proxy
PROD_BACKEND_IMAGE ?= bugboard26/backend:local-prod
PROD_WEB_IMAGE ?= bugboard26/web:local-prod

.PHONY: backend frontend all https https-down stop logs shell-backend shell-frontend prod-up prod-down backend-test backend-coverage frontend-test frontend-coverage release-config

# Start just the backend service (also brings up database dependency)
backend:
	$(COMPOSE) up --build backend

# Start just the frontend service (depends on backend + db)
frontend:
	$(COMPOSE) up --build frontend

# Start the full stack (db + backend + frontend)
all:
	$(COMPOSE) up --build

# Start full stack with HTTPS reverse proxy (nginx on 80/443)
https:
	./scripts/dev_https_up.sh

# Stop stack started with HTTPS profile
https-down:
	$(COMPOSE_PROXY) down

# Bring the entire stack down and remove the network
stop:
	$(COMPOSE) down

# Follow the container logs for quick debugging
logs:
	$(COMPOSE) logs --tail=50 --follow

# Open a shell in the backend container
shell-backend:
	$(COMPOSE) exec backend sh

# Open a shell in the frontend container
shell-frontend:
	$(COMPOSE) exec frontend sh

# Run backend Django tests inside the backend container
backend-test:
	$(COMPOSE) exec -T backend python manage.py test apps.bugboardapi.tests -v 2

# Run backend Django tests with coverage reports (terminal, XML, HTML)
backend-coverage:
	$(COMPOSE) exec -T backend sh -lc 'mkdir -p coverage && coverage erase && coverage run manage.py test apps.bugboardapi.tests -v 2 && coverage report -m && coverage xml -o coverage/coverage.xml && coverage html -d coverage/htmlcov'

# Run frontend Vitest suite inside the frontend test container
frontend-test:
	$(COMPOSE) -f docker-compose.yml -f docker-compose.ci.yml run --rm frontend-test npm run test

# Run frontend Vitest suite with coverage
frontend-coverage:
	$(COMPOSE) -f docker-compose.yml -f docker-compose.ci.yml run --rm frontend-test npm run test:coverage

# Start production-like stack using the immutable-image release compose
prod-up:
	docker build -t $(PROD_BACKEND_IMAGE) ./backend
	docker build -t $(PROD_WEB_IMAGE) -f nginx/Dockerfile .
	BACKEND_IMAGE=$(PROD_BACKEND_IMAGE) WEB_IMAGE=$(PROD_WEB_IMAGE) $(COMPOSE) -f docker-compose.release.yml up -d

# Stop production-like stack
prod-down:
	BACKEND_IMAGE=$(PROD_BACKEND_IMAGE) WEB_IMAGE=$(PROD_WEB_IMAGE) $(COMPOSE) -f docker-compose.release.yml down

# Validate the release compose definition with sample production env values
release-config:
	BACKEND_IMAGE=example.com/bugboard/backend:local WEB_IMAGE=example.com/bugboard/web:local $(COMPOSE) --env-file env/production.example -f docker-compose.release.yml config >/dev/null
