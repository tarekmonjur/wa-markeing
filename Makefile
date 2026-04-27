.PHONY: dev down clean rebuild logs logs-backend logs-frontend logs-sm \
       migrate seed test test-cov test-e2e \
       prod prod-down prod-rebuild prod-logs \
       infra ps shell-backend shell-frontend shell-sm

# ==============================================================================
# Development (docker-compose.yml) — live reload enabled
# ==============================================================================

dev: ## Start full dev stack with live reload
	docker compose up

dev-build: ## Start full dev stack in background
	docker compose up --build

down: ## Stop all dev containers
	docker compose down

clean: ## Stop dev containers + remove all volumes (full data reset)
	docker compose down -v

rebuild: ## Rebuild all images from scratch and start
	docker compose up --build --force-recreate

logs: ## Tail logs from all services
	docker compose logs -f

logs-backend: ## Tail backend logs only
	docker compose logs -f backend

logs-frontend: ## Tail frontend logs only
	docker compose logs -f frontend

logs-sm: ## Tail session-manager logs only
	docker compose logs -f session-manager

ps: ## Show running containers and their status
	docker compose ps

# ==============================================================================
# Database
# ==============================================================================

migrate: ## Run pending migrations + seed on running dev stack
	docker compose exec backend npm run migration:run
	docker compose exec backend npm run seed

seed: ## Run seed data only (idempotent)
	docker compose exec backend npm run seed

# ==============================================================================
# Testing (runs inside backend container)
# ==============================================================================

test: ## Run backend unit tests
	docker compose exec backend npm run test

test-cov: ## Run backend unit tests with coverage
	docker compose exec backend npm run test:cov

test-e2e: ## Run backend E2E tests
	docker compose exec backend npm run test:e2e

# ==============================================================================
# Shell access
# ==============================================================================

shell-backend: ## Open a shell inside the backend container
	docker compose exec backend sh

shell-frontend: ## Open a shell inside the frontend container
	docker compose exec frontend sh

shell-sm: ## Open a shell inside the session-manager container
	docker compose exec session-manager sh

# ==============================================================================
# Infrastructure only (for running apps natively)
# ==============================================================================

infra: ## Start only postgres, redis, minio (background)
	docker compose up postgres redis minio minio-init -d

infra-down: ## Stop infrastructure
	docker compose down

# ==============================================================================
# Production (docker-compose.prod.yml)
# ==============================================================================

prod: ## Start production stack
	docker compose -f docker-compose.prod.yml up --build -d

prod-down: ## Stop production stack
	docker compose -f docker-compose.prod.yml down

prod-rebuild: ## Rebuild production images from scratch
	docker compose -f docker-compose.prod.yml up --build --force-recreate -d

prod-logs: ## Tail production logs
	docker compose -f docker-compose.prod.yml logs -f

prod-ps: ## Show production container status
	docker compose -f docker-compose.prod.yml ps

# ==============================================================================
# Help
# ==============================================================================

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
