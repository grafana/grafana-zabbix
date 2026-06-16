all: install build test lint

# Install dependencies
install:
	# Frontend
	yarn install --pure-lockfile
	# Backend
	go install -v ./pkg/
	go install golang.org/x/lint/golint@latest

deps-go:
	go install -v ./pkg/

build: build-frontend build-backend
build-frontend:
	yarn build

build-backend:
	mage -v build:backend
build-debug:
	mage -v build:debug

run-frontend:
	yarn install --pure-lockfile
	yarn dev

run-backend:
	# Rebuilds plugin on changes and kill running instance which forces grafana to restart plugin
	# See .bra.toml for bra configuration details
	bra run

# Build plugin for all platforms (ready for distribution)
dist: dist-frontend dist-backend
dist-frontend:
	yarn build

dist-backend: dist-backend-mage dist-backend-freebsd dist-arm-freebsd-arm64
dist-backend-mage:
	mage -v buildAll
dist-backend-windows: extension = .exe
dist-backend-%:
	$(eval filename = gpx_zabbix-plugin_$*_amd64$(extension))
	env CGO_ENABLED=0 GOOS=$* GOARCH=amd64 go build -ldflags="-s -w" -o ./dist/$(filename) ./pkg

# ARM
dist-arm: dist-arm-linux-arm-v6 dist-arm-linux-arm64 dist-arm-darwin-arm64 dist-arm-freebsd-arm64
dist-arm-linux-arm-v6:
	env CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=6 go build -ldflags="-s -w" -o ./dist/gpx_zabbix-plugin_linux_arm ./pkg
dist-arm-linux-arm-v7:
	env CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s -w" -o ./dist/gpx_zabbix-plugin_linux_arm ./pkg
dist-arm-%-arm64:
	$(eval filename = gpx_zabbix-plugin_$*_arm64$(extension))
	env CGO_ENABLED=0 GOOS=$* GOARCH=arm64 go build -ldflags="-s -w" -o ./dist/$(filename) ./pkg

.PHONY: test
test: test-frontend test-backend
test-frontend:
	yarn test
test-backend:
	go test ./pkg/...
test-ci:
	yarn ci-test
	mkdir -p tmp/coverage/golang/
	go test -race -coverprofile=tmp/coverage/golang/coverage.txt -covermode=atomic ./pkg/...

.PHONY: clean
clean:
	-rm -r ./dist/

.PHONY: lint
lint:
	yarn lint
	golint -min_confidence=1.1 -set_exit_status pkg/...

sign-package:
	yarn sign

package: install dist sign-package

zip:
	cp -r dist/ alexanderzobnin-zabbix-app
	zip -r alexanderzobnin-zabbix-app.zip alexanderzobnin-zabbix-app
	rm -rf alexanderzobnin-zabbix-app
