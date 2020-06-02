package zabbixapi

import "encoding/json"

type ZabbixAPIRequest struct {
	Method string          `json:"method"`
	Params ZabbixAPIParams `json:"params,omitempty"`
}

func (r *ZabbixAPIRequest) String() string {
	jsonRequest, _ := json.Marshal(r.Params)
	return r.Method + string(jsonRequest)
}

type ZabbixAPIParams = map[string]interface{}
