# Wapify - Multi-platform Build System

# Variables
BINARY_NAME=wapify-server
LICENSE_CLI=wapify-license
BACKEND_DIR=backend
DESKTOP_DIR=apps/desktop
PUB_KEY?=""

# Colors for terminal
BLUE=\033[0;34m
GREEN=\033[0;32m
NC=\033[0m

.PHONY: help build-backend build-backend-license build-license-cli build-desktop install-deps dev-backend dev-license-cli

help:
	@echo "$(BLUE)Wapify Development Tools$(NC)"
	@echo "Usage:"
	@echo "  make install-deps         - Install all dependencies (Go & Node.js)"
	@echo "  make dev-backend          - Run backend in development mode"
	@echo "  make build-backend        - Build backend binary (Open/Internal)"
	@echo "  make build-backend-license PUB_KEY=xxx - Build backend for client (Locked with Public Key)"
	@echo "  make build-license-cli    - Build the License CLI tool"
	@echo "  make generate-license     - Run license generator (CLI)"
	@echo "  make keygen               - Generate a new keypair (CLI)"
	@echo "  make build-desktop        - Build Electron application installers"

install-deps:
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	cd $(BACKEND_DIR) && go mod tidy
	@echo "$(BLUE)Installing desktop dependencies...$(NC)"
	cd $(DESKTOP_DIR) && npm install

# --- BACKEND COMMANDS ---

build-backend:
	@echo "$(GREEN)Building backend (Internal Mode)...$(NC)"
	cd $(BACKEND_DIR) && go build -o ../$(BINARY_NAME) cmd/server/main.go

build-backend-license:
	@if [ $(PUB_KEY) = "" ]; then echo "Error: PUB_KEY is required. Use 'make build-backend-license PUB_KEY=xxx'"; exit 1; fi
	@echo "$(GREEN)Building backend (Client Mode) with Public Key...$(NC)"
	cd $(BACKEND_DIR) && go build -ldflags="-X main.LicensePublicKey=$(PUB_KEY)" -o ../$(BINARY_NAME)-client cmd/server/main.go

dev-backend:
	cd $(BACKEND_DIR) && go run cmd/server/main.go

# --- LICENSE CLI COMMANDS ---

build-license-cli:
	@echo "$(GREEN)Building License CLI...$(NC)"
	cd $(BACKEND_DIR) && go build -o ../$(LICENSE_CLI) cmd/license/main.go

keygen:
	cd $(BACKEND_DIR) && go run cmd/license/main.go keygen

# Usage: make generate-license NAME="Client Name" EMAIL="email@test.com" DURATION="1year"
generate-license:
	@if [ "$(NAME)" = "" ] || [ "$(EMAIL)" = "" ]; then \
		echo "Usage: make generate-license NAME=\"Client Name\" EMAIL=\"email@test.com\" DURATION=\"1year\""; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && go run cmd/license/main.go generate --name "$(NAME)" --email "$(EMAIL)" --duration "$(DURATION)"

# --- DESKTOP COMMANDS ---

build-desktop:
	@echo "$(GREEN)Preparing icons...$(NC)"
	cp $(DESKTOP_DIR)/resources/icon.png $(DESKTOP_DIR)/build/icon.png
	cp $(DESKTOP_DIR)/resources/icon.ico $(DESKTOP_DIR)/build/icon.ico
	@echo "$(GREEN)Building Electron application for all platforms...$(NC)"
	cd $(DESKTOP_DIR) && npm run build && npx electron-builder --mac --win --linux
