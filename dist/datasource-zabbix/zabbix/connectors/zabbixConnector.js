"use strict";

System.register([], function (_export, _context) {
  "use strict";

  var _createClass, ZabbixConnector;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [],
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

      ZabbixConnector = function () {
        function ZabbixConnector() {
          _classCallCheck(this, ZabbixConnector);
        }

        _createClass(ZabbixConnector, [{
          key: "testDataSource",
          value: function testDataSource() {}
        }, {
          key: "getHistory",
          value: function getHistory() {}
        }, {
          key: "getTrends",
          value: function getTrends() {}
        }, {
          key: "getGroups",
          value: function getGroups() {}
        }, {
          key: "getHosts",
          value: function getHosts() {}
        }, {
          key: "getApps",
          value: function getApps() {}
        }, {
          key: "getItems",
          value: function getItems() {}
        }, {
          key: "getItemsByIDs",
          value: function getItemsByIDs() {}
        }, {
          key: "getMacros",
          value: function getMacros() {}
        }, {
          key: "getGlobalMacros",
          value: function getGlobalMacros() {}
        }, {
          key: "getLastValue",
          value: function getLastValue() {}
        }, {
          key: "getTriggers",
          value: function getTriggers() {}
        }, {
          key: "getEvents",
          value: function getEvents() {}
        }, {
          key: "getAlerts",
          value: function getAlerts() {}
        }, {
          key: "getHostAlerts",
          value: function getHostAlerts() {}
        }, {
          key: "getAcknowledges",
          value: function getAcknowledges() {}
        }, {
          key: "getITService",
          value: function getITService() {}
        }, {
          key: "getSLA",
          value: function getSLA() {}
        }, {
          key: "getVersion",
          value: function getVersion() {}
        }]);

        return ZabbixConnector;
      }();

      _export("default", ZabbixConnector);
    }
  };
});
//# sourceMappingURL=zabbixConnector.js.map
