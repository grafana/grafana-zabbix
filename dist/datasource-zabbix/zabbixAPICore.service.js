'use strict';

System.register(['angular'], function (_export, _context) {
  "use strict";

  var angular, _createClass, ZabbixAPICoreService, ZabbixAPIError;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      ZabbixAPICoreService = function () {

        /** @ngInject */
        function ZabbixAPICoreService(backendSrv) {
          _classCallCheck(this, ZabbixAPICoreService);

          this.backendSrv = backendSrv;
        }

        /**
         * Request data from Zabbix API
         * @return {object}  response.result
         */


        _createClass(ZabbixAPICoreService, [{
          key: 'request',
          value: function request(api_url, method, params, options, auth) {
            var requestData = {
              jsonrpc: '2.0',
              method: method,
              params: params,
              id: 1
            };

            if (auth === "") {
              // Reject immediately if not authenticated
              return Promise.reject(new ZabbixAPIError({ data: "Not authorised." }));
            } else if (auth) {
              // Set auth parameter only if it needed
              requestData.auth = auth;
            }

            var requestOptions = {
              method: 'POST',
              url: api_url,
              data: requestData,
              headers: {
                'Content-Type': 'application/json'
              }
            };

            // Set request options for basic auth
            if (options.basicAuth || options.withCredentials) {
              requestOptions.withCredentials = true;
            }
            if (options.basicAuth) {
              requestOptions.headers.Authorization = options.basicAuth;
            }

            return this.datasourceRequest(requestOptions);
          }
        }, {
          key: 'datasourceRequest',
          value: function datasourceRequest(requestOptions) {
            return this.backendSrv.datasourceRequest(requestOptions).then(function (response) {
              if (!response.data) {
                return Promise.reject(new ZabbixAPIError({ data: "General Error, no data" }));
              } else if (response.data.error) {

                // Handle Zabbix API errors
                return Promise.reject(new ZabbixAPIError(response.data.error));
              }

              // Success
              return response.data.result;
            });
          }
        }, {
          key: 'login',
          value: function login(api_url, username, password, options) {
            var params = {
              user: username,
              password: password
            };
            return this.request(api_url, 'user.login', params, options, null);
          }
        }, {
          key: 'getVersion',
          value: function getVersion(api_url, options) {
            return this.request(api_url, 'apiinfo.version', [], options);
          }
        }]);

        return ZabbixAPICoreService;
      }();

      _export('ZabbixAPIError', ZabbixAPIError = function () {
        function ZabbixAPIError(error) {
          _classCallCheck(this, ZabbixAPIError);

          this.code = error.code || null;
          this.name = error.message || "";
          this.data = error.data || "";
          this.message = "Zabbix API Error: " + this.name + " " + this.data;
        }

        _createClass(ZabbixAPIError, [{
          key: 'toString',
          value: function toString() {
            return this.name + " " + this.data;
          }
        }]);

        return ZabbixAPIError;
      }());

      _export('ZabbixAPIError', ZabbixAPIError);

      angular.module('grafana.services').service('zabbixAPICoreService', ZabbixAPICoreService);
    }
  };
});
//# sourceMappingURL=zabbixAPICore.service.js.map
