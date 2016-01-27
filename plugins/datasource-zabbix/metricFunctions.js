define([
  'lodash',
  'jquery'
],
function (_, $) {
  'use strict';

  var index = [];
  var categories = {
    Transform: [],
    Aggregate: [],
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

  var optionalSeriesRefArgs = [
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true }
  ];

  addFuncDef({
    name: 'scaleToSeconds',
    category: 'Transform',
    params: [{ name: 'seconds', type: 'int' }],
    defaultParams: [1],
  });

  addFuncDef({
    name: 'groupBy',
    category: 'Transform',
    params: [
      { name: 'interval', type: 'string'},
      { name: 'function', type: 'string', options: ['avg', 'min', 'max'] }
    ],
    defaultParams: ['1m', 'avg'],
  });

  addFuncDef({
    name: 'perSecond',
    category: 'Transform',
    params: [{ name: "max value", type: "int", optional: true }],
    defaultParams: [],
  });

  addFuncDef({
    name: 'sum',
    category: 'Aggregate',
    params: [],
    defaultParams: [],
  });

  addFuncDef({
    name: 'average',
    category: 'Aggregate',
    params: [
      { name: 'interval', type: 'string' }
    ],
    defaultParams: ['1m'],
  });

  addFuncDef({
    name: 'min',
    category: 'Aggregate',
    params: [
      { name: 'interval', type: 'string' }
    ],
    defaultParams: ['1m'],
  });

  addFuncDef({
    name: 'max',
    category: 'Aggregate',
    params: [
      { name: 'interval', type: 'string' }
    ],
    defaultParams: ['1m'],
  });

  addFuncDef({
    name: 'alias',
    category: 'Alias',
    params: [
      { name: 'alias', type: 'string'}
    ],
    defaultParams: [],
  });

  addFuncDef({
    name: 'averageSeries',
    shortName: 'avg',
    category: 'Alias',
    params: optionalSeriesRefArgs,
    defaultParams: [''],
  });

  _.each(categories, function(funcList, catName) {
    categories[catName] = _.sortBy(funcList, 'name');
  });

  function FuncInstance(funcDef, options) {
    this.def = funcDef;
    this.params = [];

    if (options && options.withDefaultParams) {
      this.params = funcDef.defaultParams.slice(0);
    }

    this.updateText();
  }

  FuncInstance.prototype.bindFunction = function(metricFunctions) {
    var func = metricFunctions[this.def.name];
    if (func) {

      // Bind function arguments
      var bindedFunc = func;
      for (var i = 0; i < this.params.length; i++) {
        bindedFunc = _.partial(bindedFunc, this.params[i]);
      }
      return bindedFunc;
    } else {
      throw { message: 'Method not found ' + this.def.name };
    }
  };

  FuncInstance.prototype.render = function(metricExp) {
    var str = this.def.name + '(';
    var parameters = _.map(this.params, function(value, index) {

      var paramType = this.def.params[index].type;
      if (paramType === 'int' || paramType === 'value_or_series' || paramType === 'boolean') {
        return value;
      }
      else if (paramType === 'int_or_interval' && $.isNumeric(value)) {
        return value;
      }

      return "'" + value + "'";

    }, this);

    if (metricExp) {
      parameters.unshift(metricExp);
    }

    return str + parameters.join(', ') + ')';
  };

  FuncInstance.prototype._hasMultipleParamsInString = function(strValue, index) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    return this.def.params[index + 1] && this.def.params[index + 1].optional;
  };

  FuncInstance.prototype.updateParam = function(strValue, index) {
    // handle optional parameters
    // if string contains ',' and next param is optional, split and update both
    if (this._hasMultipleParamsInString(strValue, index)) {
      _.each(strValue.split(','), function(partVal, idx) {
        this.updateParam(partVal.trim(), idx);
      }, this);
      return;
    }

    if (strValue === '' && this.def.params[index].optional) {
      this.params.splice(index, 1);
    }
    else {
      this.params[index] = strValue;
    }

    this.updateText();
  };

  FuncInstance.prototype.updateText = function () {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    var text = this.def.name + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  };

  return {
    createFuncInstance: function(funcDef, options) {
      if (_.isString(funcDef)) {
        if (!index[funcDef]) {
          throw { message: 'Method not found ' + name };
        }
        funcDef = index[funcDef];
      }
      return new FuncInstance(funcDef, options);
    },

    getFuncDef: function(name) {
      return index[name];
    },

    getCategories: function() {
      return categories;
    }
  };

});
