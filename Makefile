# Wapify Build System

BINARY_NAME=wapify-server
BACKEND_DIR=backend
DESKTOP_DIR=apps/desktop

.PHONY: help build-backend build-client build-docker-client keygen license build-desktop run-client

help:
	@echo "Wapify Commands:"
	@echo "  make build-backend        - Build internal server"
	@echo "  make build-client         - Build client binary (needs PUB_KEY)"
	@echo "  make build-docker-client  - Build docker image (needs PUB_KEY, TAG)"
	@echo "  make keygen               - Generate keypair"
	@echo "  make license              - Generate license (needs NAME, EMAIL, DURATION)"
	@echo "  make build-desktop        - Build Electron app"
	@echo "  make run-client           - Run client in docker (needs TAG, LICENSE_KEY, DB_HOST)"

build-backend:
	cd $(BACKEND_DIR) && go build -o ../$(BINARY_NAME) cmd/server/main.go

build-client:
	cd $(BACKEND_DIR) && go build -ldflags="-X main.LicensePublicKey=$(PUB_KEY)" -o ../$(BINARY_NAME)-client cmd/server/main.go

build-docker-client:
	cd $(BACKEND_DIR) && docker build --platform linux/amd64 --build-arg LICENSE_PUBLIC_KEY=$(PUB_KEY) -t abdullahprasetio/wapify-backend-client:$(TAG) -f Dockerfile.client .

keygen:
	cd $(BACKEND_DIR) && go run cmd/license/main.go keygen

license:
	cd $(BACKEND_DIR) && go run cmd/license/main.go generate --name "$(NAME)" --email "$(EMAIL)" --duration "$(DURATION)"

build-desktop:
	cp $(DESKTOP_DIR)/resources/icon.png $(DESKTOP_DIR)/build/icon.png
	cp $(DESKTOP_DIR)/resources/icon.ico $(DESKTOP_DIR)/build/icon.ico
	cd $(DESKTOP_DIR) && npm run build && npx electron-builder --mac --win --linux

run-client:
	docker run -d -p 8000:8000 \
		-e DB_HOST=$(DB_HOST) \
		-e DB_PORT=5432 \
		-e DB_USER=temancode \
		-e PORT=8000 \
		-e DB_NAME=wapify \
		-e LICENSE_KEY=$(LICENSE_KEY) \
		abdullahprasetio/wapify-backend-client:$(TAG)
