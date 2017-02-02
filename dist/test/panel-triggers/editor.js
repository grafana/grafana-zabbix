'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
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

exports.triggerPanelEditor = triggerPanelEditor;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('../datasource-zabbix/utils');

var utils = _interopRequireWildcard(_utils);

require('../datasource-zabbix/css/query-editor.css!');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TriggerPanelEditorCtrl = function () {

  /** @ngInject */
  function TriggerPanelEditorCtrl($scope, $rootScope, uiSegmentSrv, datasourceSrv, templateSrv, popoverSrv) {
    var _this = this;

    _classCallCheck(this, TriggerPanelEditorCtrl);

    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.popoverSrv = popoverSrv;

    // Map functions for bs-typeahead
    this.getGroupNames = _lodash2.default.partial(getMetricNames, this, 'groupList');
    this.getHostNames = _lodash2.default.partial(getMetricNames, this, 'hostList');
    this.getApplicationNames = _lodash2.default.partial(getMetricNames, this, 'appList');

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', function () {
      return _this.onVariableChange();
    });

    this.ackFilters = ['all triggers', 'unacknowledged', 'acknowledged'];

    this.sortByFields = [{ text: 'last change', value: 'lastchange' }, { text: 'severity', value: 'priority' }];

    this.showEventsFields = [{ text: 'All', value: [0, 1] }, { text: 'OK', value: [0] }, { text: 'Problems', value: 1 }];

    // Load scope defaults
    var scopeDefaults = {
      metric: {},
      inputStyles: {},
      oldTarget: _lodash2.default.cloneDeep(this.panel.triggers)
    };
    _lodash2.default.defaults(this, scopeDefaults);

    // Set default datasource
    this.datasources = _lodash2.default.map(this.getZabbixDataSources(), 'name');
    if (!this.panel.datasource) {
      this.panel.datasource = this.datasources[0];
    }
    // Load datasource
    this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
      _this.datasource = datasource;
      _this.zabbix = datasource.zabbix;
      _this.queryBuilder = datasource.queryBuilder;
      _this.initFilters();
      _this.panelCtrl.refresh();
    });
  }

  _createClass(TriggerPanelEditorCtrl, [{
    key: 'initFilters',
    value: function initFilters() {
      return Promise.all([this.suggestGroups(), this.suggestHosts(), this.suggestApps()]);
    }
  }, {
    key: 'suggestGroups',
    value: function suggestGroups() {
      var _this2 = this;

      return this.zabbix.getAllGroups().then(function (groups) {
        _this2.metric.groupList = groups;
        return groups;
      });
    }
  }, {
    key: 'suggestHosts',
    value: function suggestHosts() {
      var _this3 = this;

      var groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
      return this.zabbix.getAllHosts(groupFilter).then(function (hosts) {
        _this3.metric.hostList = hosts;
        return hosts;
      });
    }
  }, {
    key: 'suggestApps',
    value: function suggestApps() {
      var _this4 = this;

      var groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
      var hostFilter = this.datasource.replaceTemplateVars(this.panel.triggers.host.filter);
      return this.zabbix.getAllApps(groupFilter, hostFilter).then(function (apps) {
        _this4.metric.appList = apps;
        return apps;
      });
    }
  }, {
    key: 'onVariableChange',
    value: function onVariableChange() {
      if (this.isContainsVariables()) {
        this.targetChanged();
      }
    }

    /**
     * Check query for template variables
     */

  }, {
    key: 'isContainsVariables',
    value: function isContainsVariables() {
      var _this5 = this;

      return _lodash2.default.some(['group', 'host', 'application'], function (field) {
        return utils.isTemplateVariable(_this5.panel.triggers[field].filter, _this5.templateSrv.variables);
      });
    }
  }, {
    key: 'targetChanged',
    value: function targetChanged() {
      this.initFilters();
      this.panelCtrl.refresh();
    }
  }, {
    key: 'parseTarget',
    value: function parseTarget() {
      this.initFilters();
      var newTarget = _lodash2.default.cloneDeep(this.panel.triggers);
      if (!_lodash2.default.isEqual(this.oldTarget, this.panel.triggers)) {
        this.oldTarget = newTarget;
        this.panelCtrl.refresh();
      }
    }
  }, {
    key: 'refreshTriggerSeverity',
    value: function refreshTriggerSeverity() {
      _lodash2.default.each(this.triggerList, function (trigger) {
        trigger.color = this.panel.triggerSeverity[trigger.priority].color;
        trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;
      });
      this.panelCtrl.refresh();
    }
  }, {
    key: 'datasourceChanged',
    value: function datasourceChanged() {
      this.panelCtrl.refresh();
    }
  }, {
    key: 'changeTriggerSeverityColor',
    value: function changeTriggerSeverityColor(trigger, color) {
      this.panel.triggerSeverity[trigger.priority].color = color;
      this.refreshTriggerSeverity();
    }
  }, {
    key: 'isRegex',
    value: function isRegex(str) {
      return utils.isRegex(str);
    }
  }, {
    key: 'isVariable',
    value: function isVariable(str) {
      return utils.isTemplateVariable(str, this.templateSrv.variables);
    }
  }, {
    key: 'getZabbixDataSources',
    value: function getZabbixDataSources() {
      var ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';
      return _lodash2.default.filter(this.datasourceSrv.getMetricSources(), function (datasource) {
        return datasource.meta.id === ZABBIX_DS_ID && datasource.value;
      });
    }
  }]);

  return TriggerPanelEditorCtrl;
}();

// Get list of metric names for bs-typeahead directive


function getMetricNames(scope, metricList) {
  return _lodash2.default.uniq(_lodash2.default.map(scope.metric[metricList], 'name'));
}

function triggerPanelEditor() {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/editor.html',
    controller: TriggerPanelEditorCtrl
  };
}
