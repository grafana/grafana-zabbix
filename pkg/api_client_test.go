package main

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/stretchr/testify/assert"
	"golang.org/x/net/context"
)

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

type MockResponse struct {
	Status int
	Body   string
}

var mockDataSource *ZabbixDatasource = &ZabbixDatasource{}

func NewMockZabbixAPIClient(t *testing.T, mockResponse MockResponse) ZabbixAPIClient {
	testURL, _ := url.Parse("localhost:3306/zabbix")
	return ZabbixAPIClient{
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

func TestAPIRequest(t *testing.T) {
	mockClient := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":"sampleResult"}`})
	resp, err := mockClient.APIRequest(context.Background(), "method", ZabbixAPIParams{})
	assert.NoError(t, err)
	assert.Equal(t, `"sampleResult"`, string(resp))
}

func TestAPIRequestWithNoAuthToken(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":"newAuth"}`})
	mockDataSource.authToken = ""

	resp, err := mockDataSource.APIRequest(context.Background(), "method", ZabbixAPIParams{})
	assert.NoError(t, err)
	assert.Equal(t, `"newAuth"`, string(resp))
}

func TestAPIRequestError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: `{"result":"sampleResult"}`})
	resp, err := mockDataSource.APIRequest(context.Background(), "method", ZabbixAPIParams{})

	assert.Nil(t, resp)
	assert.Error(t, err)
}

func TestLoginWithDs(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":"sampleResult"}`})
	err := mockDataSource.loginWithDs(context.Background())

	assert.Nil(t, err)
}

func TestLoginWithDsError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: `{"result":"sampleResult"}`})
	err := mockDataSource.loginWithDs(context.Background())

	assert.NotNil(t, err)
}

func TestLogin(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":"sampleResult"}`})
	resp, err := mockDataSource.login(context.Background(), "username", "password")

	assert.Equal(t, "sampleResult", resp)
	assert.Nil(t, err)
}

func TestLoginError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: `{"result":"sampleResult"}`})
	resp, err := mockDataSource.login(context.Background(), "username", "password")

	assert.Equal(t, "", resp)
	assert.NotNil(t, err)
}

func TestZabbixAPIRequest(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":"sampleResult"}`})
	resp, err := mockDataSource.zabbixAPIRequest(context.Background(), "item.get", ZabbixAPIParams{}, "auth")

	assert.Equal(t, `"sampleResult"`, string(resp))
	assert.Nil(t, err)
}

func TestZabbixAPIRequestError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: `{"result":"sampleResult"}`})
	resp, err := mockDataSource.zabbixAPIRequest(context.Background(), "item.get", ZabbixAPIParams{}, "auth")

	assert.Nil(t, resp)
	assert.NotNil(t, err)
}

func TestHandleAPIResult(t *testing.T) {
	expectedResponse, err := handleAPIResult([]byte(`{"result":"sampleResult"}`))

	assert.Equal(t, `"sampleResult"`, string(expectedResponse))
	assert.Nil(t, err)
}

func TestHandleAPIResultFormatError(t *testing.T) {
	expectedResponse, err := handleAPIResult([]byte(`{"result"::"sampleResult"}`))

	assert.NotNil(t, err)
	assert.Nil(t, expectedResponse)
}

func TestHandleAPIResultError(t *testing.T) {
	expectedResponse, err := handleAPIResult([]byte(`{"result":"sampleResult", "error":{"message":"Message", "data":"Data"}}`))

	assert.Error(t, err)
	assert.EqualError(t, err, `Code 0: 'Message' Data`)
	assert.Nil(t, expectedResponse)
}

func TestIsNotAuthorized(t *testing.T) {
	testPositive := isNotAuthorized("Not authorised.")
	assert.True(t, testPositive)

	testNegative := isNotAuthorized("testNegative")
	assert.False(t, testNegative)
}

func TestGetAllGroups(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":[{"groupid": "46489126", "name": "name1"},{"groupid": "46489127", "name":"name2"}]}`})
	resp, err := mockDataSource.GetAllGroups(context.Background())

	assert.Equal(t, "46489126", resp[0].ID)
	assert.Equal(t, "46489127", resp[1].ID)
	assert.Nil(t, err)
}

func TestGetAllGroupsError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockDataSource.GetAllGroups(context.Background())

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetHostsByGroupIDs(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":[{"hostid": "46489126", "name": "hostname1"},{"hostid": "46489127", "name":"hostname2"}]}`})
	resp, err := mockDataSource.GetHostsByGroupIDs(context.Background(), []string{"46489127", "46489127"})

	assert.Equal(t, "46489126", resp[0].ID)
	assert.Equal(t, "46489127", resp[1].ID)
	assert.Nil(t, err)
}

func TestGetHostsByGroupIDsError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockDataSource.GetHostsByGroupIDs(context.Background(), []string{"46489127", "46489127"})

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetAppsByHostIDs(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":[{"applicationid": "46489126", "name": "hostname1"},{"applicationid": "46489127", "name":"hostname2"}]}`})
	resp, err := mockDataSource.GetAppsByHostIDs(context.Background(), []string{"46489127", "46489127"})

	assert.Equal(t, "46489126", resp[0].ID)
	assert.Equal(t, "46489127", resp[1].ID)
	assert.Nil(t, err)
}

func TestGetAppsByHostIDsError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockDataSource.GetAppsByHostIDs(context.Background(), []string{"46489127", "46489127"})

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetFilteredItems(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":[{"itemid": "46489126", "name": "hostname1"},{"itemid": "46489127", "name":"hostname2"}]}`})
	resp, err := mockDataSource.GetFilteredItems(context.Background(), []string{"46489127", "46489127"}, []string{"7947934", "9182763"}, "num")

	assert.Equal(t, "46489126", resp[0].ID)
	assert.Equal(t, "46489127", resp[1].ID)
	assert.Nil(t, err)
}

func TestGetFilteredItemsError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 500, Body: ``})
	resp, err := mockDataSource.GetFilteredItems(context.Background(), []string{"46489127", "46489127"}, []string{"7947934", "9182763"}, "num")

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetHistory(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":[{"itemid": "46489126", "name": "hostname1"},{"itemid": "46489127", "name":"hostname2"}]}`})
	resp, err := mockDataSource.GetHistory(context.Background(), mockDataSourceRequest(""), zabbix.Items{zabbix.Item{ID: "13244235"}, zabbix.Item{ID: "82643598"}})

	assert.Equal(t, "46489126", resp[0].ItemID)
	assert.Equal(t, "46489127", resp[1].ItemID)
	assert.Nil(t, err)
}

func TestGetHistoryError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: ``})
	resp, err := mockDataSource.GetHistory(context.Background(), mockDataSourceRequest(""), zabbix.Items{zabbix.Item{ID: "13244235"}, zabbix.Item{ID: "82643598"}})

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}

func TestGetTrend(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: `{"result":[{"itemid": "46489126", "name": "hostname1"},{"itemid": "46489127", "name":"hostname2"}]}`})
	resp, err := mockDataSource.GetTrend(context.Background(), mockDataSourceRequest(""), zabbix.Items{zabbix.Item{ID: "13244235"}, zabbix.Item{ID: "82643598"}})

	assert.Equal(t, "46489126", resp[0].ItemID)
	assert.Equal(t, "46489127", resp[1].ItemID)
	assert.Nil(t, err)
}

func TestGetTrendError(t *testing.T) {
	mockDataSource := NewMockZabbixAPIClient(t, MockResponse{Status: 200, Body: ``})
	resp, err := mockDataSource.GetTrend(context.Background(), mockDataSourceRequest(""), zabbix.Items{zabbix.Item{ID: "13244235"}, zabbix.Item{ID: "82643598"}})

	assert.NotNil(t, err)
	assert.Nil(t, resp)
}
