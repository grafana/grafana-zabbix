'use strict';

System.register(['lodash', '../datasource-zabbix/utils', './triggers_panel_ctrl'], function (_export, _context) {
  "use strict";

  var _, utils, DEFAULT_TARGET, _createClass, TriggersTabCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function triggerPanelTriggersTab() {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/triggers_tab.html',
      controller: TriggersTabCtrl
    };
  }

  _export('triggerPanelTriggersTab', triggerPanelTriggersTab);

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_datasourceZabbixUtils) {
      utils = _datasourceZabbixUtils;
    }, function (_triggers_panel_ctrl) {
      DEFAULT_TARGET = _triggers_panel_ctrl.DEFAULT_TARGET;
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

      TriggersTabCtrl = function () {

        /** @ngInject */
        function TriggersTabCtrl($scope, $rootScope, uiSegmentSrv, templateSrv) {
          _classCallCheck(this, TriggersTabCtrl);

          $scope.editor = this;
          this.panelCtrl = $scope.ctrl;
          this.panel = this.panelCtrl.panel;
          this.templateSrv = templateSrv;
          this.datasources = this.panelCtrl.datasources;

          // Load scope defaults
          var scopeDefaults = {
            getGroupNames: {},
            getHostNames: {},
            getApplicationNames: {},
            oldTarget: _.cloneDeep(this.panel.targets)
          };
          _.defaultsDeep(this, scopeDefaults);

          this.initDatasources();
          this.panelCtrl.refresh();
        }

        _createClass(TriggersTabCtrl, [{
          key: 'initDatasources',
          value: function initDatasources() {
            var _this = this;

            return this.panelCtrl.initDatasources().then(function (datasources) {
              _.each(datasources, function (datasource) {
                _this.bindSuggestionFunctions(datasource);
              });
            });
          }
        }, {
          key: 'bindSuggestionFunctions',
          value: function bindSuggestionFunctions(datasource) {
            // Map functions for bs-typeahead
            var ds = datasource.name;
            this.getGroupNames[ds] = _.bind(this.suggestGroups, this, datasource);
            this.getHostNames[ds] = _.bind(this.suggestHosts, this, datasource);
            this.getApplicationNames[ds] = _.bind(this.suggestApps, this, datasource);
          }
        }, {
          key: 'suggestGroups',
          value: function suggestGroups(datasource, query, callback) {
            return datasource.zabbix.getAllGroups().then(function (groups) {
              return _.map(groups, 'name');
            }).then(callback);
          }
        }, {
          key: 'suggestHosts',
          value: function suggestHosts(datasource, query, callback) {
            var groupFilter = datasource.replaceTemplateVars(this.panel.targets[datasource.name].group.filter);
            return datasource.zabbix.getAllHosts(groupFilter).then(function (hosts) {
              return _.map(hosts, 'name');
            }).then(callback);
          }
        }, {
          key: 'suggestApps',
          value: function suggestApps(datasource, query, callback) {
            var groupFilter = datasource.replaceTemplateVars(this.panel.targets[datasource.name].group.filter);
            var hostFilter = datasource.replaceTemplateVars(this.panel.targets[datasource.name].host.filter);
            return datasource.zabbix.getAllApps(groupFilter, hostFilter).then(function (apps) {
              return _.map(apps, 'name');
            }).then(callback);
          }
        }, {
          key: 'datasourcesChanged',
          value: function datasourcesChanged() {
            var _this2 = this;

            _.each(this.panel.datasources, function (ds) {
              if (!_this2.panel.targets[ds]) {
                _this2.panel.targets[ds] = _.cloneDeep(DEFAULT_TARGET);
              }
            });
            this.parseTarget();
          }
        }, {
          key: 'parseTarget',
          value: function parseTarget() {
            var _this3 = this;

            this.initDatasources().then(function () {
              var newTarget = _.cloneDeep(_this3.panel.targets);
              if (!_.isEqual(_this3.oldTarget, newTarget)) {
                _this3.oldTarget = newTarget;
              }
              _this3.panelCtrl.refresh();
            });
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
        }]);

        return TriggersTabCtrl;
      }();
    }
  };
});
//# sourceMappingURL=triggers_tab.js.map
