import angular from 'angular';
import _ from 'lodash';

const template = `
<value-select-dropdown
  variable="ctrl.dsOptions"
  on-updated="ctrl.onChange(ctrl.dsOptions)"
  dashboard="ctrl.dashboard">
</value-select-dropdown>
`;

angular
.module('grafana.directives')
.directive('datasourceSelector', () => {
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

class DatasourceSelectorCtrl {

  /** @ngInject */
  constructor($scope) {
    this.scope = $scope;
    let datasources = $scope.datasources;
    let options = $scope.options;
    this.dsOptions = {
      multi: true,
      current: {value: datasources, text: datasources.join(" + ")},
      options: _.map(options, (ds) => {
        return {text: ds, value: ds, selected: _.includes(datasources, ds)};
      })
    };
    // Fix for Grafana 6.0
    // https://github.com/grafana/grafana/blob/v6.0.0/public/app/core/directives/value_select_dropdown.ts#L291
    this.dashboard = {
      on: () => {}
    };
  }

  onChange(updatedOptions) {
    let newDataSources = updatedOptions.current.value;
    this.scope.datasources = newDataSources;

    // Run after model was changed
    this.scope.$$postDigest(() => {
      this.scope.onChange();
    });
  }
}
