package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"regexp"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	"github.com/hashicorp/go-hclog"
	"github.com/stretchr/testify/assert"
	"golang.org/x/net/context"
)

var basicDatasourceInfo = &datasource.DatasourceInfo{
	Id:       1,
	Name:     "TestDatasource",
	Url:      "sameUrl",
	JsonData: `{"username":"username", "password":"password"}}`,
}

func mockDataSourceRequest(modelJSON string) *datasource.DatasourceRequest {
	return &datasource.DatasourceRequest{
		Datasource: basicDatasourceInfo,
		Queries: []*datasource.Query{
			&datasource.Query{
				ModelJson: modelJSON,
			},
		},
	}
}

func mockZabbixAPIClient(t *testing.T, mockResponse MockResponse) ZabbixAPIInterface {
	testURL, _ := url.Parse("localhost:3306/zabbix")
	return &ZabbixAPIClient{
		datasource: &ZabbixDatasource{
			dsInfo: &datasource.DatasourceInfo{
				JsonData: "{}",
				DecryptedSecureJsonData: map[string]string{
					"username": "testUser",
					"password": "testSecret",
				},
			},
		},
		url:        testURL,
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
		httpClient: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: mockResponse.Status,
				Body:       ioutil.NopCloser(bytes.NewBufferString(mockResponse.Body)),
				Header:     make(http.Header),
			}
		}),
		authToken: "sampleAuthToken",
		logger:    hclog.Default(),
	}
}

func mockZabbixDatasource(t *testing.T, mockResponse MockResponse) ZabbixDatasource {
	return ZabbixDatasource{
		client: mockZabbixAPIClient(t, mockResponse),
		logger: hclog.Default(),
	}
}

type MockAPIRequestClient struct {
	ZabbixAPIInterface
	t              *testing.T
	expectedMethod string
	expectedParams ZabbixAPIParams
	mockResponse   string
	mockError      error
}

func (m *MockAPIRequestClient) APIRequest(ctx context.Context, method string, params ZabbixAPIParams) (result json.RawMessage, err error) {
	assert.Equal(m.t, m.expectedMethod, method)
	assert.Equal(m.t, m.expectedParams, params)
	if m.mockError != nil {
		return nil, m.mockError
	}

	return []byte(m.mockResponse), nil
}

func TestZabbixDatasource_ZabbixAPIQuery(t *testing.T) {
	type args struct {
		ctx     context.Context
		tsdbReq *datasource.DatasourceRequest
	}
	tests := []struct {
		name          string
		request       *datasource.DatasourceRequest
		expectedQuery queryRequest
		mockResponse  string
		mockError     error
		want          *datasource.DatasourceResponse
		wantErr       error
	}{
		{
			name:          "Basic Query",
			request:       mockDataSourceRequest(`{ "target": { "method": "test.get", "params": { "user": "test" } } }`),
			expectedQuery: queryRequest{Method: "test.get", Params: ZabbixAPIParams{User: "test"}},
			mockResponse:  `"testResponse"`,
			want: &datasource.DatasourceResponse{
				Results: []*datasource.QueryResult{
					&datasource.QueryResult{
						RefId:    "zabbixAPI",
						MetaJson: `"testResponse"`,
					},
				},
			},
		},
		{
			name:    "Empty Query",
			request: mockDataSourceRequest(``),
			wantErr: fmt.Errorf("unexpected end of JSON input"),
		},
		{
			name: "No Query",
			request: &datasource.DatasourceRequest{
				Queries: []*datasource.Query{},
			},
			wantErr: fmt.Errorf("At least one query should be provided"),
		},
		{
			name:          "Error",
			request:       mockDataSourceRequest(`{ "target": { "method": "test.get", "params": { "user": "test" } } }`),
			expectedQuery: queryRequest{Method: "test.get", Params: ZabbixAPIParams{User: "test"}},
			mockError:     fmt.Errorf("Test error"),
			wantErr:       fmt.Errorf("Error in direct query: Test error"),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := &ZabbixDatasource{
				client: &MockAPIRequestClient{
					t:              t,
					expectedMethod: tt.expectedQuery.Method,
					expectedParams: tt.expectedQuery.Params,
					mockResponse:   tt.mockResponse,
					mockError:      tt.mockError,
				},
				logger: hclog.Default(),
				hash:   "testhash",
			}

			got, err := ds.ZabbixAPIQuery(context.Background(), tt.request)

			if tt.wantErr != nil {
				assert.EqualError(t, err, tt.wantErr.Error())
				return
			}

			if assert.NoError(t, err) {
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestZabbixDatasource_TestConnection(t *testing.T) {
	ds := &ZabbixDatasource{
		client: &MockAPIRequestClient{
			t:              t,
			expectedMethod: "apiinfo.version",
			expectedParams: ZabbixAPIParams{},
			mockResponse:   `"4.0.0"`,
		},
		logger: hclog.Default(),
		hash:   "testhash",
	}

	resp, err := ds.TestConnection(context.Background())

	if assert.NoError(t, err) {
		assert.Equal(t, `{"zabbixVersion":"4.0.0","dbConnectorStatus":null}`, resp.Results[0].GetMetaJson())
	}
}

func TestZabbixDatasource_TestConnectionError(t *testing.T) {
	ds := &ZabbixDatasource{
		client: &MockAPIRequestClient{
			t:              t,
			expectedMethod: "apiinfo.version",
			expectedParams: ZabbixAPIParams{},
			mockError:      fmt.Errorf("Test connection error"),
		},
		logger: hclog.Default(),
		hash:   "testhash",
	}

	resp, err := ds.TestConnection(context.Background())

	if assert.NoError(t, err) {
		assert.Equal(t, "", resp.Results[0].GetMetaJson())
		assert.Equal(t, "Version check failed: Test connection error", resp.Results[0].GetError())
	}
}

func TestZabbixDatasource_TestConnectionBadResponse(t *testing.T) {
	ds := &ZabbixDatasource{
		client: &MockAPIRequestClient{
			t:              t,
			expectedMethod: "apiinfo.version",
			expectedParams: ZabbixAPIParams{},
			mockResponse:   `invalid json`,
		},
		logger: hclog.Default(),
		hash:   "testhash",
	}

	resp, err := ds.TestConnection(context.Background())

	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.EqualError(t, err, "Internal error while parsing response from Zabbix")
}

func Test_parseFilter(t *testing.T) {
	tests := []struct {
		name    string
		filter  string
		want    *regexp.Regexp
		wantErr string
	}{
		{
			name:   "Non-regex filter",
			filter: "foobar",
			want:   nil,
		},
		{
			name:   "Non-regex filter (would-be invalid regex)",
			filter: "fooba(r",
			want:   nil,
		},
		{
			name:   "Regex filter",
			filter: "/^foo.+/",
			want:   regexp.MustCompile("^foo.+"),
		},
		{
			name:   "Regex filter with flags",
			filter: "/^foo.+/s",
			want:   regexp.MustCompile("(?s)^foo.+"),
		},
		{
			name:    "Invalid regex",
			filter:  "/fooba(r/",
			wantErr: "error parsing regexp: missing closing ): `fooba(r`",
		},
		{
			name:    "Unsupported flag",
			filter:  "/foo.+/z",
			wantErr: "error parsing regexp: unsupported flags `z` (expected [imsU])",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseFilter(tt.filter)

			if tt.wantErr != "" {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.wantErr)
				assert.Nil(t, got)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetGroups(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "name": "groupname1"},{"groupid": "46489127", "name":"groupname2"}]}`})
	resp, err := mockZabbixDatasource.getGroups(context.Background(), "groupname1")

	assert.NoError(t, err)
	assert.Equal(t, "46489126", resp[0].ID)
	assert.Equal(t, "groupname1", resp[0].Name)
}

func TestGetGroupsRegexFilter(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "name": "groupname1"},{"groupid": "46489127", "name":"groupname2"}]}`})
	resp, err := mockZabbixDatasource.getGroups(context.Background(), "/group(.*)/")

	assert.NoError(t, err)
	assert.Equal(t, "groupname1", resp[0].Name)
	assert.Equal(t, "groupname2", resp[1].Name)
}

func TestGetGroupsRegexFilterWithFlags(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "name": "groupname1"},{"groupid": "46489127", "name":"groupname2"}]}`})
	resp, err := mockZabbixDatasource.getGroups(context.Background(), "/GROUP(.*)/i")

	assert.NoError(t, err)
	assert.Equal(t, "groupname1", resp[0].Name)
	assert.Equal(t, "groupname2", resp[1].Name)
}

func TestGetGroupsError(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockZabbixDatasource.getGroups(context.Background(), "groupname1")

	assert.Error(t, err)
	assert.Nil(t, resp)
}

func TestGetHosts(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "name": "hostname1"},{"groupid": "46489127", "hostid": "346522", "name": "hostname2"}]}`})
	resp, err := mockZabbixDatasource.getHosts(context.Background(), "groupname1", "hostname1")

	assert.Equal(t, "764522", resp[0].ID)
	assert.Equal(t, "hostname1", resp[0].Name)
	assert.Nil(t, err)
}

func TestGetHostsRegexFilter(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "name": "hostname1"},{"groupid": "46489127", "hostid": "346522", "name": "hostname2"}]}`})
	resp, err := mockZabbixDatasource.getHosts(context.Background(), "/group(.*)/", "/host(.*)/")

	assert.Equal(t, "hostname1", resp[0].Name)
	assert.Equal(t, "hostname2", resp[1].Name)
	assert.Nil(t, err)
}

func TestGetHostsRegexFilterWithFlags(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "name": "hostname1"},{"groupid": "46489127", "hostid": "346522", "name": "hostname2"}]}`})
	resp, err := mockZabbixDatasource.getHosts(context.Background(), "/GROUP(.*)/i", "/HOST(.*)/i")

	assert.Equal(t, "hostname1", resp[0].Name)
	assert.Equal(t, "hostname2", resp[1].Name)
	assert.Nil(t, err)
}

func TestGetHostsError(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockZabbixDatasource.getHosts(context.Background(), "groupname1", "hostname1")

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetApps(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "applicationid": "7343656", "name": "appname1"},
	{"groupid": "46489127", "hostid": "346522", "applicationid": "7354687", "name": "appname2"}]}`})
	resp, err := mockZabbixDatasource.getApps(context.Background(), []string{"764522", "346522"}, "appname1")

	assert.Equal(t, "7343656", resp[0].ID)
	assert.Equal(t, "appname1", resp[0].Name)
	assert.Nil(t, err)
}

func TestGetAppsRegexFilter(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "applicationid": "7343656", "name": "appname1"},
	{"groupid": "46489127", "hostid": "346522", "applicationid": "7354687", "name": "appname2"}]}`})
	resp, err := mockZabbixDatasource.getApps(context.Background(), []string{"764522", "346522"}, "/app(.*)/")

	assert.Equal(t, "appname1", resp[0].Name)
	assert.Equal(t, "appname2", resp[1].Name)
	assert.Nil(t, err)
}

func TestGetAppsRegexFilterWithFlags(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "applicationid": "7343656", "name": "appname1"},
	{"groupid": "46489127", "hostid": "346522", "applicationid": "7354687", "name": "appname2"}]}`})
	resp, err := mockZabbixDatasource.getApps(context.Background(), []string{"764522", "346522"}, "/APP(.*)/i")

	assert.Equal(t, "appname1", resp[0].Name)
	assert.Equal(t, "appname2", resp[1].Name)
	assert.Nil(t, err)
}

func TestGetAppsError(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockZabbixDatasource.getApps(context.Background(), []string{"764522", "346522"}, "appname1")

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetItems(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "applicationid": "7343656", "itemid": "7463587", "name": "itemname1", "status" : "0"},
	{"groupid": "46489127", "hostid": "346522", "applicationid": "7354687", "itemid": "8723443", "name": "itemname2", "status" : "0"}]}`})
	resp, err := mockZabbixDatasource.getItems(context.Background(), "groupname1", "hostname1", "appname1", "itemname1", "num")

	assert.Equal(t, "7463587", resp[0].ID)
	assert.Equal(t, "itemname1", resp[0].Name)
	assert.Nil(t, err)
}

func TestGetItemsRegexFilter(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "applicationid": "7343656", "itemid": "7463587", "name": "itemname1", "status" : "0"},
	{"groupid": "46489127", "hostid": "346522", "applicationid": "7354687", "itemid": "8723443", "name": "itemname2", "status" : "0"}]}`})
	resp, err := mockZabbixDatasource.getItems(context.Background(), "/group(.*)/", "/host(.*)/", "/app(.*)/", "/item(.*)/", "num")

	assert.Equal(t, "itemname1", resp[0].Name)
	assert.Equal(t, "itemname2", resp[1].Name)
	assert.Nil(t, err)
}

func TestGetItemsRegexFilterWithFlags(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "hostid": "764522", "applicationid": "7343656", "itemid": "7463587", "name": "itemname1", "status" : "0"},
	{"groupid": "46489127", "hostid": "346522", "applicationid": "7354687", "itemid": "8723443", "name": "itemname2", "status" : "0"}]}`})
	resp, err := mockZabbixDatasource.getItems(context.Background(), "/GROUP(.*)/i", "/HOST(.*)/i", "/APP(.*)/i", "/ITEM(.*)/i", "num")

	assert.Equal(t, "itemname1", resp[0].Name)
	assert.Equal(t, "itemname2", resp[1].Name)
	assert.Nil(t, err)
}

func TestGetItemsError(t *testing.T) {
	mockZabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockZabbixDatasource.getItems(context.Background(), "groupname1", "hostname1", "appname1", "itemname", "num")

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetTrendValueTypeDefault(t *testing.T) {
	zabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: ``})
	resp := zabbixDatasource.getTrendValueType(&TargetModel{})

	assert.Equal(t, "avg", resp)
}

func TestGetConsolidateBy(t *testing.T) {
	zabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: ``})
	query := &TargetModel{
		Functions: []TargetFunction{
			TargetFunction{
				Def: TargetFunctionDefinition{
					Name: "consolidateBy",
				},
				Params: []string{"sum", "avg", "min", "max"},
			},
		},
	}
	resp := zabbixDatasource.getConsolidateBy(query)

	assert.Equal(t, "sum", resp)
}

func TestGetConsolidateByEmpty(t *testing.T) {
	zabbixDatasource := mockZabbixDatasource(t, MockResponse{Status: 200, Body: ``})
	resp := zabbixDatasource.getConsolidateBy(&TargetModel{})

	assert.Equal(t, "", resp)
}

func TestConvertHistoy(t *testing.T) {
	mockItems := zabbix.Items{
		zabbix.Item{
			ID:   "83745689",
			Name: "testItem",
			Hosts: []zabbix.ItemHost{
				zabbix.ItemHost{
					Name: "testHost",
				},
			},
		},
	}
	mockHistory := zabbix.History{
		zabbix.HistoryPoint{
			ItemID: "83745689",
			Value:  1,
		},
		zabbix.HistoryPoint{
			ItemID: "83745689",
			Value:  100,
		},
	}
	resp := convertHistory(mockHistory, mockItems)

	assert.Equal(t, "name:\"testHost testItem\" points:<value:1 > points:<value:100 > ", resp[0].String())
}

func TestConvertTrend(t *testing.T) {
	mockItems := zabbix.Items{
		zabbix.Item{
			ID:   "83745689",
			Name: "testItem",
			Hosts: []zabbix.ItemHost{
				zabbix.ItemHost{
					Name: "testHost",
				},
			},
		},
	}
	mockTrend := zabbix.Trend{
		zabbix.TrendPoint{
			ItemID:   "83745689",
			ValueMin: 1,
			ValueAvg: 50,
			ValueMax: 100,
		},
		zabbix.TrendPoint{
			ItemID:   "83745689",
			ValueMin: 0.1,
			ValueAvg: 0.5,
			ValueMax: 1.0,
		},
	}
	resp := convertTrend(mockTrend, mockItems, "avg")

	assert.Equal(t, "name:\"testHost testItem\" points:<value:50 > points:<value:0.5 > ", resp[0].String())
}

func Test_isUseTrend(t *testing.T) {
	tests := []struct {
		name      string
		timeRange *datasource.TimeRange
		want      bool
	}{
		{
			name: "History time",
			timeRange: &datasource.TimeRange{
				FromEpochMs: time.Now().Add(-time.Hour*48).Unix() * 1000,
				ToEpochMs:   time.Now().Add(-time.Hour*12).Unix() * 1000,
			},
			want: false,
		},
		{
			name: "Trend time (past 7 days)",
			timeRange: &datasource.TimeRange{
				FromEpochMs: time.Now().Add(-time.Hour*24*14).Unix() * 1000,
				ToEpochMs:   time.Now().Add(-time.Hour*24*13).Unix() * 1000,
			},
			want: true,
		},
		{
			name: "Trend time (longer than 4 days)",
			timeRange: &datasource.TimeRange{
				FromEpochMs: time.Now().Add(-time.Hour*24*8).Unix() * 1000,
				ToEpochMs:   time.Now().Add(-time.Hour*24*1).Unix() * 1000,
			},
			want: true,
		},
	}
	for _, tt := range tests {
		got := isUseTrend(tt.timeRange)
		assert.Equal(t, tt.want, got, tt.name, tt.timeRange)
	}

}
