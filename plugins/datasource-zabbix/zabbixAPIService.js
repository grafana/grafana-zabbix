/**
 * General Zabbix API methods
 */

define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('ZabbixAPIService', function($q, backendSrv) {

    /**
     * Request data from Zabbix API
     * @return {object}  response.result
     */
    this._request = function(api_url, method, params, options, auth) {
      var requestData = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      };

      // Set auth parameter only if it needed
      if (auth) {
        requestData.auth = auth;
      }

      var requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: api_url,
        data: requestData
      };

      // Set request options for basic auth
      if (options.basicAuth || options.withCredentials) {
        requestOptions.withCredentials = true;
      }
      if (options.basicAuth) {
        requestOptions.headers.Authorization = options.basicAuth;
      }

      return backendSrv.datasourceRequest(requestOptions).then(function (response) {
        // General connection issues
        if (!response.data) {
          return [];
        }

        // Handle Zabbix API errors
        else if (response.data.error) {
          throw new ZabbixException(response.data.error);
        }

        return response.data.result;
      });
    };

    /**
     * Get authentication token.
     * @return {string}  auth token
     */
    this.login = function(api_url, username, password, options) {
      var params = {
        user: username,
        password: password
      };
      return this._request(api_url, 'user.login', params, options, null);
    };

    /**
     * Get Zabbix API version
     * Matches the version of Zabbix starting from Zabbix 2.0.4
     */
    this.getVersion = function(api_url, options) {
      return this._request(api_url, 'apiinfo.version', [], options);
    };

  });

  // Define zabbix API exception type
  function ZabbixException(error) {
    this.code = error.code;
    this.message = error.message;
    this.data = error.data;
  }

  ZabbixException.prototype.toString = function() {
    return this.name + " " + this.message;
  };

});