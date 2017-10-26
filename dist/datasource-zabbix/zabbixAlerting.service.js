'use strict';

System.register(['lodash', 'jquery', 'angular'], function (_export, _context) {
  "use strict";

  var _, $, angular, _createClass, ZabbixAlertingService;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function setGraphThreshold(panel, threshold) {
    var containsThreshold = _.find(panel.thresholds, { value: threshold });

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

  function setAlarmBoxThresholds(panel, thresholds) {
    if (panel.type === "btplc-alarm-box-panel") {
      var thresh = thresholds.sort(function (a, b) {
        return a - b;
      }).map(function (value, index, array) {
        return {
          color: getColor(index, array.length),
          value: value
        };
      });
      panel.thresholds = panel.thresholds.concat(thresh);
    }
  }

  function setSingleStatThresholds(panel, thresholds) {
    if (panel.type === "singlestat") {
      var parsedThresholds = parseThresholds(thresholds);
      var thresholdsString = parsedThresholds.join();
      panel.thresholds = thresholdsString;
      var maxThreshold = parsedThresholds[1];
      panel.gauge.maxValue = Math.ceil(maxThreshold * 1.1);

      panel.scopedVars.thresholds = {
        text: thresholdsString,
        value: thresholdsString
      };
    }
  }

  function parseThresholds(thresholds) {
    if (thresholds.length === 1) {
      return [thresholds[0], thresholds[0]];
    }

    return [thresholds[0], thresholds[thresholds.length - 1]].sort(function (a, b) {
      return a - b;
    });
  }

  function getColor(index, thresholdsCount) {
    var scale = 255 / thresholdsCount;

    var g = Math.floor((index + 1) * scale);
    return 'rgb(255, ' + (255 - g) + ', 0)';
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_jquery) {
      $ = _jquery.default;
    }, function (_angular) {
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

      ZabbixAlertingService = function () {

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

            var panelContainers = _.filter($('.panel-container'), function (elem) {
              return elem.clientHeight && elem.clientWidth;
            });

            var panelModels = this.getPanelModels();

            if (this.isFullScreen()) {
              panelIndex = 0;
            } else {
              panelIndex = _.findIndex(panelModels, function (panel) {
                return panel.id === panelId;
              });
            }

            if (panelIndex >= 0) {
              var alertClass = "panel-has-alert panel-alert-state--ok panel-alert-state--alerting";
              $(panelContainers[panelIndex]).removeClass(alertClass);

              if (alertState) {
                if (alertState === 'alerting') {
                  alertClass = "panel-has-alert panel-alert-state--" + alertState;
                  $(panelContainers[panelIndex]).addClass(alertClass);
                }
                if (alertState === 'ok') {
                  alertClass = "panel-alert-state--" + alertState;
                  $(panelContainers[panelIndex]).addClass(alertClass);
                  $(panelContainers[panelIndex]).removeClass("panel-has-alert");
                }
              }
            }
          }
        }, {
          key: 'getPanelModels',
          value: function getPanelModels() {
            return _.flatten(_.map(this.dashboardSrv.dash.rows, function (row) {
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

            return _.find(panelModels, function (panel) {
              return panel.id === panelId;
            });
          }
        }, {
          key: 'setThresholds',
          value: function setThresholds(panelId, thresholds) {
            if (!thresholds || thresholds.length === 0) {
              return;
            }

            var panel = this.getPanelModel(panelId);
            if (!panel) {
              return;
            }

            thresholds.forEach(function (threshold) {
              setGraphThreshold(panel, threshold);
            });

            setSingleStatThresholds(panel, thresholds);
            setAlarmBoxThresholds(panel, thresholds);
          }
        }, {
          key: 'removeZabbixThreshold',
          value: function removeZabbixThreshold(panelId) {
            var panel = this.getPanelModel(panelId);

            if (panel && panel.type === "graph") {
              panel.thresholds = _.filter(panel.thresholds, function (threshold) {
                return threshold.source !== "zabbix";
              });
            }
          }
        }]);

        return ZabbixAlertingService;
      }();

      angular.module('grafana.services').service('zabbixAlertingSrv', ZabbixAlertingService);
    }
  };
});
//# sourceMappingURL=zabbixAlerting.service.js.map
