package dbconnector

type DBConnector struct {
	datasourceId		string
	datasourceName		string
	datasourceUID		string
	// TODO: maybe we also need the type here
}
const DefaultQueryLimit = 10000

var HistoryToTableMap = map[string]string{
	"0": "history",
	"1": "history_str",
	"2": "history_log",
	"3": "history_uint",
	"4": "history_text",
}

var TrendToTableMap = map[string]string{
	"0": "trends",
	"3": "trends_uint",
}

var ConsolidateByFunc = map[string]string{
	"avg":   "AVG",
	"min":   "MIN",
	"max":   "MAX",
	"sum":   "SUM",
	"count": "COUNT",
}

var ConsolidateByTrendColumns = map[string]string{
	"avg": "value_avg",
	"min": "value_min",
	"max": "value_max",
	"sum": "num*value_avg", // sum of sums inside the one-hour trend period
}

func NewDBConnector(datasourceID, datasourceName, datasourceUID string) *DBConnector {
	return &DBConnector {
		datasourceId: datasourceID,
		datasourceName: datasourceName,
		datasourceUID: datasourceUID,
	}
}
