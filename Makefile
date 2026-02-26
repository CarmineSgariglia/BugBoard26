SHELL := /bin/sh

COMPOSE := docker compose
COMPOSE_PROXY := docker compose --profile proxy

.PHONY: backend frontend all https https-down stop logs shell-backend shell-frontend

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
