# Wapbolt Build System

BINARY_NAME=wapbolt-server
BACKEND_DIR=backend
DESKTOP_DIR=apps/desktop

# Load environment variables from backend/.env
ifneq (,$(wildcard $(BACKEND_DIR)/.env))
    include $(BACKEND_DIR)/.env
    export
endif

DB_URL=postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable

.PHONY: help build-backend build-client build-docker-client keygen license build-desktop run-client build-landing migrate-up migrate-down

help:
	@echo "Wapbolt Commands:"
	@echo "  make build-backend        - Build internal server"
	@echo "  make build-client         - Build client binary (needs PUB_KEY)"
	@echo "  make build-docker-client  - Build docker image (needs PUB_KEY, TAG)"
	@echo "  make build-landing        - Build landing page docker image (needs TAG)"
	@echo "  make keygen               - Generate keypair"
	@echo "  make license              - Generate license (needs NAME, EMAIL, DURATION)"
	@echo "  make build-desktop        - Build Electron app"
	@echo "  make run-client           - Run client in docker (needs TAG, LICENSE_KEY, DB_HOST)"

build-backend:
	cd $(BACKEND_DIR) && go build -o ../$(BINARY_NAME) cmd/server/main.go

build-client:
	cd $(BACKEND_DIR) && go build -ldflags="-X main.LicensePublicKey=$(PUB_KEY)" -o ../$(BINARY_NAME)-client cmd/server/main.go

build-docker-client:
	cd $(BACKEND_DIR) && docker build --platform linux/amd64 --build-arg LICENSE_PUBLIC_KEY=$(PUB_KEY) -t abdullahprasetio/wapbolt-backend-client:$(TAG) -f Dockerfile.client .

build-landing-linux:
	cd apps/landing-page && docker build --platform linux/amd64 -t abdullahprasetio/wapbolt-landing:$(TAG) .

build-landing:
	cd apps/landing-page && docker build -t abdullahprasetio/wapbolt-landing:$(TAG) .

push-backend:
	docker push abdullahprasetio/wapbolt-backend-client:$(TAG)
	
push-landing:
	docker push abdullahprasetio/wapbolt-landing:$(TAG)

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
		-e DB_NAME=wapbolt \
		-e LICENSE_KEY=$(LICENSE_KEY) \
		abdullahprasetio/wapbolt-backend-client:$(TAG)

dev-backend:
	cd $(BACKEND_DIR) && go run cmd/server/main.go

test-backend:
	cd $(BACKEND_DIR) && go test -v ./... -cover

test-coverage:
	cd $(BACKEND_DIR) && go test -v ./... -coverprofile=coverage.out && go tool cover -html=coverage.out

create-tag:
	git tag $(TAG)

push-tag:
	git push origin $(TAG)

migrate-up:
	migrate -path $(BACKEND_DIR)/migrations -database "$(DB_URL)" up

migrate-down:
	migrate -path $(BACKEND_DIR)/migrations -database "$(DB_URL)" down

docker-tag-bri:
	docker tag abdullahprasetio/wapbolt-backend-client:$(TAG) new-nexus.bri.co.id/mcp/base/wapbolt-ocp:v$(TAG)

docker-push-bri:
	docker push new-nexus.bri.co.id/mcp/base/wapbolt-ocp:v$(TAG)
