package main

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/stretchr/testify/assert"
	"golang.org/x/net/context"
)

type mockZabbixDatasource struct {
	ZabbixDatasource
}

type RoundTripFunc func(req *http.Request) *http.Response

func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

//NewTestClient returns *http.Client with Transport replaced to avoid making real calls
func NewTestClient(fn RoundTripFunc) *http.Client {
	return &http.Client{
		Transport: RoundTripFunc(fn),
	}
}

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

var mockDataSource = mockZabbixDatasource{
	ZabbixDatasource{
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
		httpClient: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: 200,
				Body:       ioutil.NopCloser(bytes.NewBufferString(`{"result":"sampleResult"}`)),
				Header:     make(http.Header),
			}
		}),
		authToken: "sampleAuthToken",
		logger:    hclog.Default(),
	},
}

var mockDataSourceError = mockZabbixDatasource{
	ZabbixDatasource{
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
		httpClient: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: 500,
				Body:       ioutil.NopCloser(bytes.NewBufferString(`{"result":"sampleResult"}`)),
				Header:     make(http.Header),
			}
		}),
		authToken: "sampleAuthToken",
		logger:    hclog.Default(),
	},
}

func TestZabbixAPIQuery(t *testing.T) {
	resp, err := mockDataSource.ZabbixAPIQuery(context.Background(), mockDataSourceRequest(`{"target":{"method":"Method","params":{"param1" : "Param1"}}}`))

	assert.Equal(t, "\"sampleResult\"", resp.GetResults()[0].GetMetaJson())
	assert.Equal(t, "zabbixAPI", resp.GetResults()[0].GetRefId())
	assert.Nil(t, err)
}

func TestZabbixAPIQueryEmptyQuery(t *testing.T) {
	resp, err := mockDataSource.ZabbixAPIQuery(context.Background(), mockDataSourceRequest(``))

	assert.Nil(t, resp)
	assert.NotNil(t, err)
}

func TestZabbixAPIQueryNoQueries(t *testing.T) {
	basicDatasourceRequest := &datasource.DatasourceRequest{
		Datasource: &datasource.DatasourceInfo{
			Id:   1,
			Name: "TestDatasource",
		},
	}
	resp, err := mockDataSource.ZabbixAPIQuery(context.Background(), basicDatasourceRequest)

	assert.Nil(t, resp)
	assert.Equal(t, "At least one query should be provided", err.Error())
}

func TestZabbixAPIQueryError(t *testing.T) {
	resp, err := mockDataSourceError.ZabbixAPIQuery(context.Background(), mockDataSourceRequest(`{"target":{"method":"Method","params":{"param1" : "Param1"}}}`))

	assert.Nil(t, resp)
	assert.Equal(t, "ZabbixAPIQuery is not implemented yet", err.Error())
}

func TestLogin(t *testing.T) {
	resp, err := mockDataSource.login(context.Background(), "apiURL", "username", "password")

	assert.Equal(t, "sampleResult", resp)
	assert.Nil(t, err)
}

func TestLoginError(t *testing.T) {
	resp, err := mockDataSourceError.login(context.Background(), "apiURL", "username", "password")

	assert.Equal(t, "", resp)
	assert.NotNil(t, err)
}

func TestLoginWithDs(t *testing.T) {
	resp, err := mockDataSource.loginWithDs(context.Background(), basicDatasourceInfo)

	assert.Equal(t, "sampleResult", resp)
	assert.Nil(t, err)
}

func TestLoginWithDsError(t *testing.T) {
	resp, err := mockDataSourceError.loginWithDs(context.Background(), basicDatasourceInfo)

	assert.Equal(t, "", resp)
	assert.NotNil(t, err)
}

func TestZabbixRequest(t *testing.T) {
	resp, err := mockDataSource.ZabbixRequest(context.Background(), basicDatasourceInfo, "method", make(map[string]interface{}))
	assert.Equal(t, "sampleResult", resp.MustString())
	assert.Nil(t, err)
}

func TestZabbixRequestWithNoAuthToken(t *testing.T) {
	var mockDataSource = mockZabbixDatasource{
		ZabbixDatasource{
			queryCache: NewCache(10*time.Minute, 10*time.Minute),
			httpClient: NewTestClient(func(req *http.Request) *http.Response {
				return &http.Response{
					StatusCode: 200,
					Body:       ioutil.NopCloser(bytes.NewBufferString(`{"result":"auth"}`)),
					Header:     make(http.Header),
				}
			}),
			logger: hclog.Default(),
		},
	}

	resp, err := mockDataSource.ZabbixRequest(context.Background(), basicDatasourceInfo, "method", make(map[string]interface{}))
	assert.Equal(t, "auth", resp.MustString())
	assert.Nil(t, err)
}

func TestZabbixRequestError(t *testing.T) {
	resp, err := mockDataSourceError.ZabbixRequest(context.Background(), basicDatasourceInfo, "method", make(map[string]interface{}))
	assert.Nil(t, resp)
	assert.NotNil(t, err)
}

func TestZabbixAPIRequest(t *testing.T) {
	resp, err := mockDataSource.zabbixAPIRequest(context.Background(), "apiURL", "item.get", make(map[string]interface{}), "auth")

	assert.Equal(t, "sampleResult", resp.MustString())
	assert.Nil(t, err)
}

func TestZabbixAPIRequestError(t *testing.T) {
	resp, err := mockDataSourceError.zabbixAPIRequest(context.Background(), "apiURL", "item.get", make(map[string]interface{}), "auth")

	assert.Nil(t, resp)
	assert.NotNil(t, err)
}

func TestTestConnection(t *testing.T) {
	resp, err := mockDataSource.TestConnection(context.Background(), mockDataSourceRequest(``))

	assert.Equal(t, "{\"zabbixVersion\":\"sampleResult\",\"dbConnectorStatus\":null}", resp.Results[0].GetMetaJson())
	assert.Nil(t, err)
}

func TestTestConnectionError(t *testing.T) {
	resp, err := mockDataSourceError.TestConnection(context.Background(), mockDataSourceRequest(``))

	assert.Equal(t, "", resp.Results[0].GetMetaJson())
	assert.NotNil(t, resp.Results[0].GetError())
	assert.Nil(t, err)
}

func TestIsNotAuthorized(t *testing.T) {
	testPositive := isNotAuthorized("Not authorised.")
	assert.True(t, testPositive)

	testNegative := isNotAuthorized("testNegative")
	assert.False(t, testNegative)
}

func TestHandleAPIResult(t *testing.T) {
	expectedResponse, err := handleAPIResult([]byte(`{"result":"sampleResult"}`))

	assert.Equal(t, "sampleResult", expectedResponse.MustString())
	assert.Nil(t, err)
}

func TestHandleAPIResultFormatError(t *testing.T) {
	expectedResponse, err := handleAPIResult([]byte(`{"result"::"sampleResult"}`))

	assert.NotNil(t, err)
	assert.Nil(t, expectedResponse)
}

func TestHandleAPIResultError(t *testing.T) {
	expectedResponse, err := handleAPIResult([]byte(`{"result":"sampleResult", "error":{"message":"Message", "data":"Data"}}`))

	assert.Equal(t, "Message Data", err.Error())
	assert.Nil(t, expectedResponse)
}
