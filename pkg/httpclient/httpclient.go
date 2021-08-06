package httpclient

import (
	"crypto/tls"
	"net/http"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// New creates new HTTP client.
func New(dsInfo *backend.DataSourceInstanceSettings, timeout time.Duration) (*http.Client, error) {
	clientOptions, err := dsInfo.HTTPClientOptions()
	clientOptions.Timeouts.Timeout = timeout

	tlsSkipVerify, err := getTLSSkipVerify(dsInfo)
	if err != nil {
		return nil, err
	}

	clientOptions.ConfigureTLSConfig = func(opts httpclient.Options, tlsConfig *tls.Config) {
		// grafana-plugin-sdk-go has a bug and InsecureSkipVerify only set if TLS Client Auth enabled, so it should be set
		// manually here
		tlsConfig.InsecureSkipVerify = tlsSkipVerify
	}

	client, err := httpclient.New(clientOptions)
	if err != nil {
		log.DefaultLogger.Error("Failed to create HTTP client", err)
		return nil, err
	}

	return client, nil
}

func getTLSSkipVerify(ds *backend.DataSourceInstanceSettings) (bool, error) {
	var tlsSkipVerify bool
	jsonData, err := simplejson.NewJson(ds.JSONData)
	if err != nil {
		return false, err
	}

	if jsonData != nil {
		tlsSkipVerify = jsonData.Get("tlsSkipVerify").MustBool(false)
	}

	return tlsSkipVerify, nil
}
