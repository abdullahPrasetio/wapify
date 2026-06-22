APP     = license-server
IMAGE   = wapbolt-license-server
PORT   ?= 9100

.PHONY: run build docker-build docker-run docker-stop clean tidy

run:
	go run .

build:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o $(APP) .

tidy:
	go mod tidy

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run -d \
		--name wapbolt-license \
		-p $(PORT):$(PORT) \
		--env-file .env \
		$(IMAGE)

docker-stop:
	docker stop wapbolt-license && docker rm wapbolt-license

clean:
	rm -f $(APP)
