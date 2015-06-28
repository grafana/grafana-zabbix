define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('zabbix', function($q, backendSrv) {

    this.init = function(api_url, username, password) {
      this.url        = api_url;
      this.username   = username;
      this.password   = password;
    }


    //////////////////
    // Core methods //
    //////////////////


    /**
     * Request data from Zabbix API
     *
     * @param  {string} method Zabbix API method name
     * @param  {object} params method params
     *
     * @return {object}        data.result field or []
     */
    this.performZabbixAPIRequest = function(method, params) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: this.url,
        data: {
          jsonrpc: '2.0',
          method: method,
          params: params,
          auth: this.auth,
          id: 1
        }
      };

      var self = this;
      return backendSrv.datasourceRequest(options).then(function (response) {
        if (!response.data) {
          return [];
        }
        // Handle Zabbix API errors
        else if (response.data.error) {

          // Handle auth errors
          if (response.data.error.data == "Session terminated, re-login, please." ||
              response.data.error.data == "Not authorised." ||
              response.data.error.data == "Not authorized") {
            return self.performZabbixAPILogin().then(function (response) {
              self.auth = response;
              return self.performZabbixAPIRequest(method, params);
            });
          }
        }
        return response.data.result;
      });
    };


    // Get authentication token
    this.performZabbixAPILogin = function() {
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
        },
      };

      return backendSrv.datasourceRequest(options).then(function (result) {
        if (!result.data) {
          return null;
        }
        return result.data.result;
      });
    };



    /////////////////////////
    // API method wrappers //
    /////////////////////////


    /**
     * Perform history query from Zabbix API
     *
     * @param  {Array}  items Array of Zabbix item objects
     * @param  {Number} start Time in seconds
     * @param  {Number} end   Time in seconds
     *
     * @return {Array}        Array of Zabbix history objects
     */
    this.getHistory = function(items, start, end) {
      // Group items by value type
      var grouped_items = _.groupBy(items, 'value_type');

      // Perform request for each value type
      return $q.all(_.map(grouped_items, function (items, value_type) {
        var itemids = _.map(items, 'itemid');
        var params = {
          output: 'extend',
          history: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: start
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          params.time_till = end;
        }

        return this.performZabbixAPIRequest('history.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };


    this.getTrends = function(items, start, end) {
      // Group items by value type
      var grouped_items = _.groupBy(items, 'value_type');

      // Perform request for each value type
      return $q.all(_.map(grouped_items, function (items, value_type) {
        var itemids = _.map(items, 'itemid');
        var params = {
          output: 'extend',
          trend: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: start
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          params.time_till = end;
        }

        return this.performZabbixAPIRequest('trend.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };


    // Get the list of host groups
    this.performHostGroupSuggestQuery = function() {
      var params = {
        output: ['name'],
        sortfield: 'name',
        // Return only host groups that contain hosts
        real_hosts: true,
        // Return only host groups that contain monitored hosts.
        monitored_hosts: true
      };

      return this.performZabbixAPIRequest('hostgroup.get', params);
    };


    // Get the list of hosts
    this.performHostSuggestQuery = function(groupids) {
      var params = {
        output: ['name', 'host'],
        sortfield: 'name',
        // Return only hosts that have items with numeric type of information.
        with_simple_graph_items: true,
        // Return only monitored hosts.
        monitored_hosts: true
      };
      // Return only hosts in given group
      if (groupids) {
        params.groupids = groupids;
      }
      return this.performZabbixAPIRequest('host.get', params);
    };


    // Get the list of applications
    this.performAppSuggestQuery = function(hostids, /* optional */ groupids) {
      var params = {
        output: ['name'],
        sortfield: 'name'
      };
      if (hostids) {
        params.hostids = hostids;
      }
      else if (groupids) {
        params.groupids = groupids;
      }

      return this.performZabbixAPIRequest('application.get', params);
    };


    /**
     * Items request
     *
     * @param  {string or Array} hostids          ///////////////////////////
     * @param  {string or Array} applicationids   // Zabbix API parameters //
     * @param  {string or Array} groupids         ///////////////////////////
     *
     * @return {string or Array}                  Array of Zabbix API item objects
     */
    this.performItemSuggestQuery = function(hostids, applicationids, /* optional */ groupids) {
      var params = {
        output: ['name', 'key_', 'value_type', 'delay'],
        sortfield: 'name',
        //Include web items in the result
        webitems: true,
        // Return only numeric items
        filter: {
          value_type: [0,3]
        },
        // Return only enabled items
        monitored: true,
        searchByAny: true
      };

      // Filter by hosts or by groups
      if (hostids) {
        params.hostids = hostids;
      } else if (groupids) {
        params.groupids = groupids;
      }

      // If application selected return only relative items
      if (applicationids) {
        params.applicationids = applicationids;
      }

      // Return host property for multiple hosts
      if (!hostids || (_.isArray(hostids) && hostids.length  > 1)) {
        params.selectHosts = ['name'];
      }

      return this.performZabbixAPIRequest('item.get', params);
    };


    /**
     * Find groups by names
     *
     * @param  {string or array} group group names
     * @return {array}                 array of Zabbix API hostgroup objects
     */
    this.findZabbixGroup = function (group) {
      var params = {
        output: ['name'],
        searchByAny: true
      };
      if (group != '*') {
        if (_.isArray(group)) {
          params.filter = {
            name: group
          };
        } else {
          params.search = {
            name: group
          };
          params.searchWildcardsEnabled = true;
        }
      }
      return this.performZabbixAPIRequest('hostgroup.get', params);
    };


    /**
     * Find hosts by names
     *
     * @param  {string or array} hostnames hosts names
     * @return {array}                     array of Zabbix API host objects
     */
    this.findZabbixHost = function (hostnames) {
      var params = {
        output: ['host', 'name'],
        searchByAny: true
      };
      if (hostnames != '*') {
        params.filter = {
          name: hostnames
        };
      }
      return this.performZabbixAPIRequest('host.get', params);
    };


    /**
     * Find applications by names
     *
     * @param  {string or array} application applications names
     * @return {array}                       array of Zabbix API application objects
     */
    this.findZabbixApp = function (application) {
      var params = {
        output: ['name'],
        searchByAny: true
      }
      if (application != '*') {
        params.filter = {
          name: application
        };
      };
      return this.performZabbixAPIRequest('application.get', params);
    };


    /**
     * Find items belongs to passed groups, hosts and
     * applications
     *
     * @param  {string or array} groups
     * @param  {string or array} hosts
     * @param  {string or array} apps
     *
     * @return {array}  array of Zabbix API item objects
     */
    this.itemFindQuery = function(groups, hosts, apps) {
      var promises = [];

      // Get hostids from names
      if (hosts && hosts != '*') {
        promises.push(this.findZabbixHost(hosts));
      }
      // Get groupids from names
      else if (groups) {
        promises.push(this.findZabbixGroup(groups));
      }
      // Get applicationids from names
      if (apps) {
        promises.push(this.findZabbixApp(apps));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        if (groups) {
          var groupids = _.map(_.filter(results, function (object) {
            return object.groupid;
          }), 'groupid');
        }
        if (hosts && hosts != '*') {
          var hostids = _.map(_.filter(results, function (object) {
            return object.hostid;
          }), 'hostid');
        }
        if (apps) {
          var applicationids = _.map(_.filter(results, function (object) {
            return object.applicationid;
          }), 'applicationid');
        }

        return self.performItemSuggestQuery(hostids, applicationids, groupids);
      });
    };


    /**
     * Find applications belongs to passed groups and hosts
     *
     * @param  {string or array} hosts
     * @param  {string or array} groups
     *
     * @return {array}  array of Zabbix API application objects
     */
    this.appFindQuery = function(hosts, groups) {
      var promises = [];

      // Get hostids from names
      if (hosts && hosts != '*') {
        promises.push(this.findZabbixHost(hosts));
      }
      // Get groupids from names
      else if (groups) {
        promises.push(this.findZabbixGroup(groups));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        if (groups) {
          var groupids = _.map(_.filter(results, function (object) {
            return object.groupid;
          }), 'groupid');
        }
        if (hosts && hosts != '*') {
          var hostids = _.map(_.filter(results, function (object) {
            return object.hostid;
          }), 'hostid');
        }

        return self.performAppSuggestQuery(hostids, groupids);
      });
    };


    /**
     * Find hosts belongs to passed groups
     *
     * @param  {string or array} groups
     * @return {array}  array of Zabbix API host objects
     */
    this.hostFindQuery = function(groups) {
      var self = this;
      return this.findZabbixGroup(groups).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');

        return self.performHostSuggestQuery(groupids);
      });
    };

  });
});
