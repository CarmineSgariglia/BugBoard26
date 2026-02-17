SHELL := /bin/sh
COMPOSE := docker-compose

.PHONY: backend frontend all stop logs shell-backend shell-frontend migrate

# Nota: la riga sotto deve iniziare con un TAB
backend:
	$(COMPOSE) down
	$(COMPOSE) build backend
	$(COMPOSE) up -d backend

frontend:
	$(COMPOSE) down
	$(COMPOSE) build frontend
	$(COMPOSE) up -d frontend

all:
	$(COMPOSE) down
	docker system prune -f
	$(COMPOSE) build backend
	$(COMPOSE) build frontend
	$(COMPOSE) up -d

migrate:
	$(COMPOSE) exec backend python manage.py migrate

stop:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs --tail=50 --follow

shell-backend:
	$(COMPOSE) exec backend sh

shell-frontend:
	$(COMPOSE) exec frontend sh
