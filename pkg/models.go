package main

type connectionTestResponse struct {
	ZabbixVersion     string              `json:"zabbixVersion"`
	DbConnectorStatus *dbConnectionStatus `json:"dbConnectorStatus"`
}

type dbConnectionStatus struct {
	DsType string `json:"dsType"`
	DsName string `json:"dsName"`
}
