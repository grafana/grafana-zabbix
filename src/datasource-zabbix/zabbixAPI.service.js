import angular from 'angular';
import _ from 'lodash';
import * as utils from './utils';
import './zabbixAPICore.service';

/** @ngInject */
function ZabbixAPIServiceFactory($q, alertSrv, zabbixAPICoreService) {

  /**
   * Zabbix API Wrapper.
   * Creates Zabbix API instance with given parameters (url, credentials and other).
   * Wraps API calls and provides high-level methods.
   */
  class ZabbixAPI {

    constructor(api_url, username, password, basicAuth, withCredentials) {
      this.url              = api_url;
      this.username         = username;
      this.password         = password;
      this.auth             = "";

      this.requestOptions = {
        basicAuth: basicAuth,
        withCredentials: withCredentials
      };

      this.loginPromise = null;
      this.loginErrorCount = 0;
      this.maxLoginAttempts = 3;

      this.$q = $q;
      this.alertSrv = alertSrv;
      this.zabbixAPICore = zabbixAPICoreService;

      this.getTrend = this.getTrend_ZBXNEXT1193;
      //getTrend = getTrend_30;
    }

    //////////////////////////
    // Core method wrappers //
    //////////////////////////

    request(method, params) {
      return this.zabbixAPICore.request(this.url, method, params, this.requestOptions, this.auth)
      .catch(error => {
        if (isNotAuthorized(error.data)) {
          // Handle auth errors
          this.loginErrorCount++;
          if (this.loginErrorCount > this.maxLoginAttempts) {
            this.loginErrorCount = 0;
            return null;
          } else {
            return this.loginOnce()
            .then(() => this.request(method, params));
          }
        } else {
          // Handle API errors
          let message = error.data ? error.data : error.statusText;
          this.alertAPIError(message);
        }
      });
    }

    alertAPIError(message, timeout = 5000) {
      this.alertSrv.set(
        "Zabbix API Error",
        message,
        'error',
        timeout
      );
    }

    /**
     * When API unauthenticated or auth token expired each request produce login()
     * call. But auth token is common to all requests. This function wraps login() method
     * and call it once. If login() already called just wait for it (return its promise).
     * @return login promise
     */
    loginOnce() {
      if (!this.loginPromise) {
        this.loginPromise = Promise.resolve(
          this.login().then(auth => {
            this.auth = auth;
            this.loginPromise = null;
            return auth;
          })
        );
      }
      return this.loginPromise;
    }

    /**
     * Get authentication token.
     */
    login() {
      return this.zabbixAPICore.login(this.url, this.username, this.password, this.requestOptions);
    }

    /**
     * Get Zabbix API version
     */
    getVersion() {
      return this.zabbixAPICore.getVersion(this.url, this.requestOptions);
    }

    ////////////////////////////////
    // Zabbix API method wrappers //
    ////////////////////////////////

    acknowledgeEvent(eventid, message) {
      var params = {
        eventids: eventid,
        message: message
      };

      return this.request('event.acknowledge', params);
    }

    getGroups() {
      var params = {
        output: ['name'],
        sortfield: 'name',
        real_hosts: true
      };

      return this.request('hostgroup.get', params);
    }

    getHosts(groupids) {
      var params = {
        output: ['name', 'host'],
        sortfield: 'name'
      };
      if (groupids) {
        params.groupids = groupids;
      }

      return this.request('host.get', params);
    }

    getApps(hostids) {
      var params = {
        output: ['applicationid', 'name'],
        hostids: hostids
      };

      return this.request('application.get', params);
    }

    /**
     * Get Zabbix items
     * @param  {[type]} hostids  host ids
     * @param  {[type]} appids   application ids
     * @param  {String} itemtype 'num' or 'text'
     * @return {[type]}          array of items
     */
    getItems(hostids, appids, itemtype) {
      var params = {
        output: [
          'name', 'key_',
          'value_type',
          'hostid',
          'status',
          'state'
        ],
        sortfield: 'name',
        webitems: true,
        filter: {},
        selectHosts: [
          'hostid',
          'name'
        ]
      };
      if (hostids) {
        params.hostids = hostids;
      }
      if (appids) {
        params.applicationids = appids;
      }
      if (itemtype === 'num') {
        // Return only numeric metrics
        params.filter.value_type = [0, 3];
      }
      if (itemtype === 'text') {
        // Return only text metrics
        params.filter.value_type = [1, 2, 4];
      }

      return this.request('item.get', params)
      .then(expandItems);

      function expandItems(items) {
        items.forEach(item => {
          item.item = item.name;
          item.name = utils.expandItemName(item.item, item.key_);
          return item;
        });
        return items;
      }
    }

    getLastValue(itemid) {
      var params = {
        output: ['lastvalue'],
        itemids: itemid
      };
      return this.request('item.get', params)
      .then(items => items.length ? items[0].lastvalue : null);
    }

    /**
     * Perform history query from Zabbix API
     *
     * @param  {Array}  items       Array of Zabbix item objects
     * @param  {Number} timeFrom   Time in seconds
     * @param  {Number} timeTill   Time in seconds
     * @return {Array}  Array of Zabbix history objects
     */
    getHistory(items, timeFrom, timeTill) {

      // Group items by value type and perform request for each value type
      let grouped_items = _.groupBy(items, 'value_type');
      let promises = _.map(grouped_items, (items, value_type) => {
        let itemids = _.map(items, 'itemid');
        let params = {
          output: 'extend',
          history: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: timeFrom
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (timeTill) {
          params.time_till = timeTill;
        }

        return this.request('history.get', params);
      });

      return Promise.all(promises).then(_.flatten);
    }

    /**
     * Perform trends query from Zabbix API
     * Use trends api extension from ZBXNEXT-1193 patch.
     *
     * @param  {Array}  items       Array of Zabbix item objects
     * @param  {Number} time_from   Time in seconds
     * @param  {Number} time_till   Time in seconds
     * @return {Array}  Array of Zabbix trend objects
     */
    getTrend_ZBXNEXT1193(items, timeFrom, timeTill) {

      // Group items by value type and perform request for each value type
      let grouped_items = _.groupBy(items, 'value_type');
      let promises = _.map(grouped_items, (items, value_type) => {
        let itemids = _.map(items, 'itemid');
        let params = {
          output: 'extend',
          trend: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: timeFrom
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (timeTill) {
          params.time_till = timeTill;
        }

        return this.request('trend.get', params);
      });

      return Promise.all(promises).then(_.flatten);
    }

    getTrend_30(items, time_from, time_till, value_type) {
      var self = this;
      var itemids = _.map(items, 'itemid');

      var params = {
        output: ["itemid",
          "clock",
          value_type
        ],
        itemids: itemids,
        time_from: time_from
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (time_till) {
        params.time_till = time_till;
      }

      return self.request('trend.get', params);
    }

    getITService(serviceids) {
      var params = {
        output: 'extend',
        serviceids: serviceids
      };
      return this.request('service.get', params);
    }

    getSLA(serviceids, timeFrom, timeTo) {
      var params = {
        serviceids: serviceids,
        intervals: [{
          from: timeFrom,
          to: timeTo
        }]
      };
      return this.request('service.getsla', params);
    }

    getTriggers(groupids, hostids, applicationids, showTriggers, timeFrom, timeTo) {
      var params = {
        output: 'extend',
        groupids: groupids,
        hostids: hostids,
        applicationids: applicationids,
        expandDescription: true,
        expandData: true,
        expandComment: true,
        monitored: true,
        skipDependent: true,
        //only_true: true,
        filter: {
          value: 1
        },
        selectGroups: ['name'],
        selectHosts: ['name', 'host'],
        selectItems: ['name', 'key_', 'lastvalue'],
        selectLastEvent: 'extend'
      };

      if (showTriggers) {
        params.filter.value = showTriggers;
      }

      if (timeFrom || timeTo) {
        params.lastChangeSince = timeFrom;
        params.lastChangeTill = timeTo;
      }

      return this.request('trigger.get', params);
    }

    getEvents(objectids, timeFrom, timeTo, showEvents) {
      var params = {
        output: 'extend',
        time_from: timeFrom,
        time_till: timeTo,
        objectids: objectids,
        select_acknowledges: 'extend',
        selectHosts: 'extend',
        value: showEvents
      };

      return this.request('event.get', params);
    }

    getAcknowledges(eventids) {
      var params = {
        output: 'extend',
        eventids: eventids,
        preservekeys: true,
        select_acknowledges: 'extend',
        sortfield: 'clock',
        sortorder: 'DESC'
      };

      return this.request('event.get', params)
      .then(events => {
        return _.filter(events, (event) => event.acknowledges.length);
      });
    }

  }

  return ZabbixAPI;
}

function isNotAuthorized(message) {
  return (
    message === "Session terminated, re-login, please." ||
    message === "Not authorised." ||
    message === "Not authorized."
  );
}

angular
  .module('grafana.services')
  .factory('zabbixAPIService', ZabbixAPIServiceFactory);
