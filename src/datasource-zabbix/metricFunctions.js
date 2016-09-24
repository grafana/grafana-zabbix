import _ from 'lodash';
import $ from 'jquery';

var index = [];
var categories = {
  Transform: [],
  Aggregate: [],
  Filter: [],
  Trends: [],
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

addFuncDef({
  name: 'groupBy',
  category: 'Transform',
  params: [
    { name: 'interval', type: 'string'},
    { name: 'function', type: 'string', options: ['avg', 'min', 'max', 'median'] }
  ],
  defaultParams: ['1m', 'avg'],
});

addFuncDef({
  name: 'scale',
  category: 'Transform',
  params: [
    { name: 'factor', type: 'float', options: [100, 0.01, 10, -1]}
  ],
  defaultParams: [100],
});

addFuncDef({
  name: 'delta',
  category: 'Transform',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'sumSeries',
  category: 'Aggregate',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'median',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string'}
  ],
  defaultParams: ['1m'],
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
  name: 'aggregateBy',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' },
    { name: 'function', type: 'string', options: ['avg', 'min', 'max', 'median'] }
  ],
  defaultParams: ['1m', 'avg'],
});

addFuncDef({
  name: 'top',
  category: 'Filter',
  params: [
    { name: 'number', type: 'int' },
    { name: 'value', type: 'string', options: ['avg', 'min', 'max', 'median'] }
  ],
  defaultParams: [5, 'avg'],
});

addFuncDef({
  name: 'bottom',
  category: 'Filter',
  params: [
    { name: 'number', type: 'int' },
    { name: 'value', type: 'string', options: ['avg', 'min', 'max', 'median'] }
  ],
  defaultParams: [5, 'avg'],
});

addFuncDef({
  name: 'trendValue',
  category: 'Trends',
  params: [
    { name: 'type', type: 'string', options: ['avg', 'min', 'max'] }
  ],
  defaultParams: ['avg'],
});

addFuncDef({
  name: 'setAlias',
  category: 'Alias',
  params: [
    { name: 'alias', type: 'string'}
  ],
  defaultParams: [],
});

_.each(categories, function(funcList, catName) {
  categories[catName] = _.sortBy(funcList, 'name');
});

class FuncInstance {
  constructor(funcDef, params) {
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

  bindFunction(metricFunctions) {
    var func = metricFunctions[this.def.name];
    if (func) {

      // Bind function arguments
      var bindedFunc = func;
      var param;
      for (var i = 0; i < this.params.length; i++) {
        param = this.params[i];

        // Convert numeric params
        if (this.def.params[i].type === 'int' ||
            this.def.params[i].type === 'float') {
          param = Number(param);
        }
        bindedFunc = _.partial(bindedFunc, param);
      }
      return bindedFunc;
    } else {
      throw { message: 'Method not found ' + this.def.name };
    }
  }

  render(metricExp) {
    var str = this.def.name + '(';
    var parameters = _.map(this.params, function(value, index) {

      var paramType = this.def.params[index].type;
      if (paramType === 'int' ||
          paramType === 'float' ||
          paramType === 'value_or_series' ||
          paramType === 'boolean') {
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
  }

  _hasMultipleParamsInString(strValue, index) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    return this.def.params[index + 1] && this.def.params[index + 1].optional;
  }

  updateParam(strValue, index) {
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
  }

  updateText() {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    var text = this.def.name + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  }
}

export function createFuncInstance(funcDef, params) {
  if (_.isString(funcDef)) {
    if (!index[funcDef]) {
      throw { message: 'Method not found ' + name };
    }
    funcDef = index[funcDef];
  }
  return new FuncInstance(funcDef, params);
}

export function getFuncDef(name) {
  return index[name];
}

export function getCategories() {
  return categories;
}
