import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';

const AUTO_THRESHOLDS_KEYWORD = "$auto";

class ZabbixAlertingService {

  /** @ngInject */
  constructor(dashboardSrv) {
    this.dashboardSrv = dashboardSrv;
  }

  isFullScreen() {
    return this.dashboardSrv.dash.meta.fullscreen;
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

    if (panelIndex >= 0) {
      let alertClass = "panel-has-alert panel-alert-state--ok panel-alert-state--alerting";
      $(panelContainers[panelIndex]).removeClass(alertClass);

      if (alertState) {
        if (alertState === 'alerting') {
          alertClass = "panel-has-alert panel-alert-state--" + alertState;
          $(panelContainers[panelIndex]).addClass(alertClass);
        }
        if (alertState === 'ok') {
          alertClass = "panel-alert-state--" + alertState;
          $(panelContainers[panelIndex]).addClass(alertClass);
          $(panelContainers[panelIndex]).removeClass("panel-has-alert");
        }
      }
    }
  }

  getPanelModels() {
    return _.flatten(_.map(this.dashboardSrv.dash.rows, row => {
      if (row.collapse) {
        return [];
      } else {
        return row.panels;
      }
    }));
  }

  getPanelModel(panelId) {
    let panelModels = this.getPanelModels();

    return _.find(panelModels, panel => {
      return panel.id === panelId;
    });
  }

  setSingleStatThresholds(panelId, thresholds) {
    if (!thresholds || thresholds.length === 0) {
      return;
    }

    let panel = this.getPanelModel(panelId);
    if (panel && panel.type === "singlestat" && panel.thresholds === AUTO_THRESHOLDS_KEYWORD) {
      let parsedThresholds = parseThresholds(thresholds);
      panel.thresholds = parsedThresholds.join();
      let maxThreshold = parsedThresholds[1];
      panel.gauge.maxValue = Math.ceil(maxThreshold * 1.1);
    }
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

function parseThresholds(thresholds) {
  if(thresholds.length === 1) {
    return [thresholds[0], thresholds[0]];
  }

  return [thresholds[0], thresholds[thresholds.length -1]].sort((a, b) => a - b);
}

angular
  .module('grafana.services')
  .service('zabbixAlertingSrv', ZabbixAlertingService);
