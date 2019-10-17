package main

type connectionTestResponse struct {
	ZabbixVersion     string             `json:"zabbixVersion"`
	DbConnectorStatus dbConnectionStatus `json:"dbConnectorStatus"`
}

type dbConnectionStatus struct {
	dsType string
	dsName string
}
