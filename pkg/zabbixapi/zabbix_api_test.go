package zabbixapi

import (
	"bytes"
	"context"
	"io/ioutil"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
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

func mockZabbixAPI(body string, statusCode int) (*ZabbixAPI, error) {
	apiLogger := log.New()
	zabbixURL, err := url.Parse("http://zabbix.org/zabbix")
	if err != nil {
		return nil, err
	}

	return &ZabbixAPI{
		url:    zabbixURL,
		logger: apiLogger,

		httpClient: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: statusCode,
				Body:       ioutil.NopCloser(bytes.NewBufferString(body)),
				Header:     make(http.Header),
			}
		}),
	}, nil
}

func TestZabbixAPIUnauthenticatedQuery(t *testing.T) {
	zabbixApi, _ := mockZabbixAPI(`{"result":"sampleResult"}`, 200)
	resp, err := zabbixApi.RequestUnauthenticated(context.Background(), "test.get", map[string]interface{}{})

	assert.Equal(t, "sampleResult", resp.MustString())
	assert.Nil(t, err)
}

func TestLogin(t *testing.T) {
	zabbixApi, _ := mockZabbixAPI(`{"result":"secretauth"}`, 200)
	err := zabbixApi.Authenticate(context.Background(), "user", "password")

	assert.Nil(t, err)
	assert.Equal(t, "secretauth", zabbixApi.auth)
}

func TestZabbixAPI(t *testing.T) {
	tests := []struct {
		name                string
		auth                string
		mockApiResponse     string
		mockApiResponseCode int
		expectedResult      string
		expectedError       error
	}{
		{
			name:                "Simple request",
			auth:                "secretauth",
			mockApiResponse:     `{"result":"sampleResult"}`,
			mockApiResponseCode: 200,
			expectedResult:      "sampleResult",
			expectedError:       nil,
		},
		{
			name:                "Request should return error if API not authenticated",
			auth:                "",
			mockApiResponse:     `{"result":"sampleResult"}`,
			mockApiResponseCode: 200,
			expectedResult:      "",
			expectedError:       ErrNotAuthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			zabbixApi, _ := mockZabbixAPI(tt.mockApiResponse, tt.mockApiResponseCode)
			zabbixApi.auth = tt.auth
			resp, err := zabbixApi.Request(context.Background(), "test.get", map[string]interface{}{})

			if tt.expectedError != nil {
				assert.Equal(t, err, tt.expectedError)
			} else {
				assert.NotNil(t, resp)
				// assert.Equal(t, tt.expectedResult, resp.MustString())
				assert.Nil(t, err)
			}
		})
	}
}
