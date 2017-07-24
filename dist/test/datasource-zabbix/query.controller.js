'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ZabbixQueryController = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdk = require('app/plugins/sdk');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('./constants');

var c = _interopRequireWildcard(_constants);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

var _metricFunctions = require('./metricFunctions');

var metricFunctions = _interopRequireWildcard(_metricFunctions);

var _migrations = require('./migrations');

var migrations = _interopRequireWildcard(_migrations);

require('./add-metric-function.directive');

require('./metric-function-editor.directive');

require('./css/query-editor.css!');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ZabbixQueryController = exports.ZabbixQueryController = function (_QueryCtrl) {
  _inherits(ZabbixQueryController, _QueryCtrl);

  // ZabbixQueryCtrl constructor
  function ZabbixQueryController($scope, $injector, $rootScope, $sce, templateSrv) {
    _classCallCheck(this, ZabbixQueryController);

    var _this = _possibleConstructorReturn(this, (ZabbixQueryController.__proto__ || Object.getPrototypeOf(ZabbixQueryController)).call(this, $scope, $injector));

    _this.zabbix = _this.datasource.zabbix;

    // Use custom format for template variables
    _this.replaceTemplateVars = _this.datasource.replaceTemplateVars;
    _this.templateSrv = templateSrv;

    _this.editorModes = {
      0: { value: 'num', text: 'Metrics', mode: c.MODE_METRICS },
      1: { value: 'itservice', text: 'IT Services', mode: c.MODE_ITSERVICE },
      2: { value: 'text', text: 'Text', mode: c.MODE_TEXT }
    };

    _this.slaPropertyList = [{ name: "Status", property: "status" }, { name: "SLA", property: "sla" }, { name: "OK time", property: "okTime" }, { name: "Problem time", property: "problemTime" }, { name: "Down time", property: "downtimeTime" }];

    // Map functions for bs-typeahead
    _this.getGroupNames = _lodash2.default.bind(_this.getMetricNames, _this, 'groupList');
    _this.getHostNames = _lodash2.default.bind(_this.getMetricNames, _this, 'hostList', true);
    _this.getApplicationNames = _lodash2.default.bind(_this.getMetricNames, _this, 'appList');
    _this.getItemNames = _lodash2.default.bind(_this.getMetricNames, _this, 'itemList');
    _this.getITServices = _lodash2.default.bind(_this.getMetricNames, _this, 'itServiceList');

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', function () {
      return _this.onVariableChange();
    });

    // Update metrics when item selected from dropdown
    $scope.$on('typeahead-updated', function () {
      _this.onTargetBlur();
    });

    _this.init = function () {
      var target = this.target;

      // Migrate old targets
      target = migrations.migrate(target);

      var scopeDefaults = {
        metric: {},
        oldTarget: _lodash2.default.cloneDeep(this.target),
        queryOptionsText: this.renderQueryOptionsText()
      };
      _lodash2.default.defaults(this, scopeDefaults);

      // Load default values
      var targetDefaults = {
        'mode': c.MODE_METRICS,
        'group': { 'filter': "" },
        'host': { 'filter': "" },
        'application': { 'filter': "" },
        'item': { 'filter': "" },
        'functions': [],
        'options': {
          'showDisabledItems': false
        }
      };
      _lodash2.default.defaults(target, targetDefaults);

      // Create function instances from saved JSON
      target.functions = _lodash2.default.map(target.functions, function (func) {
        return metricFunctions.createFuncInstance(func.def, func.params);
      });

      if (target.mode === c.MODE_METRICS || target.mode === c.MODE_TEXT) {

        this.initFilters();
      } else if (target.mode === c.MODE_ITSERVICE) {
        _lodash2.default.defaults(target, { slaProperty: { name: "SLA", property: "sla" } });
        this.suggestITServices();
      }
    };

    _this.init();
    return _this;
  }

  _createClass(ZabbixQueryController, [{
    key: 'initFilters',
    value: function initFilters() {
      var itemtype = this.editorModes[this.target.mode].value;
      return Promise.all([this.suggestGroups(), this.suggestHosts(), this.suggestApps(), this.suggestItems(itemtype)]);
    }

    // Get list of metric names for bs-typeahead directive

  }, {
    key: 'getMetricNames',
    value: function getMetricNames(metricList, addAllValue) {
      var metrics = _lodash2.default.uniq(_lodash2.default.map(this.metric[metricList], 'name'));

      // Add template variables
      _lodash2.default.forEach(this.templateSrv.variables, function (variable) {
        metrics.unshift('$' + variable.name);
      });

      if (addAllValue) {
        metrics.unshift('/.*/');
      }

      return metrics;
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

      var groupFilter = this.replaceTemplateVars(this.target.group.filter);
      return this.zabbix.getAllHosts(groupFilter).then(function (hosts) {
        _this3.metric.hostList = hosts;
        return hosts;
      });
    }
  }, {
    key: 'suggestApps',
    value: function suggestApps() {
      var _this4 = this;

      var groupFilter = this.replaceTemplateVars(this.target.group.filter);
      var hostFilter = this.replaceTemplateVars(this.target.host.filter);
      return this.zabbix.getAllApps(groupFilter, hostFilter).then(function (apps) {
        _this4.metric.appList = apps;
        return apps;
      });
    }
  }, {
    key: 'suggestItems',
    value: function suggestItems() {
      var _this5 = this;

      var itemtype = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'num';

      var groupFilter = this.replaceTemplateVars(this.target.group.filter);
      var hostFilter = this.replaceTemplateVars(this.target.host.filter);
      var appFilter = this.replaceTemplateVars(this.target.application.filter);
      var options = {
        itemtype: itemtype,
        showDisabledItems: this.target.options.showDisabledItems
      };

      return this.zabbix.getAllItems(groupFilter, hostFilter, appFilter, options).then(function (items) {
        _this5.metric.itemList = items;
        return items;
      });
    }
  }, {
    key: 'suggestITServices',
    value: function suggestITServices() {
      var _this6 = this;

      return this.zabbix.getITService().then(function (itservices) {
        _this6.metric.itServiceList = itservices;
        return itservices;
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
  }, {
    key: 'onTargetBlur',
    value: function onTargetBlur() {
      var newTarget = _lodash2.default.cloneDeep(this.target);
      if (!_lodash2.default.isEqual(this.oldTarget, this.target)) {
        this.oldTarget = newTarget;
        this.targetChanged();
      }
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
      var _this7 = this;

      return _lodash2.default.some(['group', 'host', 'application'], function (field) {
        if (_this7.target[field] && _this7.target[field].filter) {
          return utils.isTemplateVariable(_this7.target[field].filter, _this7.templateSrv.variables);
        } else {
          return false;
        }
      });
    }
  }, {
    key: 'parseTarget',
    value: function parseTarget() {}
    // Parse target


    // Validate target and set validation info

  }, {
    key: 'validateTarget',
    value: function validateTarget() {
      // validate
    }
  }, {
    key: 'targetChanged',
    value: function targetChanged() {
      this.initFilters();
      this.parseTarget();
      this.panelCtrl.refresh();
    }
  }, {
    key: 'addFunction',
    value: function addFunction(funcDef) {
      var newFunc = metricFunctions.createFuncInstance(funcDef);
      newFunc.added = true;
      this.target.functions.push(newFunc);

      this.moveAliasFuncLast();

      if (newFunc.params.length && newFunc.added || newFunc.def.params.length === 0) {
        this.targetChanged();
      }
    }
  }, {
    key: 'removeFunction',
    value: function removeFunction(func) {
      this.target.functions = _lodash2.default.without(this.target.functions, func);
      this.targetChanged();
    }
  }, {
    key: 'moveAliasFuncLast',
    value: function moveAliasFuncLast() {
      var aliasFunc = _lodash2.default.find(this.target.functions, function (func) {
        return func.def.name === 'alias' || func.def.name === 'aliasByNode' || func.def.name === 'aliasByMetric';
      });

      if (aliasFunc) {
        this.target.functions = _lodash2.default.without(this.target.functions, aliasFunc);
        this.target.functions.push(aliasFunc);
      }
    }
  }, {
    key: 'toggleQueryOptions',
    value: function toggleQueryOptions() {
      this.showQueryOptions = !this.showQueryOptions;
    }
  }, {
    key: 'onQueryOptionChange',
    value: function onQueryOptionChange() {
      this.queryOptionsText = this.renderQueryOptionsText();
      this.onTargetBlur();
    }
  }, {
    key: 'renderQueryOptionsText',
    value: function renderQueryOptionsText() {
      var optionsMap = {
        showDisabledItems: "Show disabled items"
      };
      var options = [];
      _lodash2.default.forOwn(this.target.options, function (value, key) {
        if (value) {
          if (value === true) {
            // Show only option name (if enabled) for boolean options
            options.push(optionsMap[key]);
          } else {
            // Show "option = value" for another options
            options.push(optionsMap[key] + " = " + value);
          }
        }
      });
      return "Options: " + options.join(', ');
    }

    /**
     * Switch query editor to specified mode.
     * Modes:
     *  0 - items
     *  1 - IT services
     *  2 - Text metrics
     */

  }, {
    key: 'switchEditorMode',
    value: function switchEditorMode(mode) {
      this.target.mode = mode;
      this.init();
    }
  }]);

  return ZabbixQueryController;
}(_sdk.QueryCtrl);

// Set templateUrl as static property


ZabbixQueryController.templateUrl = 'datasource-zabbix/partials/query.editor.html';
