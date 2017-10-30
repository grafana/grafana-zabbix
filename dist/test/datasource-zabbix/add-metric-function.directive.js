'use strict';

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _metricFunctions = require('./metricFunctions');

var metricFunctions = _interopRequireWildcard(_metricFunctions);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @ngInject */
_angular2.default.module('grafana.directives').directive('addMetricFunction', function ($compile) {
  var inputTemplate = '<input type="text"' + ' class="gf-form-input"' + ' spellcheck="false" style="display:none"></input>';

  var buttonTemplate = '<a  class="gf-form-label tight-form-func dropdown-toggle query-part"' + ' tabindex="1" gf-dropdown="functionMenu" data-toggle="dropdown">' + '<i class="fa fa-plus"></i></a>';

  return {
    link: function link($scope, elem) {
      var categories = metricFunctions.getCategories();
      var allFunctions = getAllFunctionNames(categories);

      $scope.functionMenu = createFunctionDropDownMenu(categories);

      var $input = (0, _jquery2.default)(inputTemplate);
      var $button = (0, _jquery2.default)(buttonTemplate);
      $input.appendTo(elem);
      $button.appendTo(elem);

      $input.attr('data-provide', 'typeahead');
      $input.typeahead({
        source: allFunctions,
        minLength: 1,
        items: 10,
        updater: function updater(value) {
          var funcDef = metricFunctions.getFuncDef(value);
          if (!funcDef) {
            // try find close match
            value = value.toLowerCase();
            funcDef = _lodash2.default.find(allFunctions, function (funcName) {
              return funcName.toLowerCase().indexOf(value) === 0;
            });

            if (!funcDef) {
              return;
            }
          }

          $scope.$apply(function () {
            $scope.addFunction(funcDef);
          });

          $input.trigger('blur');
          return '';
        }
      });

      $button.click(function () {
        $button.hide();
        $input.show();
        $input.focus();
      });

      $input.keyup(function () {
        elem.toggleClass('open', $input.val() === '');
      });

      $input.blur(function () {
        // clicking the function dropdown menu wont
        // work if you remove class at once
        setTimeout(function () {
          $input.val('');
          $input.hide();
          $button.show();
          elem.removeClass('open');
        }, 200);
      });

      $compile(elem.contents())($scope);
    }
  };
});

function getAllFunctionNames(categories) {
  return _lodash2.default.reduce(categories, function (list, category) {
    _lodash2.default.each(category, function (func) {
      list.push(func.name);
    });
    return list;
  }, []);
}

function createFunctionDropDownMenu(categories) {
  return _lodash2.default.map(categories, function (list, category) {
    return {
      text: category,
      submenu: _lodash2.default.map(list, function (value) {
        return {
          text: value.name,
          click: "ctrl.addFunction('" + value.name + "')"
        };
      })
    };
  });
}
