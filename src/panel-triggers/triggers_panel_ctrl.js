import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';
import { PanelEvents } from '@grafana/data';
import * as dateMath from 'grafana/app/core/utils/datemath';
import * as utils from '../datasource-zabbix/utils';
import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import { triggerPanelOptionsTab } from './options_tab';
import { migratePanelSchema, CURRENT_SCHEMA_VERSION } from './migrations';
import ProblemList from './components/Problems/Problems';
import AlertList from './components/AlertList/AlertList';

const PROBLEM_EVENTS_LIMIT = 100;

export const DEFAULT_TARGET = {
  group: {filter: ""},
  host: {filter: ""},
  application: {filter: ""},
  trigger: {filter: ""},
  tags: {filter: ""},
  proxy: {filter: ""},
};

export const DEFAULT_SEVERITY = [
  { priority: 0, severity: 'Not classified',  color: 'rgb(108, 108, 108)', show: true},
  { priority: 1, severity: 'Information',     color: 'rgb(120, 158, 183)', show: true},
  { priority: 2, severity: 'Warning',         color: 'rgb(175, 180, 36)', show: true},
  { priority: 3, severity: 'Average',         color: 'rgb(255, 137, 30)', show: true},
  { priority: 4, severity: 'High',            color: 'rgb(255, 101, 72)', show: true},
  { priority: 5, severity: 'Disaster',        color: 'rgb(215, 0, 0)', show: true},
];

export const getDefaultSeverity = () => DEFAULT_SEVERITY;

const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";

export const PANEL_DEFAULTS = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  // Fields
  hostField: true,
  hostTechNameField: false,
  hostGroups: false,
  hostProxy: false,
  showTags: true,
  statusField: true,
  statusIcon: false,
  severityField: true,
  ageField: false,
  descriptionField: true,
  descriptionAtNewLine: false,
  // Options
  hostsInMaintenance: true,
  showTriggers: 'all triggers',
  sortTriggersBy: { text: 'last change', value: 'lastchange' },
  showEvents: { text: 'Problems', value: 1 },
  limit: 100,
  // View options
  layout: 'table',
  fontSize: '100%',
  pageSize: 10,
  problemTimeline: true,
  highlightBackground: false,
  highlightNewEvents: false,
  highlightNewerThan: '1h',
  customLastChangeFormat: false,
  lastChangeFormat: "",
  resizedColumns: [],
  // Triggers severity and colors
  triggerSeverity: getDefaultSeverity(),
  okEventColor: 'rgb(56, 189, 113)',
  ackEventColor: 'rgb(56, 219, 156)',
  markAckEvents: false,
};

const triggerStatusMap = {
  '0': 'OK',
  '1': 'PROBLEM'
};

export class TriggerPanelCtrl extends MetricsPanelCtrl {

  /** @ngInject */
  constructor($scope, $injector, $timeout, templateSrv, contextSrv, dashboardSrv, timeSrv) {
    super($scope, $injector);
    this.templateSrv = templateSrv;
    this.contextSrv = contextSrv;
    this.dashboardSrv = dashboardSrv;
    this.timeSrv = timeSrv;
    this.scope = $scope;
    this.$timeout = $timeout;

    // Tell Grafana do not convert data frames to table or series
    this.useDataFrames = true;

    this.editorTabIndex = 1;
    this.triggerStatusMap = triggerStatusMap;
    this.defaultTimeFormat = DEFAULT_TIME_FORMAT;
    this.pageIndex = 0;
    this.range = {};
    this.renderData = [];

    this.panel = migratePanelSchema(this.panel);
    _.defaultsDeep(this.panel, _.cloneDeep(PANEL_DEFAULTS));

    this.events.on(PanelEvents.render, this.onRender.bind(this));
    this.events.on('data-frames-received', this.onDataFramesReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onDataSnapshotLoad.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    // Update schema version to prevent migration on up-to-date targets
    this.panel.schemaVersion = CURRENT_SCHEMA_VERSION;
    this.addEditorTab('Options', triggerPanelOptionsTab);
  }

  onDataFramesReceived(data) {
    let problems = [];

    if (data && data.length) {
      for (const dataFrame of data) {
        try {
          const values = dataFrame.fields[0].values;
          if (values.toArray) {
            problems.push(values.toArray());
          } else if (values.length > 0) {
            // On snapshot mode values is a plain Array, not ArrayVector
            problems.push(values);
          }
        } catch (error) {
          console.log(error);
        }
      }
    }

    this.loading = false;
    problems = _.flatten(problems);
    this.renderProblems(problems);
  }

  onDataSnapshotLoad(snapshotData) {
    this.onDataFramesReceived(snapshotData);
  }

  onRender() {
    this.range = this.timeSrv.timeRange();
  }

  setPanelError(err, defaultError) {
    const defaultErrorMessage = defaultError || "Request Error";
    this.inspector = { error: err };
    this.error = err.message || defaultErrorMessage;
    if (err.data) {
      if (err.data.message) {
        this.error = err.data.message;
      }
      if (err.data.error) {
        this.error = err.data.error;
      }
    }

    // this.events.emit(PanelEvents.dataError, err);
    console.log('Panel data error:', err);
  }

  renderProblems(problems) {
    let triggers = _.cloneDeep(problems);

    triggers = _.map(triggers, this.formatTrigger.bind(this));
    triggers = this.filterTriggersPost(triggers);
    triggers = this.sortTriggers(triggers);

    // Limit triggers number
    triggers = triggers.slice(0, this.panel.limit || PANEL_DEFAULTS.limit);

    this.renderData = triggers;

    return this.$timeout(() => {
      return super.render(triggers);
    });
  }

  filterTriggersPost(triggers) {
    let triggerList = _.cloneDeep(triggers);

    // Filter acknowledged triggers
    if (this.panel.showTriggers === 'unacknowledged') {
      triggerList = _.filter(triggerList, trigger => {
        return !(trigger.acknowledges && trigger.acknowledges.length);
      });
    } else if (this.panel.showTriggers === 'acknowledged') {
      triggerList = _.filter(triggerList, trigger => {
        return trigger.acknowledges && trigger.acknowledges.length;
      });
    }

    // Filter by maintenance status
    if (!this.panel.hostsInMaintenance) {
      triggerList = _.filter(triggerList, (trigger) => trigger.maintenance === false);
    }

    // Filter triggers by severity
    triggerList = _.filter(triggerList, trigger => {
      if (trigger.lastEvent && trigger.lastEvent.severity) {
        return this.panel.triggerSeverity[trigger.lastEvent.severity].show;
      } else {
        return this.panel.triggerSeverity[trigger.priority].show;
      }
    });

    return triggerList;
  }

  sortTriggers(triggerList) {
    if (this.panel.sortTriggersBy.value === 'priority') {
      triggerList = _.orderBy(triggerList, ['priority', 'lastchangeUnix', 'triggerid'], ['desc', 'desc', 'desc']);
    } else {
      triggerList = _.orderBy(triggerList, ['lastchangeUnix', 'priority', 'triggerid'], ['desc', 'desc', 'desc']);
    }
    return triggerList;
  }

  formatTrigger(zabbixTrigger) {
    let trigger = _.cloneDeep(zabbixTrigger);

    // Set host and proxy that the trigger belongs
    if (trigger.hosts && trigger.hosts.length) {
      const host = trigger.hosts[0];
      trigger.host = host.name;
      trigger.hostTechName = host.host;
      if (host.proxy) {
        trigger.proxy = host.proxy;
      }
    }

    // Set tags if present
    if (trigger.tags && trigger.tags.length === 0) {
      trigger.tags = null;
    }

    // Handle multi-line description
    if (trigger.comments) {
      trigger.comments = trigger.comments.replace('\n', '<br>');
    }

    trigger.lastchangeUnix = Number(trigger.lastchange);
    return trigger;
  }

  parseTags(tagStr) {
    if (!tagStr) {
      return [];
    }

    let tags = _.map(tagStr.split(','), (tag) => tag.trim());
    tags = _.map(tags, (tag) => {
      const tagParts = tag.split(':');
      return {tag: tagParts[0].trim(), value: tagParts[1].trim()};
    });
    return tags;
  }

  tagsToString(tags) {
    return _.map(tags, (tag) => `${tag.tag}:${tag.value}`).join(', ');
  }

  addTagFilter(tag, datasource) {
    for (const target of this.panel.targets) {
      if (target.datasource === datasource || this.panel.datasource === datasource) {
        let tagFilter = target.tags.filter;
        let targetTags = this.parseTags(tagFilter);
        let newTag = {tag: tag.tag, value: tag.value};
        targetTags.push(newTag);
        targetTags = _.uniqWith(targetTags, _.isEqual);
        let newFilter = this.tagsToString(targetTags);
        target.tags.filter = newFilter;
      }
    }
    this.refresh();
  }

  removeTagFilter(tag, datasource) {
    const matchTag = t => t.tag === tag.tag && t.value === tag.value;
    for (const target of this.panel.targets) {
      if (target.datasource === datasource || this.panel.datasource === datasource) {
        let tagFilter = target.tags.filter;
        let targetTags = this.parseTags(tagFilter);
        _.remove(targetTags, matchTag);
        targetTags = _.uniqWith(targetTags, _.isEqual);
        let newFilter = this.tagsToString(targetTags);
        target.tags.filter = newFilter;
      }
    }
    this.refresh();
  }

  getProblemEvents(problem) {
    const triggerids = [problem.triggerid];
    const timeFrom = Math.ceil(dateMath.parse(this.range.from) / 1000);
    const timeTo = Math.ceil(dateMath.parse(this.range.to) / 1000);
    return getDataSourceSrv().get(problem.datasource)
    .then(datasource => {
      return datasource.zabbix.getEvents(triggerids, timeFrom, timeTo, [0, 1], PROBLEM_EVENTS_LIMIT);
    });
  }

  getProblemAlerts(problem) {
    if (!problem.lastEvent || problem.lastEvent.length === 0) {
      return Promise.resolve([]);
    }
    const eventids = [problem.lastEvent.eventid];
    return getDataSourceSrv().get(problem.datasource)
    .then(datasource => {
      return datasource.zabbix.getEventAlerts(eventids);
    });
  }

  formatHostName(trigger) {
    let host = "";
    if (this.panel.hostField && this.panel.hostTechNameField) {
      host = `${trigger.host} (${trigger.hostTechName})`;
    } else if (this.panel.hostField || this.panel.hostTechNameField) {
      host = this.panel.hostField ? trigger.host : trigger.hostTechName;
    }
    if (this.panel.hostProxy && trigger.proxy) {
      host = `${trigger.proxy}: ${host}`;
    }

    return host;
  }

  formatHostGroups(trigger) {
    let groupNames = "";
    if (this.panel.hostGroups) {
      let groups = _.map(trigger.groups, 'name').join(', ');
      groupNames += `[ ${groups} ]`;
    }

    return groupNames;
  }

  isNewTrigger(trigger) {
    try {
      const highlightIntervalMs = utils.parseInterval(this.panel.highlightNewerThan || PANEL_DEFAULTS.highlightNewerThan);
      const durationSec = (Date.now() - trigger.lastchangeUnix * 1000);
      return durationSec < highlightIntervalMs;
    } catch (e) {
      return false;
    }
  }

  getAlertIconClass(trigger) {
    let iconClass = '';
    if (trigger.value === '1' && trigger.priority >= 2) {
      iconClass = 'icon-gf-critical';
    } else {
      iconClass = 'icon-gf-online';
    }

    if (this.panel.highlightNewEvents && this.isNewTrigger(trigger)) {
      iconClass += ' zabbix-trigger--blinked';
    }
    return iconClass;
  }

  getAlertIconClassBySeverity(triggerSeverity) {
    let iconClass = 'icon-gf-online';
    if (triggerSeverity.priority >= 2) {
      iconClass = 'icon-gf-critical';
    }
    return iconClass;
  }

  getAlertStateClass(trigger) {
    let statusClass = '';

    if (trigger.value === '1') {
      statusClass = 'alert-state-critical';
    } else {
      statusClass = 'alert-state-ok';
    }

    if (this.panel.highlightNewEvents && this.isNewTrigger(trigger)) {
      statusClass += ' zabbix-trigger--blinked';
    }

    return statusClass;
  }

  resetResizedColumns() {
    this.panel.resizedColumns = [];
    this.render();
  }

  acknowledgeTrigger(trigger, message) {
    let eventid = trigger.lastEvent ? trigger.lastEvent.eventid : null;
    let grafana_user = this.contextSrv.user.name;
    let ack_message = grafana_user + ' (Grafana): ' + message;
    return getDataSourceSrv().get(trigger.datasource)
    .then(datasource => {
      const userIsEditor = this.contextSrv.isEditor || this.contextSrv.isGrafanaAdmin;
      if (datasource.disableReadOnlyUsersAck && !userIsEditor) {
        return Promise.reject({message: 'You have no permissions to acknowledge events.'});
      }
      if (eventid) {
        return datasource.zabbix.acknowledgeEvent(eventid, ack_message);
      } else {
        return Promise.reject({message: 'Trigger has no events. Nothing to acknowledge.'});
      }
    })
    .then(this.onMetricsPanelRefresh.bind(this))
    .catch((err) => {
      this.setPanelError(err);
    });
  }

  handlePageSizeChange(pageSize, pageIndex) {
    this.panel.pageSize = pageSize;
    this.pageIndex = pageIndex;
    this.scope.$apply(() => {
      this.render();
    });
  }

  handleColumnResize(newResized) {
    this.panel.resizedColumns = newResized;
    this.scope.$apply(() => {
      this.render();
    });
  }

  link(scope, elem, attrs, ctrl) {
    let panel = ctrl.panel;
    // let problems = ctrl.problems;

    // scope.$watchGroup(['ctrl.renderData'], renderPanel);
    ctrl.events.on(PanelEvents.render, (renderData) => {
      renderData = renderData || this.renderData;
      renderPanel(renderData);
    });

    function renderPanel(problems) {
      const timeFrom = Math.ceil(dateMath.parse(ctrl.range.from) / 1000);
      const timeTo = Math.ceil(dateMath.parse(ctrl.range.to) / 1000);

      const fontSize = parseInt(panel.fontSize.slice(0, panel.fontSize.length - 1));
      const fontSizeProp = fontSize && fontSize !== 100 ? fontSize : null;

      const pageSize = panel.pageSize || 10;
      const loading = ctrl.loading && (!problems || !problems.length);

      let panelOptions = {};
      for (let prop in PANEL_DEFAULTS) {
        panelOptions[prop] = ctrl.panel[prop];
      }
      const problemsListProps = {
        problems,
        panelOptions,
        timeRange: { timeFrom, timeTo },
        loading,
        pageSize,
        fontSize: fontSizeProp,
        getProblemEvents: ctrl.getProblemEvents.bind(ctrl),
        getProblemAlerts: ctrl.getProblemAlerts.bind(ctrl),
        onPageSizeChange: ctrl.handlePageSizeChange.bind(ctrl),
        onColumnResize: ctrl.handleColumnResize.bind(ctrl),
        onProblemAck: (trigger, data) => {
          const message = data.message;
          return ctrl.acknowledgeTrigger(trigger, message);
        },
        onTagClick: (tag, datasource, ctrlKey, shiftKey) => {
          if (ctrlKey || shiftKey) {
            ctrl.removeTagFilter(tag, datasource);
          } else {
            ctrl.addTagFilter(tag, datasource);
          }
        }
      };

      let problemsReactElem;
      if (panel.layout === 'list') {
        problemsReactElem = React.createElement(AlertList, problemsListProps);
      } else {
        problemsReactElem = React.createElement(ProblemList, problemsListProps);
      }

      const panelContainerElem = elem.find('.panel-content');
      if (panelContainerElem && panelContainerElem.length) {
        ReactDOM.render(problemsReactElem, panelContainerElem[0]);
      } else {
        ReactDOM.render(problemsReactElem, elem[0]);
      }
    }
  }
}

TriggerPanelCtrl.templateUrl = 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/module.html';
