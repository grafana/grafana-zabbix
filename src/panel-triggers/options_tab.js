/**
 * Grafana-Zabbix
 * Zabbix plugin for Grafana.
 * http://github.com/alexanderzobnin/grafana-zabbix
 *
 * Trigger panel.
 * This feature sponsored by CORE IT
 * http://www.coreit.fr
 *
 * Copyright 2015 Alexander Zobnin alexanderzobnin@gmail.com
 * Licensed under the Apache License, Version 2.0
 */

class TriggerPanelOptionsCtrl {

  /** @ngInject */
  constructor($scope) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
    this.ackFilters = [
      'all triggers',
      'unacknowledged',
      'acknowledged'
    ];
    this.sortByFields = [
      { text: 'last change',  value: 'lastchange' },
      { text: 'severity',     value: 'priority' }
    ];
    this.showEventsFields = [
      { text: 'All',     value: [0,1] },
      { text: 'OK',      value: [0] },
      { text: 'Problems', value: 1 }
    ];
  }
}

export function triggerPanelOptionsTab() {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/options_tab.html',
    controller: TriggerPanelOptionsCtrl,
  };
}
