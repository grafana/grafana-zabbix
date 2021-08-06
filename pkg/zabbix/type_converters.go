package zabbix

import (
	"encoding/json"

	"github.com/bitly/go-simplejson"
)

func convertTo(value *simplejson.Json, result interface{}) error {
	valueJSON, err := value.MarshalJSON()
	if err != nil {
		return err
	}

	err = json.Unmarshal(valueJSON, result)
	if err != nil {
		return err
	}

	return nil
}
