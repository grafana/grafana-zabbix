package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"

	simplejson "github.com/bitly/go-simplejson"
	"golang.org/x/net/context/ctxhttp"
)

// ZabbixRequest checks authentication and makes a request to the Zabbix API
func (ds *ZabbixDatasourceInstance) ZabbixRequest(ctx context.Context, method string, params ZabbixAPIParams) (*simplejson.Json, error) {
	ds.logger.Debug("Invoke Zabbix API request", "ds", ds.dsInfo.Name, "method", method)
	var result *simplejson.Json
	var err error

	// Skip auth for methods that are not required it
	if method == "apiinfo.version" {
		return ds.ZabbixAPIRequest(ctx, method, params, "")
	}

	for attempt := 0; attempt <= 3; attempt++ {
		if ds.authToken == "" {
			// Authenticate
			err = ds.loginWithDs(ctx)
			if err != nil {
				return nil, err
			}
		}
		result, err = ds.ZabbixAPIRequest(ctx, method, params, ds.authToken)
		if err == nil || (err != nil && !isNotAuthorized(err.Error())) {
			break
		} else {
			ds.authToken = ""
		}
	}
	return result, err
}

func (ds *ZabbixDatasourceInstance) loginWithDs(ctx context.Context) error {
	jsonDataStr := ds.dsInfo.JSONData
	jsonData, err := simplejson.NewJson(jsonDataStr)
	if err != nil {
		return err
	}

	zabbixLogin := jsonData.Get("username").MustString()
	var zabbixPassword string
	if securePassword, exists := ds.dsInfo.DecryptedSecureJSONData["password"]; exists {
		zabbixPassword = securePassword
	} else {
		zabbixPassword = jsonData.Get("password").MustString()
	}

	auth, err := ds.login(ctx, zabbixLogin, zabbixPassword)
	if err != nil {
		ds.logger.Error("Authentication error", "error", err)
		ds.authToken = ""
		return err
	}
	ds.logger.Debug("Successfully authenticated", "url", ds.url, "user", zabbixLogin)
	ds.authToken = auth

	return nil
}

func (ds *ZabbixDatasourceInstance) login(ctx context.Context, username string, password string) (string, error) {
	params := ZabbixAPIParams{
		"user":     username,
		"password": password,
	}
	auth, err := ds.ZabbixAPIRequest(ctx, "user.login", params, "")
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

func (ds *ZabbixDatasourceInstance) ZabbixAPIRequest(ctx context.Context, method string, params ZabbixAPIParams, auth string) (*simplejson.Json, error) {
	apiRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
		"params":  params,
	}

	if auth != "" {
		apiRequest["auth"] = auth
	}

	reqBodyJSON, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	var body io.Reader
	body = bytes.NewReader(reqBodyJSON)
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}

	req := &http.Request{
		Method: "POST",
		URL:    ds.url,
		Header: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: rc,
	}

	response, err := makeHTTPRequest(ctx, ds.httpClient, req)
	if err != nil {
		return nil, err
	}

	return handleAPIResult(response)
}

func handleAPIResult(response []byte) (*simplejson.Json, error) {
	jsonResp, err := simplejson.NewJson([]byte(response))
	if err != nil {
		return nil, err
	}
	if errJSON, isError := jsonResp.CheckGet("error"); isError {
		errMessage := fmt.Sprintf("%s %s", errJSON.Get("message").MustString(), errJSON.Get("data").MustString())
		return nil, errors.New(errMessage)
	}
	jsonResult := jsonResp.Get("result")
	return jsonResult, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid status code. status: %v", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func isNotAuthorized(message string) bool {
	return message == "Session terminated, re-login, please." ||
		message == "Not authorised." ||
		message == "Not authorized."
}
