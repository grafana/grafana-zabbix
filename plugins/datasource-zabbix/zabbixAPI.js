define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('ZabbixAPI', function($q, backendSrv) {

    this.init = function () {};

    /**
     * Request data from Zabbix API
     * @return {object}  response.result
     */
    this._request = function(url, method, params, auth) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: url,
        data: {
          jsonrpc: '2.0',
          method: method,
          params: params,
          auth: auth,
          id: 1
        }
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers.Authorization = this.basicAuth;
      }

      var self = this;
      return backendSrv.datasourceRequest(options).then(function (response) {
        if (!response.data) {
          return [];
        }
        // Handle Zabbix API errors
        else if (response.data.error) {

          // Handle auth errors
          if (response.data.error.data === "Session terminated, re-login, please." ||
              response.data.error.data === "Not authorised." ||
              response.data.error.data === "Not authorized") {
            return self.performZabbixAPILogin().then(function (response) {
              self.auth = response;
              return self.performZabbixAPIRequest(method, params);
            });
          }
        }
        return response.data.result;
      });
    };

    /**
     * Get authentication token.
     * @return {string}  auth token
     */
    this.login = function(url, username, password) {
      var options = {
        url : this.url,
        method : 'POST',
        data: {
          jsonrpc: '2.0',
          method: 'user.login',
          params: {
            user: this.username,
            password: this.password
          },
          auth: null,
          id: 1
        }
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = options.headers || {};
        options.headers.Authorization = this.basicAuth;
      }

      return backendSrv.datasourceRequest(options).then(function (result) {
        if (!result.data) {
          return null;
        }
        return result.data.result;
      });
    };

  });
});