page_title: Run Grafana-Zabbix from master
page_description: Building instructions for Grafana-Zabbix.

# Run from master
If you want to build a package yourself, or contribute - here is a guide for how to do that.

### Dependencies

- NodeJS LTS

### Building plugin

```bash
npm install -g yarn
yarn install --pure-lockfile
yarn build
```

### To build plugin and rebuild on file change

```bash
yarn watch
```

### Run tests
```bash
yarn test
```

### Run tests on file change
```bash
yarn jest
```
