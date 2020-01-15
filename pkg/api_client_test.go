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

