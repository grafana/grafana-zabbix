'use strict';

System.register(['lodash', '../datasource-zabbix/utils', './datasource-selector.directive', '../datasource-zabbix/css/query-editor.css!'], function (_export, _context) {
  "use strict";

  var _, utils, _createClass, ZABBIX_DS_ID, DEFAULT_TARGET, TriggersTabCtrl;

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
    }, function (_datasourceSelectorDirective) {}, function (_datasourceZabbixCssQueryEditorCss) {}],
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

      ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';
      DEFAULT_TARGET = {
        group: { filter: "" },
        host: { filter: "" },
        application: { filter: "" },
        trigger: { filter: "" }
      };

      TriggersTabCtrl = function () {

        /** @ngInject */
        function TriggersTabCtrl($scope, $rootScope, uiSegmentSrv, datasourceSrv, templateSrv) {
          _classCallCheck(this, TriggersTabCtrl);

          $scope.editor = this;
          this.panelCtrl = $scope.ctrl;
          this.panel = this.panelCtrl.panel;
          this.datasourceSrv = datasourceSrv;
          this.templateSrv = templateSrv;

          // Load scope defaults
          var scopeDefaults = {
            datasources: {},
            getGroupNames: {},
            getHostNames: {},
            getApplicationNames: {},
            oldTarget: _.cloneDeep(this.panel.targets)
          };
          _.defaultsDeep(this, scopeDefaults);

          this.available_datasources = _.map(this.getZabbixDataSources(), 'name');
          if (!this.panel.datasource) {
            this.panel.datasource = this.available_datasources[0];
          }

          this.initDatasources();
          this.panelCtrl.refresh();
        }

        _createClass(TriggersTabCtrl, [{
          key: 'initDatasources',
          value: function initDatasources() {
            var _this = this;

            _.each(this.panel.datasources, function (ds) {
              // Load datasource
              _this.datasourceSrv.get(ds).then(function (datasource) {
                _this.panelCtrl.datasources[ds] = datasource;
                _this.datasources[ds] = datasource;

                // Map functions for bs-typeahead
                _this.getGroupNames[ds] = _.bind(_this.suggestGroups, _this, datasource);
                _this.getHostNames[ds] = _.bind(_this.suggestHosts, _this, datasource);
                _this.getApplicationNames[ds] = _.bind(_this.suggestApps, _this, datasource);
              });
            });
          }
        }, {
          key: 'getZabbixDataSources',
          value: function getZabbixDataSources() {
            return _.filter(this.datasourceSrv.getMetricSources(), function (datasource) {
              return datasource.meta.id === ZABBIX_DS_ID && datasource.value;
            });
          }
        }, {
          key: 'suggestGroups',
          value: function suggestGroups(ds, query, callback) {
            return ds.zabbix.getAllGroups().then(function (groups) {
              return _.map(groups, 'name');
            }).then(callback);
          }
        }, {
          key: 'suggestHosts',
          value: function suggestHosts(ds, query, callback) {
            var groupFilter = ds.replaceTemplateVars(this.panel.targets[ds.name].group.filter);
            return ds.zabbix.getAllHosts(groupFilter).then(function (hosts) {
              return _.map(hosts, 'name');
            }).then(callback);
          }
        }, {
          key: 'suggestApps',
          value: function suggestApps(ds, query, callback) {
            var groupFilter = ds.replaceTemplateVars(this.panel.targets[ds.name].group.filter);
            var hostFilter = ds.replaceTemplateVars(this.panel.targets[ds.name].host.filter);
            return ds.zabbix.getAllApps(groupFilter, hostFilter).then(function (apps) {
              return _.map(apps, 'name');
            }).then(callback);
          }
        }, {
          key: 'datasourcesChanged',
          value: function datasourcesChanged() {
            var _this2 = this;

            _.each(this.panel.datasources, function (ds) {
              if (!_this2.panel.targets[ds]) {
                _this2.panel.targets[ds] = DEFAULT_TARGET;
              }
            });
            this.parseTarget();
          }
        }, {
          key: 'parseTarget',
          value: function parseTarget() {
            this.initDatasources();
            var newTarget = _.cloneDeep(this.panel.targets);
            if (!_.isEqual(this.oldTarget, newTarget)) {
              this.oldTarget = newTarget;
            }
            this.panelCtrl.refresh();
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
