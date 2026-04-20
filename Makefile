.PHONY: build-all build-linux build-mac build-windows build-stb

build-all: build-linux build-mac build-windows build-stb

build-linux:
	GOOS=linux GOARCH=amd64 go build -o bin/wapify-linux-amd64 backend/cmd/server/main.go
	GOOS=linux GOARCH=amd64 go build -o bin/wapify-admin-linux-amd64 backend/cmd/admin/main.go

build-mac:
	GOOS=darwin GOARCH=arm64 go build -o bin/wapify-darwin-arm64 backend/cmd/server/main.go
	GOOS=darwin GOARCH=arm64 go build -o bin/wapify-admin-darwin-arm64 backend/cmd/admin/main.go

build-windows:
	GOOS=windows GOARCH=amd64 go build -o bin/wapify-windows-amd64.exe backend/cmd/server/main.go
	GOOS=windows GOARCH=amd64 go build -o bin/wapify-admin-windows-amd64.exe backend/cmd/admin/main.go

# Build for Android STB
build-stb:
	GOOS=linux GOARCH=arm64 go build -o bin/wapify-stb-arm64 backend/cmd/server/main.go
	GOOS=linux GOARCH=arm64 go build -o bin/wapify-admin-stb-arm64 backend/cmd/admin/main.go

clean:
	rm -rf bin/
