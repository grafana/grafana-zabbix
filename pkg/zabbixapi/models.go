package zabbixapi

type ZabbixAPIRequest struct {
	Method string          `json:"method"`
	Params ZabbixAPIParams `json:"params,omitempty"`
}

type ZabbixAPIParams = map[string]interface{}
