'use strict';

System.register(['angular', 'lodash'], function (_export, _context) {
  "use strict";

  var angular, _, _createClass, template, DatasourceSelectorCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_lodash) {
      _ = _lodash.default;
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

      template = '\n<value-select-dropdown variable="ctrl.dsOptions" on-updated="ctrl.onChange(ctrl.dsOptions)">\n</value-select-dropdown>\n';


      angular.module('grafana.directives').directive('datasourceSelector', function () {
        return {
          scope: {
            datasources: "=",
            options: "=",
            onChange: "&"
          },
          controller: DatasourceSelectorCtrl,
          controllerAs: 'ctrl',
          template: template
        };
      });

      DatasourceSelectorCtrl = function () {

        /** @ngInject */
        function DatasourceSelectorCtrl($scope) {
          _classCallCheck(this, DatasourceSelectorCtrl);

          this.scope = $scope;
          var datasources = $scope.datasources;
          var options = $scope.options;
          this.dsOptions = {
            multi: true,
            current: { value: datasources, text: datasources.join(" + ") },
            options: _.map(options, function (ds) {
              return { text: ds, value: ds, selected: _.includes(datasources, ds) };
            })
          };
        }

        _createClass(DatasourceSelectorCtrl, [{
          key: 'onChange',
          value: function onChange(updatedOptions) {
            var _this = this;

            var newDataSources = updatedOptions.current.value;
            this.scope.datasources = newDataSources;

            // Run after model was changed
            this.scope.$$postDigest(function () {
              _this.scope.onChange();
            });
          }
        }]);

        return DatasourceSelectorCtrl;
      }();
    }
  };
});
//# sourceMappingURL=datasource-selector.directive.js.map
