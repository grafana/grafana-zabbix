all: install build test lint

# Install dependencies
install:
	# Frontend
	yarn install --pure-lockfile
	# Backend
	go mod vendor
	GO111MODULE=off go get -u golang.org/x/lint/golint

build: build-frontend build-backend
build-frontend:
	yarn dev-build
build-backend:
	env GOOS=linux go build -mod=vendor -o ./dist/zabbix-plugin_linux_amd64 ./pkg

dist: dist-frontend dist-backend
dist-frontend:
	yarn build
dist-backend: dist-backend-linux dist-backend-darwin dist-backend-windows
dist-backend-windows: extension = .exe
dist-backend-%:
	$(eval filename = zabbix-plugin_$*_amd64$(extension))
	env GOOS=$* GOARCH=amd64 go build -ldflags="-s -w" -mod=vendor -o ./dist/$(filename) ./pkg

.PHONY: test
test: test-frontend test-backend
test-frontend:
	yarn test
test-backend:
	go test -v -mod=vendor ./pkg/...
test-ci:
	yarn ci-test
	mkdir -p tmp/coverage/golang/
	go test -race -coverprofile=tmp/coverage/golang/coverage.txt -covermode=atomic -mod=vendor ./pkg/...

.PHONY: clean
clean:
	-rm -r ./dist/

.PHONY: lint
lint:
	yarn lint
	golint -set_exit_status pkg/...
