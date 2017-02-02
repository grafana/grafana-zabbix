'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PanelCtrl = exports.TriggerPanelCtrl = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _utils = require('../datasource-zabbix/utils');

var utils = _interopRequireWildcard(_utils);

var _sdk = require('app/plugins/sdk');

var _editor = require('./editor');

require('./ack-tooltip.directive');

require('./css/panel_triggers.css!');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Grafana-Zabbix
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Zabbix plugin for Grafana.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * http://github.com/alexanderzobnin/grafana-zabbix
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Trigger panel.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * This feature sponsored by CORE IT
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * http://www.coreit.fr
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Copyright 2015 Alexander Zobnin alexanderzobnin@gmail.com
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Licensed under the Apache License, Version 2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

var defaultSeverity = [{ priority: 0, severity: 'Not classified', color: '#B7DBAB', show: true }, { priority: 1, severity: 'Information', color: '#82B5D8', show: true }, { priority: 2, severity: 'Warning', color: '#E5AC0E', show: true }, { priority: 3, severity: 'Average', color: '#C15C17', show: true }, { priority: 4, severity: 'High', color: '#BF1B00', show: true }, { priority: 5, severity: 'Disaster', color: '#890F02', show: true }];

var panelDefaults = {
  datasource: null,
  triggers: {
    group: { filter: "" },
    host: { filter: "" },
    application: { filter: "" },
    trigger: { filter: "" }
  },
  hostField: true,
  statusField: false,
  severityField: false,
  lastChangeField: true,
  ageField: true,
  infoField: true,
  limit: 10,
  showTriggers: 'all triggers',
  sortTriggersBy: { text: 'last change', value: 'lastchange' },
  showEvents: { text: 'Problems', value: '1' },
  triggerSeverity: defaultSeverity,
  okEventColor: 'rgba(0, 245, 153, 0.45)',
  ackEventColor: 'rgba(0, 0, 0, 0)'
};

var triggerStatusMap = {
  '0': 'OK',
  '1': 'Problem'
};

var defaultTimeFormat = "DD MMM YYYY HH:mm:ss";

var TriggerPanelCtrl = function (_MetricsPanelCtrl) {
  _inherits(TriggerPanelCtrl, _MetricsPanelCtrl);

  /** @ngInject */
  function TriggerPanelCtrl($scope, $injector, $element, datasourceSrv, templateSrv, contextSrv) {
    _classCallCheck(this, TriggerPanelCtrl);

    var _this = _possibleConstructorReturn(this, (TriggerPanelCtrl.__proto__ || Object.getPrototypeOf(TriggerPanelCtrl)).call(this, $scope, $injector));

    _this.datasourceSrv = datasourceSrv;
    _this.templateSrv = templateSrv;
    _this.contextSrv = contextSrv;
    _this.triggerStatusMap = triggerStatusMap;
    _this.defaultTimeFormat = defaultTimeFormat;

    // Load panel defaults
    // _.cloneDeep() need for prevent changing shared defaultSeverity.
    // Load object "by value" istead "by reference".
    _lodash2.default.defaults(_this.panel, _lodash2.default.cloneDeep(panelDefaults));

    _this.triggerList = [];
    _this.refreshData();
    return _this;
  }

  /**
   * Override onInitMetricsPanelEditMode() method from MetricsPanelCtrl.
   * We don't need metric editor from Metrics Panel.
   */


  _createClass(TriggerPanelCtrl, [{
    key: 'onInitMetricsPanelEditMode',
    value: function onInitMetricsPanelEditMode() {
      this.addEditorTab('Options', _editor.triggerPanelEditor, 2);
    }
  }, {
    key: 'refresh',
    value: function refresh() {
      this.onMetricsPanelRefresh();
    }
  }, {
    key: 'onMetricsPanelRefresh',
    value: function onMetricsPanelRefresh() {
      // ignore fetching data if another panel is in fullscreen
      if (this.otherPanelInFullscreenMode()) {
        return;
      }

      this.refreshData();
    }
  }, {
    key: 'refreshData',
    value: function refreshData() {
      // clear loading/error state
      delete this.error;
      this.loading = true;
      this.setTimeQueryStart();

      var self = this;

      // Load datasource
      return this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
        var zabbix = datasource.zabbix;
        var showEvents = self.panel.showEvents.value;
        var triggerFilter = self.panel.triggers;

        // Replace template variables
        var groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
        var hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
        var appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);

        var getTriggers = zabbix.getTriggers(groupFilter, hostFilter, appFilter, showEvents);
        return getTriggers.then(function (triggers) {
          return _lodash2.default.map(triggers, function (trigger) {
            var triggerObj = trigger;

            // Format last change and age
            trigger.lastchangeUnix = Number(trigger.lastchange);
            var timestamp = _moment2.default.unix(trigger.lastchangeUnix);
            if (self.panel.customLastChangeFormat) {
              // User defined format
              triggerObj.lastchange = timestamp.format(self.panel.lastChangeFormat);
            } else {
              triggerObj.lastchange = timestamp.format(self.defaultTimeFormat);
            }
            triggerObj.age = timestamp.fromNow(true);

            // Set host that the trigger belongs
            if (trigger.hosts.length) {
              triggerObj.host = trigger.hosts[0].name;
              triggerObj.hostTechName = trigger.hosts[0].host;
            }

            // Set color
            if (trigger.value === '1') {
              // Problem state
              triggerObj.color = self.panel.triggerSeverity[trigger.priority].color;
            } else {
              // OK state
              triggerObj.color = self.panel.okEventColor;
            }

            triggerObj.severity = self.panel.triggerSeverity[trigger.priority].severity;
            return triggerObj;
          });
        }).then(function (triggerList) {

          // Request acknowledges for trigger
          var eventids = _lodash2.default.map(triggerList, function (trigger) {
            return trigger.lastEvent.eventid;
          });

          return zabbix.getAcknowledges(eventids).then(function (events) {

            // Map events to triggers
            _lodash2.default.each(triggerList, function (trigger) {
              var event = _lodash2.default.find(events, function (event) {
                return event.eventid === trigger.lastEvent.eventid;
              });

              if (event) {
                trigger.acknowledges = _lodash2.default.map(event.acknowledges, function (ack) {
                  var timestamp = _moment2.default.unix(ack.clock);
                  if (self.panel.customLastChangeFormat) {
                    ack.time = timestamp.format(self.panel.lastChangeFormat);
                  } else {
                    ack.time = timestamp.format(self.defaultTimeFormat);
                  }
                  ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                  return ack;
                });

                // Mark acknowledged triggers with different color
                if (self.panel.markAckEvents && trigger.acknowledges.length) {
                  trigger.color = self.panel.ackEventColor;
                }
              }
            });

            // Filter triggers by description
            var triggerFilter = self.panel.triggers.trigger.filter;
            if (triggerFilter) {
              triggerList = filterTriggers(triggerList, triggerFilter);
            }

            // Filter acknowledged triggers
            if (self.panel.showTriggers === 'unacknowledged') {
              triggerList = _lodash2.default.filter(triggerList, function (trigger) {
                return !trigger.acknowledges;
              });
            } else if (self.panel.showTriggers === 'acknowledged') {
              triggerList = _lodash2.default.filter(triggerList, 'acknowledges');
            } else {
              triggerList = triggerList;
            }

            // Filter triggers by severity
            triggerList = _lodash2.default.filter(triggerList, function (trigger) {
              return self.panel.triggerSeverity[trigger.priority].show;
            });

            // Sort triggers
            if (self.panel.sortTriggersBy.value === 'priority') {
              triggerList = _lodash2.default.sortBy(triggerList, 'priority').reverse();
            } else {
              triggerList = _lodash2.default.sortBy(triggerList, 'lastchangeUnix').reverse();
            }

            // Limit triggers number
            self.triggerList = triggerList.slice(0, self.panel.limit);

            // Notify panel that request is finished
            self.setTimeQueryEnd();
            self.loading = false;
          });
        });
      });
    }
  }, {
    key: 'switchComment',
    value: function switchComment(trigger) {
      trigger.showComment = !trigger.showComment;
    }
  }, {
    key: 'acknowledgeTrigger',
    value: function acknowledgeTrigger(trigger, message) {
      var _this2 = this;

      var eventid = trigger.lastEvent.eventid;
      var grafana_user = this.contextSrv.user.name;
      var ack_message = grafana_user + ' (Grafana): ' + message;
      return this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
        var zabbixAPI = datasource.zabbix.zabbixAPI;
        return zabbixAPI.acknowledgeEvent(eventid, ack_message).then(function () {
          _this2.refresh();
        });
      });
    }
  }]);

  return TriggerPanelCtrl;
}(_sdk.MetricsPanelCtrl);

TriggerPanelCtrl.templateUrl = 'panel-triggers/module.html';

function filterTriggers(triggers, triggerFilter) {
  if (utils.isRegex(triggerFilter)) {
    return _lodash2.default.filter(triggers, function (trigger) {
      return utils.buildRegex(triggerFilter).test(trigger.description);
    });
  } else {
    return _lodash2.default.filter(triggers, function (trigger) {
      return trigger.description === triggerFilter;
    });
  }
}

exports.TriggerPanelCtrl = TriggerPanelCtrl;
exports.PanelCtrl = TriggerPanelCtrl;
