package zabbixapi

import (
	"bytes"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type RoundTripFunc func(req *http.Request) *http.Response

func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

// NewTestClient returns *http.Client with Transport replaced to avoid making real calls
func NewTestClient(fn RoundTripFunc) *http.Client {
	return &http.Client{
		Transport: RoundTripFunc(fn),
	}
}

type flakyRoundTripper func(req *http.Request) (*http.Response, error)

func (f flakyRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

// NewFlakyTestClient returns an *http.Client whose Transport fails the first
// failTimes requests with failErr (simulating a network-level error such as
// a stale pooled connection being closed by the peer) before responding
// normally. The returned *int tracks how many attempts were made.
func NewFlakyTestClient(failTimes int, failErr error, body string, statusCode int) (*http.Client, *int) {
	attempts := 0
	client := &http.Client{
		Transport: flakyRoundTripper(func(req *http.Request) (*http.Response, error) {
			attempts++
			if attempts <= failTimes {
				return nil, failErr
			}
			return &http.Response{
				StatusCode: statusCode,
				Body:       io.NopCloser(bytes.NewBufferString(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}
	return client, &attempts
}

func MockZabbixAPI(body string, statusCode int) (*ZabbixAPI, error) {
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
				Body:       io.NopCloser(bytes.NewBufferString(body)),
				Header:     make(http.Header),
			}
		}),
	}, nil
}
