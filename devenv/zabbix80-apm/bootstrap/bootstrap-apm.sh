#!/bin/sh
# One-shot APM bootstrap for the Zabbix 8.0 devenv:
# - registers the active proxy "apm-proxy-1" with APM collection enabled
# - points the global APM data source (Administration > Data source) at ClickHouse
# Uses busybox wget only, so it can run in any of the stack's Alpine images.
set -eu

API_URL="${ZBX_API_URL:-http://zabbix-web:8080}/api_jsonrpc.php"
PROXY_NAME="${ZBX_APM_PROXY_NAME:-apm-proxy-1}"
CH_URL="${ZBX_APM_CH_URL:-http://clickhouse:8123}"
CH_DB="${ZBX_APM_CH_DB:-zabbix}"
CH_USER="${ZBX_APM_CH_USER:-zabbix}"
CH_PASSWORD="${ZBX_APM_CH_PASSWORD:-zabbix}"

api() {
  # $1 = JSON-RPC body; auth via bearer token when $TOKEN is set
  if [ -n "${TOKEN:-}" ]; then
    wget -qO- --header 'Content-Type: application/json' --header "Authorization: Bearer $TOKEN" --post-data "$1" "$API_URL"
  else
    wget -qO- --header 'Content-Type: application/json' --post-data "$1" "$API_URL"
  fi
}

echo "Waiting for the Zabbix API at $API_URL..."
until api '{"jsonrpc":"2.0","method":"apiinfo.version","params":{},"id":1}' | grep -q '"result"'; do
  sleep 3
done

echo "Logging in..."
TOKEN=$(api '{"jsonrpc":"2.0","method":"user.login","params":{"username":"Admin","password":"zabbix"},"id":1}' |
  sed -n 's/.*"result":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "ERROR: could not log in to the Zabbix API" >&2
  exit 1
fi

echo "Registering APM proxy '$PROXY_NAME' (active mode, APM collection enabled)..."
CREATE_RESULT=$(api "{\"jsonrpc\":\"2.0\",\"method\":\"proxy.create\",\"params\":{\"name\":\"$PROXY_NAME\",\"operating_mode\":0,\"apm\":{\"data_collection_status\":1,\"max_messages_per_second\":10000}},\"id\":2}")
if echo "$CREATE_RESULT" | grep -q '"error"'; then
  if echo "$CREATE_RESULT" | grep -q 'already exists'; then
    echo "Proxy already registered, enabling APM collection..."
    PROXYID=$(api "{\"jsonrpc\":\"2.0\",\"method\":\"proxy.get\",\"params\":{\"output\":[\"proxyid\"],\"filter\":{\"name\":\"$PROXY_NAME\"}},\"id\":3}" |
      sed -n 's/.*"proxyid":"\([0-9]*\)".*/\1/p')
    api "{\"jsonrpc\":\"2.0\",\"method\":\"proxy.update\",\"params\":{\"proxyid\":\"$PROXYID\",\"apm\":{\"data_collection_status\":1,\"max_messages_per_second\":10000}},\"id\":4}" >/dev/null
  else
    echo "ERROR: proxy.create failed: $CREATE_RESULT" >&2
    exit 1
  fi
fi

echo "Configuring the global APM data source (ClickHouse at $CH_URL, db $CH_DB)..."
# authentication_type: 0 = username/password, 1 = none
SETTINGS_RESULT=$(api "{\"jsonrpc\":\"2.0\",\"method\":\"settings.update\",\"params\":{\"apm_global_db\":{\"status\":1,\"url\":\"$CH_URL\",\"db\":\"$CH_DB\",\"authentication_type\":0,\"username\":\"$CH_USER\",\"password\":\"$CH_PASSWORD\"}},\"id\":5}")
if echo "$SETTINGS_RESULT" | grep -q '"error"'; then
  echo "ERROR: settings.update failed: $SETTINGS_RESULT" >&2
  exit 1
fi

echo "APM bootstrap done."
