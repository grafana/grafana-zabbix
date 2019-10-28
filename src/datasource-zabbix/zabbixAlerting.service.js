import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';

class ZabbixAlertingService {

  /** @ngInject */
  constructor(dashboardSrv) {
    this.dashboardSrv = dashboardSrv;
  }

  isFullScreen() {
    return this.getDashboardModel().meta.fullscreen;
  }

  setPanelAlertState(panelId, alertState) {
    let panelIndex;

    let panelContainers = _.filter($('.panel-container'), elem => {
      return elem.clientHeight && elem.clientWidth;
    });

    let panelModels = this.getPanelModels();

    if (this.isFullScreen()) {
      panelIndex = 0;
    } else {
      panelIndex = _.findIndex(panelModels, panel => {
        return panel.id === panelId;
      });
    }

    // Don't apply alert styles to .panel-container--absolute (it rewrites position from absolute to relative)
    if (panelIndex >= 0 && !panelContainers[panelIndex].className.includes('panel-container--absolute')) {
      let alertClass = "panel-has-alert panel-alert-state--ok panel-alert-state--alerting";
      $(panelContainers[panelIndex]).removeClass(alertClass);

      if (alertState) {
        alertClass = "panel-has-alert panel-alert-state--" + alertState;
        $(panelContainers[panelIndex]).addClass(alertClass);
      }
    }
  }

  getDashboardModel() {
    return this.dashboardSrv.dash || this.dashboardSrv.dashboard;
  }

  getPanelModels() {
    return _.filter(this.getDashboardModel().panels, panel => panel.type !== 'row');
  }

  getPanelModel(panelId) {
    let panelModels = this.getPanelModels();

    return _.find(panelModels, panel => {
      return panel.id === panelId;
    });
  }

  setPanelThreshold(panelId, threshold) {
    let panel = this.getPanelModel(panelId);
    let containsThreshold = _.find(panel.thresholds, {value: threshold});

    if (panel && panel.type === "graph" && !containsThreshold) {
      let thresholdOptions = {
        colorMode : "custom",
        fill : false,
        line : true,
        lineColor: "rgb(255, 0, 0)",
        op: "gt",
        value: threshold,
        source: "zabbix"
      };

      panel.thresholds.push(thresholdOptions);
    }
  }

  removeZabbixThreshold(panelId) {
    let panel = this.getPanelModel(panelId);

    if (panel && panel.type === "graph") {
      panel.thresholds = _.filter(panel.thresholds, threshold => {
        return threshold.source !== "zabbix";
      });
    }
  }

}

angular
  .module('grafana.services')
  .service('zabbixAlertingSrv', ZabbixAlertingService);
