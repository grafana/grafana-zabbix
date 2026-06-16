package zabbixapi

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func normalizeParams(ctx context.Context, method string, params ZabbixAPIParams, version int) ZabbixAPIParams {
	logger := log.New().FromContext(ctx)
	logger.Debug("performing query params migration", "method", method, "version", version)
	switch method {
	case "trigger.get":
		newKey := "selectHostGroups"
		deprecatedKey := "selectGroups"
		deprecatedKeyValue, deprecatedKeyExists := params[deprecatedKey]
		newKeyValue, newKeyExists := params[newKey]
		if version < 70 && newKeyExists {
			if deprecatedKeyExists {
				delete(params, newKey)
			}
			if !deprecatedKeyExists {
				params[deprecatedKey] = newKeyValue
				delete(params, newKey)
			}
		}
		if version >= 70 && deprecatedKeyExists {
			if newKeyExists {
				delete(params, deprecatedKey)
			}
			if !newKeyExists {
				params[newKey] = deprecatedKeyValue
				delete(params, deprecatedKey)
			}
		}
	case "event.get":
		newKey := "selectAcknowledges"
		deprecatedKey := "select_acknowledges"
		deprecatedKeyValue, deprecatedKeyExists := params[deprecatedKey]
		newKeyValue, newKeyExists := params[newKey]
		if version < 70 && newKeyExists {
			if deprecatedKeyExists {
				delete(params, newKey)
			}
			if !deprecatedKeyExists {
				params[deprecatedKey] = newKeyValue
				delete(params, newKey)
			}
		}
		if version >= 70 && deprecatedKeyExists {
			if newKeyExists {
				delete(params, deprecatedKey)
			}
			if !newKeyExists {
				params[newKey] = deprecatedKeyValue
				delete(params, deprecatedKey)
			}
		}
	case "hostgroup.get":
		newKey := "with_hosts"
		deprecatedKey := "real_hosts"
		deprecatedKeyValue, deprecatedKeyExists := params[deprecatedKey]
		newKeyValue, newKeyExists := params[newKey]
		if version < 70 && newKeyExists {
			if deprecatedKeyExists {
				delete(params, newKey)
			}
			if !deprecatedKeyExists {
				params[deprecatedKey] = newKeyValue
				delete(params, newKey)
			}
		}
		if version >= 70 && deprecatedKeyExists {
			if newKeyExists {
				delete(params, deprecatedKey)
			}
			if !newKeyExists {
				params[newKey] = deprecatedKeyValue
				delete(params, deprecatedKey)
			}
		}
	}
	return params
}
