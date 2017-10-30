'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ZabbixAlertingService = function () {

  /** @ngInject */
  function ZabbixAlertingService(dashboardSrv) {
    _classCallCheck(this, ZabbixAlertingService);

    this.dashboardSrv = dashboardSrv;
  }

  _createClass(ZabbixAlertingService, [{
    key: 'isFullScreen',
    value: function isFullScreen() {
      return this.dashboardSrv.dash.meta.fullscreen;
    }
  }, {
    key: 'setPanelAlertState',
    value: function setPanelAlertState(panelId, alertState) {
      var panelIndex = void 0;

      var panelContainers = _lodash2.default.filter((0, _jquery2.default)('.panel-container'), function (elem) {
        return elem.clientHeight && elem.clientWidth;
      });

      var panelModels = this.getPanelModels();

      if (this.isFullScreen()) {
        panelIndex = 0;
      } else {
        panelIndex = _lodash2.default.findIndex(panelModels, function (panel) {
          return panel.id === panelId;
        });
      }

      if (panelIndex >= 0) {
        var alertClass = "panel-has-alert panel-alert-state--ok panel-alert-state--alerting";
        (0, _jquery2.default)(panelContainers[panelIndex]).removeClass(alertClass);

        if (alertState) {
          if (alertState === 'alerting') {
            alertClass = "panel-has-alert panel-alert-state--" + alertState;
            (0, _jquery2.default)(panelContainers[panelIndex]).addClass(alertClass);
          }
          if (alertState === 'ok') {
            alertClass = "panel-alert-state--" + alertState;
            (0, _jquery2.default)(panelContainers[panelIndex]).addClass(alertClass);
            (0, _jquery2.default)(panelContainers[panelIndex]).removeClass("panel-has-alert");
          }
        }
      }
    }
  }, {
    key: 'getPanelModels',
    value: function getPanelModels() {
      return _lodash2.default.flatten(_lodash2.default.map(this.dashboardSrv.dash.rows, function (row) {
        if (row.collapse) {
          return [];
        } else {
          return row.panels;
        }
      }));
    }
  }, {
    key: 'getPanelModel',
    value: function getPanelModel(panelId) {
      var panelModels = this.getPanelModels();

      return _lodash2.default.find(panelModels, function (panel) {
        return panel.id === panelId;
      });
    }
  }, {
    key: 'setPanelThreshold',
    value: function setPanelThreshold(panelId, threshold) {
      var panel = this.getPanelModel(panelId);
      var containsThreshold = _lodash2.default.find(panel.thresholds, { value: threshold });

      if (panel && panel.type === "graph" && !containsThreshold) {
        var thresholdOptions = {
          colorMode: "custom",
          fill: false,
          line: true,
          lineColor: "rgb(255, 0, 0)",
          op: "gt",
          value: threshold,
          source: "zabbix"
        };

        panel.thresholds.push(thresholdOptions);
      }
    }
  }, {
    key: 'removeZabbixThreshold',
    value: function removeZabbixThreshold(panelId) {
      var panel = this.getPanelModel(panelId);

      if (panel && panel.type === "graph") {
        panel.thresholds = _lodash2.default.filter(panel.thresholds, function (threshold) {
          return threshold.source !== "zabbix";
        });
      }
    }
  }]);

  return ZabbixAlertingService;
}();

_angular2.default.module('grafana.services').service('zabbixAlertingSrv', ZabbixAlertingService);
