all: frontend backend

frontend:
	yarn dev-build

backend:
	go build -o ./dist/zabbix-plugin_linux_amd64 ./pkg
