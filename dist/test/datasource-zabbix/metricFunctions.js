'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.createFuncInstance = createFuncInstance;
exports.getFuncDef = getFuncDef;
exports.getCategories = getCategories;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var index = [];
var categories = {
  Transform: [],
  Aggregate: [],
  Filter: [],
  Trends: [],
  Time: [],
  Alias: []
};

function addFuncDef(funcDef) {
  funcDef.params = funcDef.params || [];
  funcDef.defaultParams = funcDef.defaultParams || [];

  if (funcDef.category) {
    categories[funcDef.category].push(funcDef);
  }
  index[funcDef.name] = funcDef;
  index[funcDef.shortName || funcDef.name] = funcDef;
}

// Transform

addFuncDef({
  name: 'groupBy',
  category: 'Transform',
  params: [{ name: 'interval', type: 'string' }, { name: 'function', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }],
  defaultParams: ['1m', 'avg']
});

addFuncDef({
  name: 'scale',
  category: 'Transform',
  params: [{ name: 'factor', type: 'float', options: [100, 0.01, 10, -1] }],
  defaultParams: [100]
});

addFuncDef({
  name: 'delta',
  category: 'Transform',
  params: [],
  defaultParams: []
});

addFuncDef({
  name: 'rate',
  category: 'Transform',
  params: [],
  defaultParams: []
});

addFuncDef({
  name: 'simpleMovingAverage',
  category: 'Transform',
  params: [{ name: 'factor', type: 'int', options: [6, 10, 60, 600] }],
  defaultParams: [10]
});

addFuncDef({
  name: 'expMovingAverage',
  category: 'Transform',
  params: [{ name: 'smoothing', type: 'float', options: [0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9] }],
  defaultParams: [0.2]
});

// Aggregate

addFuncDef({
  name: 'sumSeries',
  category: 'Aggregate',
  params: [],
  defaultParams: []
});

addFuncDef({
  name: 'median',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['1m']
});

addFuncDef({
  name: 'average',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['1m']
});

addFuncDef({
  name: 'min',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['1m']
});

addFuncDef({
  name: 'max',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['1m']
});

addFuncDef({
  name: 'sum',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['1m']
});

addFuncDef({
  name: 'count',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['1m']
});

addFuncDef({
  name: 'aggregateBy',
  category: 'Aggregate',
  params: [{ name: 'interval', type: 'string' }, { name: 'function', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }],
  defaultParams: ['1m', 'avg']
});

// Filter

addFuncDef({
  name: 'top',
  category: 'Filter',
  params: [{ name: 'number', type: 'int' }, { name: 'value', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }],
  defaultParams: [5, 'avg']
});

addFuncDef({
  name: 'bottom',
  category: 'Filter',
  params: [{ name: 'number', type: 'int' }, { name: 'value', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }],
  defaultParams: [5, 'avg']
});

// Trends

addFuncDef({
  name: 'trendValue',
  category: 'Trends',
  params: [{ name: 'type', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count'] }],
  defaultParams: ['avg']
});

// Time

addFuncDef({
  name: 'timeShift',
  category: 'Time',
  params: [{ name: 'interval', type: 'string', options: ['24h', '7d', '1M', '+24h', '-24h'] }],
  defaultParams: ['24h']
});

//Alias

addFuncDef({
  name: 'setAlias',
  category: 'Alias',
  params: [{ name: 'alias', type: 'string' }],
  defaultParams: []
});

addFuncDef({
  name: 'setAliasByRegex',
  category: 'Alias',
  params: [{ name: 'aliasByRegex', type: 'string' }],
  defaultParams: []
});

addFuncDef({
  name: 'replaceAlias',
  category: 'Alias',
  params: [{ name: 'regexp', type: 'string' }, { name: 'newAlias', type: 'string' }],
  defaultParams: ['/(.*)/', '$1']
});

_lodash2.default.each(categories, function (funcList, catName) {
  categories[catName] = _lodash2.default.sortBy(funcList, 'name');
});

var FuncInstance = function () {
  function FuncInstance(funcDef, params) {
    _classCallCheck(this, FuncInstance);

    this.def = funcDef;

    if (params) {
      this.params = params;
    } else {
      // Create with default params
      this.params = [];
      this.params = funcDef.defaultParams.slice(0);
    }

    this.updateText();
  }

  _createClass(FuncInstance, [{
    key: 'bindFunction',
    value: function bindFunction(metricFunctions) {
      var func = metricFunctions[this.def.name];
      if (func) {

        // Bind function arguments
        var bindedFunc = func;
        var param;
        for (var i = 0; i < this.params.length; i++) {
          param = this.params[i];

          // Convert numeric params
          if (this.def.params[i].type === 'int' || this.def.params[i].type === 'float') {
            param = Number(param);
          }
          bindedFunc = _lodash2.default.partial(bindedFunc, param);
        }
        return bindedFunc;
      } else {
        throw { message: 'Method not found ' + this.def.name };
      }
    }
  }, {
    key: 'render',
    value: function render(metricExp) {
      var str = this.def.name + '(';
      var parameters = _lodash2.default.map(this.params, function (value, index) {

        var paramType = this.def.params[index].type;
        if (paramType === 'int' || paramType === 'float' || paramType === 'value_or_series' || paramType === 'boolean') {
          return value;
        } else if (paramType === 'int_or_interval' && _jquery2.default.isNumeric(value)) {
          return value;
        }

        return "'" + value + "'";
      }, this);

      if (metricExp) {
        parameters.unshift(metricExp);
      }

      return str + parameters.join(', ') + ')';
    }
  }, {
    key: '_hasMultipleParamsInString',
    value: function _hasMultipleParamsInString(strValue, index) {
      if (strValue.indexOf(',') === -1) {
        return false;
      }

      return this.def.params[index + 1] && this.def.params[index + 1].optional;
    }
  }, {
    key: 'updateParam',
    value: function updateParam(strValue, index) {
      // handle optional parameters
      // if string contains ',' and next param is optional, split and update both
      if (this._hasMultipleParamsInString(strValue, index)) {
        _lodash2.default.each(strValue.split(','), function (partVal, idx) {
          this.updateParam(partVal.trim(), idx);
        }, this);
        return;
      }

      if (strValue === '' && this.def.params[index].optional) {
        this.params.splice(index, 1);
      } else {
        this.params[index] = strValue;
      }

      this.updateText();
    }
  }, {
    key: 'updateText',
    value: function updateText() {
      if (this.params.length === 0) {
        this.text = this.def.name + '()';
        return;
      }

      var text = this.def.name + '(';
      text += this.params.join(', ');
      text += ')';
      this.text = text;
    }
  }]);

  return FuncInstance;
}();

function createFuncInstance(funcDef, params) {
  if (_lodash2.default.isString(funcDef)) {
    if (!index[funcDef]) {
      throw { message: 'Method not found ' + name };
    }
    funcDef = index[funcDef];
  }
  return new FuncInstance(funcDef, params);
}

function getFuncDef(name) {
  return index[name];
}

function getCategories() {
  return categories;
}
