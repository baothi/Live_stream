# ==========================================
# Makefile - AI Meeting Translator
# Cac lenh thuong dung
# ==========================================

.PHONY: help dev up down build logs restart clean test-api register login status mongo-shell

# Mau sac cho terminal
CYAN  := \033[36m
GREEN := \033[32m
YELLOW:= \033[33m
RED   := \033[31m
RESET := \033[0m

# ==========================================
# HELP - Hien thi tat ca lenh
# ==========================================
help: ## Hien thi menu nay
	@echo ""
	@echo "$(CYAN)===== AI Meeting Translator - Commands =====$(RESET)"
	@echo ""
	@echo "$(GREEN)--- Docker Commands ---$(RESET)"
	@echo "  make up            Start tat ca (backend + mongodb)"
	@echo "  make down          Dung tat ca containers"
	@echo "  make build         Build lai Docker image"
	@echo "  make restart       Restart backend"
	@echo "  make logs          Xem logs backend"
	@echo "  make logs-mongo    Xem logs mongodb"
	@echo "  make logs-all      Xem logs tat ca"
	@echo "  make clean         Xoa containers + volumes (RESET DB)"
	@echo ""
	@echo "$(GREEN)--- Local Dev Commands ---$(RESET)"
	@echo "  make dev           Chay backend local (npm run start:dev)"
	@echo "  make install       Cai dependencies"
	@echo "  make build-local   Build TypeScript local"
	@echo ""
	@echo "$(GREEN)--- Test API ---$(RESET)"
	@echo "  make test-api      Test server dang chay"
	@echo "  make register      Tao tai khoan test"
	@echo "  make login         Dang nhap tai khoan test"
	@echo "  make status        Xem trang thai containers"
	@echo ""
	@echo "$(GREEN)--- Database ---$(RESET)"
	@echo "  make mongo-shell   Mo MongoDB shell"
	@echo ""

# ==========================================
# DOCKER COMMANDS
# ==========================================
up: ## Start tat ca services
	@echo "$(GREEN)>>> Starting all services...$(RESET)"
	docker compose up -d
	@echo "$(GREEN)>>> Done! Backend: http://localhost:3000$(RESET)"

down: ## Dung tat ca
	@echo "$(YELLOW)>>> Stopping all services...$(RESET)"
	docker compose down

build: ## Build lai image
	@echo "$(CYAN)>>> Building Docker image...$(RESET)"
	docker compose build --no-cache

restart: ## Restart backend
	@echo "$(YELLOW)>>> Restarting backend...$(RESET)"
	docker compose restart backend

logs: ## Xem logs backend
	docker compose logs -f backend

logs-mongo: ## Xem logs mongodb
	docker compose logs -f mongodb

logs-all: ## Xem logs tat ca
	docker compose logs -f

clean: ## Xoa tat ca (CANH BAO: mat data DB)
	@echo "$(RED)>>> WARNING: Se xoa tat ca containers va database!$(RESET)"
	docker compose down -v --remove-orphans
	@echo "$(GREEN)>>> Cleaned!$(RESET)"

status: ## Xem trang thai containers
	docker compose ps

# ==========================================
# LOCAL DEV COMMANDS
# ==========================================
install: ## Cai dependencies
	npm install

build-local: ## Build TypeScript
	npx nest build

dev: ## Chay local dev mode
	@echo "$(GREEN)>>> Starting dev server...$(RESET)"
	npm run start:dev

# ==========================================
# TEST API
# ==========================================
test-api: ## Test server dang song
	@echo "$(CYAN)>>> Testing server...$(RESET)"
	@curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/ || echo "$(RED)Server khong phan hoi!$(RESET)"

register: ## Tao tai khoan test
	@echo "$(CYAN)>>> Creating test account...$(RESET)"
	@curl -s -X POST http://localhost:3000/auth/register \
		-H "Content-Type: application/json" \
		-d "{\"name\":\"Test User\",\"email\":\"test@gmail.com\",\"password\":\"123456\"}" | python -m json.tool 2>/dev/null || \
	curl -s -X POST http://localhost:3000/auth/register \
		-H "Content-Type: application/json" \
		-d "{\"name\":\"Test User\",\"email\":\"test@gmail.com\",\"password\":\"123456\"}"

login: ## Dang nhap tai khoan test
	@echo "$(CYAN)>>> Logging in...$(RESET)"
	@curl -s -X POST http://localhost:3000/auth/login \
		-H "Content-Type: application/json" \
		-d "{\"email\":\"test@gmail.com\",\"password\":\"123456\"}" | python -m json.tool 2>/dev/null || \
	curl -s -X POST http://localhost:3000/auth/login \
		-H "Content-Type: application/json" \
		-d "{\"email\":\"test@gmail.com\",\"password\":\"123456\"}"

# ==========================================
# DATABASE
# ==========================================
mongo-shell: ## Mo MongoDB shell
	docker compose exec mongodb mongosh -u admin -p mongo_secret_123 ai-translator
