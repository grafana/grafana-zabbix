package zabbix

import (
	"encoding/json"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func convertTo(value *simplejson.Json, result interface{}) error {
	valueJSON, err := value.MarshalJSON()
	if err != nil {
		return err
	}

	err = json.Unmarshal(valueJSON, result)
	if err != nil {
		backend.Logger.Debug("Error unmarshalling JSON", "error", err, "result", result)
		return err
	}

	return nil
}
