'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var TriggerPanelOptionsCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function triggerPanelOptionsTab() {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/options_tab.html',
      controller: TriggerPanelOptionsCtrl
    };
  }

  _export('triggerPanelOptionsTab', triggerPanelOptionsTab);

  return {
    setters: [],
    execute: function () {
      TriggerPanelOptionsCtrl =

      /** @ngInject */
      function TriggerPanelOptionsCtrl($scope) {
        _classCallCheck(this, TriggerPanelOptionsCtrl);

        $scope.editor = this;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;

        this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
        this.ackFilters = ['all triggers', 'unacknowledged', 'acknowledged'];
        this.sortByFields = [{ text: 'last change', value: 'lastchange' }, { text: 'severity', value: 'priority' }];
        this.showEventsFields = [{ text: 'All', value: [0, 1] }, { text: 'OK', value: [0] }, { text: 'Problems', value: 1 }];
      };
    }
  };
});
//# sourceMappingURL=options_tab.js.map
