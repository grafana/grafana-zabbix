import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';

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
    return _.filter(this.dashboardSrv.dash.panels, panel => panel.type !== 'row');
  }

  getPanelModel(panelId) {
    let panelModels = this.getPanelModels();

    return _.find(panelModels, panel => {
      return panel.id === panelId;
    });
  }

  setThresholds(panelId, thresholds) {
    if (!thresholds || thresholds.length === 0) {
      return;
    }

    let panel = this.getPanelModel(panelId);
    if (!panel) {
      return;
    }

    thresholds.forEach(threshold => {
      setGraphThreshold(panel, threshold);
    });

    setSingleStatThresholds(panel, thresholds);
    setAlarmBoxThresholds(panel, thresholds);
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

function setGraphThreshold(panel, threshold) {
  let containsThreshold = _.find(panel.thresholds, {value: threshold});

  if (panel && panel.type === "graph" && !containsThreshold) {
    let thresholdOptions = {
      colorMode: "custom",
      fill: false,
      line: true,
      lineColor: "rgb(255, 0, 0)",
      op: "gt",
      value: threshold,
      source: "zabbix"
    };

    panel.thresholds.push(thresholdOptions);
  }
}

function setAlarmBoxThresholds(panel, thresholds) {
  if (panel.type === "btplc-alarm-box-panel") {
    let thresh = thresholds.sort((a, b) => a - b)
      .map((value, index, array) => {
        return {
          color: getColor(index, array.length),
          value: value
        };
      });
    panel.thresholds = panel.thresholds.concat(thresh);
  }
}

function setSingleStatThresholds(panel, thresholds) {
  if (panel.type === "singlestat") {
    let parsedThresholds = parseThresholds(thresholds);
    let thresholdsString = parsedThresholds.join();
    panel.thresholds = thresholdsString;
    let maxThreshold = parsedThresholds[1];
    panel.gauge.maxValue = Math.ceil(maxThreshold * 1.1);

    panel.scopedVars.thresholds = {
      text: thresholdsString,
      value: thresholdsString
    };
  }
}

function parseThresholds(thresholds) {
  if (thresholds.length === 1) {
    return [thresholds[0], thresholds[0]];
  }

  return [thresholds[0], thresholds[thresholds.length - 1]].sort((a, b) => a - b);
}

function getColor(index, thresholdsCount) {
  let scale = 255 / thresholdsCount;

  let g = Math.floor((index + 1) * scale);
  return `rgb(255, ${255 - g}, 0)`;
}

angular
  .module('grafana.services')
  .service('zabbixAlertingSrv', ZabbixAlertingService);
