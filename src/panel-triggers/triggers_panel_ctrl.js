import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';
import moment from 'moment';
import * as dateMath from 'grafana/app/core/utils/datemath';
import * as utils from '../datasource-zabbix/utils';
import { PanelCtrl } from 'grafana/app/plugins/sdk';
import { triggerPanelOptionsTab } from './options_tab';
import { triggerPanelTriggersTab } from './triggers_tab';
import { migratePanelSchema, CURRENT_SCHEMA_VERSION } from './migrations';
import ProblemList from './components/Problems/Problems';
import AlertList from './components/AlertList/AlertList';

const ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';
const PROBLEM_EVENTS_LIMIT = 100;

export const DEFAULT_TARGET = {
  group: {filter: ""},
  host: {filter: ""},
  application: {filter: ""},
  trigger: {filter: ""},
  tags: {filter: ""},
  proxy: {filter: ""},
};

export const getDefaultTarget = () => DEFAULT_TARGET;

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
  datasources: [],
  targets: {},
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

export class TriggerPanelCtrl extends PanelCtrl {

  /** @ngInject */
  constructor($scope, $injector, $timeout, datasourceSrv, templateSrv, contextSrv, dashboardSrv, timeSrv) {
    super($scope, $injector);
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.contextSrv = contextSrv;
    this.dashboardSrv = dashboardSrv;
    this.timeSrv = timeSrv;
    this.scope = $scope;
    this.$timeout = $timeout;

    this.editorTabIndex = 1;
    this.triggerStatusMap = triggerStatusMap;
    this.defaultTimeFormat = DEFAULT_TIME_FORMAT;
    this.pageIndex = 0;
    this.triggerList = [];
    this.datasources = {};
    this.range = {};

    this.panel = migratePanelSchema(this.panel);
    _.defaultsDeep(this.panel, _.cloneDeep(PANEL_DEFAULTS));

    this.available_datasources = _.map(this.getZabbixDataSources(), 'name');
    if (this.panel.datasources.length === 0) {
      this.panel.datasources.push(this.available_datasources[0]);
    }
    if (this.isEmptyTargets()) {
      this.panel.targets[this.panel.datasources[0]] = getDefaultTarget();
    }

    this.initDatasources();
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
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

    this.events.emit('data-error', err);
    console.log('Panel data error:', err);
  }

  initDatasources() {
    let promises = _.map(this.panel.datasources, (ds) => {
      // Load datasource
      return this.datasourceSrv.get(ds)
      .then(datasource => {
        this.datasources[ds] = datasource;
        return datasource;
      });
    });
    return Promise.all(promises);
  }

  getZabbixDataSources() {
    return _.filter(this.datasourceSrv.getMetricSources(), datasource => {
      return datasource.meta.id === ZABBIX_DS_ID && datasource.value;
    });
  }

  isEmptyTargets() {
    const emptyTargets = _.isEmpty(this.panel.targets);
    const emptyTarget = (this.panel.targets.length === 1 && (
      _.isEmpty(this.panel.targets[0]) ||
      this.panel.targets[0].target === ""
    ));
    return emptyTargets || emptyTarget;
  }

  onInitEditMode() {
    this.addEditorTab('Triggers', triggerPanelTriggersTab, 1);
    this.addEditorTab('Options', triggerPanelOptionsTab, 2);
  }

  setTimeQueryStart() {
    this.timing.queryStart = new Date().getTime();
  }

  setTimeQueryEnd() {
    this.timing.queryEnd = (new Date()).getTime();
  }

  onRefresh() {
    // ignore fetching data if another panel is in fullscreen
    if (this.otherPanelInFullscreenMode()) { return; }

    this.range = this.timeSrv.timeRange();

    // clear loading/error state
    delete this.error;
    this.loading = true;
    this.setTimeQueryStart();
    this.pageIndex = 0;

    return this.getTriggers()
    .then(triggers => {
      // Notify panel that request is finished
      this.loading = false;
      this.setTimeQueryEnd();
      return this.renderTriggers(triggers);
    })
    .then(() => {
      this.$timeout(() => {
        this.renderingCompleted();
      });
    })
    .catch(err => {
      this.loading = false;

      if (err.cancelled) {
        console.log('Panel request cancelled', err);
        return;
      }

      this.setPanelError(err);
    });
  }

  renderTriggers(zabbixTriggers) {
    let triggers = _.cloneDeep(zabbixTriggers || this.triggerListUnfiltered);
    this.triggerListUnfiltered = _.cloneDeep(triggers);

    triggers = _.map(triggers, this.formatTrigger.bind(this));
    triggers = this.filterTriggersPost(triggers);
    triggers = this.sortTriggers(triggers);

    // Limit triggers number
    triggers = triggers.slice(0, this.panel.limit || PANEL_DEFAULTS.limit);

    this.triggerList = triggers;

    return this.$timeout(() => {
      return super.render(this.triggerList);
    });
  }

  getTriggers() {
    const timeFrom = Math.ceil(dateMath.parse(this.range.from) / 1000);
    const timeTo = Math.ceil(dateMath.parse(this.range.to) / 1000);
    const userIsEditor = this.contextSrv.isEditor || this.contextSrv.isGrafanaAdmin;

    let promises = _.map(this.panel.datasources, (ds) => {
      let proxies;
      let showAckButton = true;
      return this.datasourceSrv.get(ds)
      .then(datasource => {
        const zabbix = datasource.zabbix;
        const showEvents = this.panel.showEvents.value;
        const triggerFilter = this.panel.targets[ds];
        const showProxy = this.panel.hostProxy;
        const getProxiesPromise = showProxy ? zabbix.getProxies() : () => [];
        showAckButton = !datasource.disableReadOnlyUsersAck || userIsEditor;

        // Replace template variables
        const groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
        const hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
        const appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);
        const proxyFilter = datasource.replaceTemplateVars(triggerFilter.proxy.filter);

        let triggersOptions = {
          showTriggers: showEvents
        };

        if (showEvents !== 1) {
          triggersOptions.timeFrom = timeFrom;
          triggersOptions.timeTo = timeTo;
        }

        return Promise.all([
          zabbix.getTriggers(groupFilter, hostFilter, appFilter, triggersOptions, proxyFilter),
          getProxiesPromise
        ]);
      }).then(([triggers, sourceProxies]) => {
        proxies = _.keyBy(sourceProxies, 'proxyid');
        const eventids = _.compact(triggers.map(trigger => {
          return trigger.lastEvent.eventid;
        }));
        return Promise.all([
          this.datasources[ds].zabbix.getExtendedEventData(eventids),
          Promise.resolve(triggers)
        ]);
      })
      .then(([events, triggers]) => {
        this.addEventTags(events, triggers);
        this.addAcknowledges(events, triggers);
        return triggers;
      })
      .then(triggers => this.setMaintenanceStatus(triggers))
      .then(triggers => this.setAckButtonStatus(triggers, showAckButton))
      .then(triggers => this.filterTriggersPre(triggers, ds))
      .then(triggers => this.addTriggerDataSource(triggers, ds))
      .then(triggers => this.addTriggerHostProxy(triggers, proxies));
    });

    return Promise.all(promises)
    .then(results => _.flatten(results));
  }

  addAcknowledges(events, triggers) {
    // Map events to triggers
    _.each(triggers, trigger => {
      var event = _.find(events, event => {
        return event.eventid === trigger.lastEvent.eventid;
      });

      if (event) {
        trigger.acknowledges = _.map(event.acknowledges, this.formatAcknowledge.bind(this));
      }

      if (!trigger.lastEvent.eventid) {
        trigger.lastEvent = null;
      }
    });

    return triggers;
  }

  formatAcknowledge(ack) {
    let timestamp = moment.unix(ack.clock);
    if (this.panel.customLastChangeFormat) {
      ack.time = timestamp.format(this.panel.lastChangeFormat);
    } else {
      ack.time = timestamp.format(this.defaultTimeFormat);
    }
    ack.user = ack.alias || '';
    if (ack.name || ack.surname) {
      const fullName = `${ack.name || ''} ${ack.surname || ''}`;
      ack.user += ` (${fullName})`;
    }
    return ack;
  }

  addEventTags(events, triggers) {
    _.each(triggers, trigger => {
      var event = _.find(events, event => {
        return event.eventid === trigger.lastEvent.eventid;
      });
      if (event && event.tags && event.tags.length) {
        trigger.tags = event.tags;
      }
    });
    return triggers;
  }

  filterTriggersPre(triggerList, ds) {
    // Filter triggers by description
    let triggerFilter = this.panel.targets[ds].trigger.filter;
    triggerFilter = this.datasources[ds].replaceTemplateVars(triggerFilter);
    if (triggerFilter) {
      triggerList = filterTriggers(triggerList, triggerFilter);
    }

    // Filter by tags
    const target = this.panel.targets[ds];
    if (target.tags.filter) {
      let tagsFilter = this.datasources[ds].replaceTemplateVars(target.tags.filter);
      // replaceTemplateVars() builds regex-like string, so we should trim it.
      tagsFilter = tagsFilter.replace('/^', '').replace('$/', '');
      const tags = this.parseTags(tagsFilter);
      triggerList = _.filter(triggerList, trigger => {
        return _.every(tags, (tag) => {
          return _.find(trigger.tags, {tag: tag.tag, value: tag.value});
        });
      });
    }

    return triggerList;
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
      return this.panel.triggerSeverity[trigger.priority].show;
    });

    return triggerList;
  }

  setMaintenanceStatus(triggers) {
    _.each(triggers, (trigger) => {
      let maintenance_status = _.some(trigger.hosts, (host) => host.maintenance_status === '1');
      trigger.maintenance = maintenance_status;
    });
    return triggers;
  }

  setAckButtonStatus(triggers, showAckButton) {
    _.each(triggers, (trigger) => {
      trigger.showAckButton = showAckButton;
    });
    return triggers;
  }

  addTriggerDataSource(triggers, ds) {
    _.each(triggers, (trigger) => {
      trigger.datasource = ds;
    });
    return triggers;
  }

  addTriggerHostProxy(triggers, proxies) {
    triggers.forEach(trigger => {
      if (trigger.hosts && trigger.hosts.length) {
        let host = trigger.hosts[0];
        if (host.proxy_hostid !== '0') {
          const hostProxy = proxies[host.proxy_hostid];
          host.proxy = hostProxy ? hostProxy.host : '';
        }
      }
    });
    return triggers;
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

  addTagFilter(tag, ds) {
    let tagFilter = this.panel.targets[ds].tags.filter;
    let targetTags = this.parseTags(tagFilter);
    let newTag = {tag: tag.tag, value: tag.value};
    targetTags.push(newTag);
    targetTags = _.uniqWith(targetTags, _.isEqual);
    let newFilter = this.tagsToString(targetTags);
    this.panel.targets[ds].tags.filter = newFilter;
    this.refresh();
  }

  removeTagFilter(tag, ds) {
    let tagFilter = this.panel.targets[ds].tags.filter;
    let targetTags = this.parseTags(tagFilter);
    _.remove(targetTags, t => t.tag === tag.tag && t.value === tag.value);
    targetTags = _.uniqWith(targetTags, _.isEqual);
    let newFilter = this.tagsToString(targetTags);
    this.panel.targets[ds].tags.filter = newFilter;
    this.refresh();
  }

  getProblemEvents(problem) {
    const triggerids = [problem.triggerid];
    const timeFrom = Math.ceil(dateMath.parse(this.range.from) / 1000);
    const timeTo = Math.ceil(dateMath.parse(this.range.to) / 1000);
    return this.datasourceSrv.get(problem.datasource)
    .then(datasource => {
      return datasource.zabbix.getEvents(triggerids, timeFrom, timeTo, [0, 1], PROBLEM_EVENTS_LIMIT);
    });
  }

  getProblemAlerts(problem) {
    if (!problem.lastEvent || problem.lastEvent.length === 0) {
      return Promise.resolve([]);
    }
    const eventids = [problem.lastEvent.eventid];
    return this.datasourceSrv.get(problem.datasource)
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
    return this.datasourceSrv.get(trigger.datasource)
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
    .then(this.onRefresh.bind(this))
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
    let triggerList = ctrl.triggerList;

    scope.$watchGroup(['ctrl.triggerList'], renderPanel);
    ctrl.events.on('render', (renderData) => {
      triggerList = renderData || triggerList;
      renderPanel();
    });

    function renderPanel() {
      const timeFrom = Math.ceil(dateMath.parse(ctrl.range.from) / 1000);
      const timeTo = Math.ceil(dateMath.parse(ctrl.range.to) / 1000);

      const fontSize = parseInt(panel.fontSize.slice(0, panel.fontSize.length - 1));
      const fontSizeProp = fontSize && fontSize !== 100 ? fontSize : null;

      const pageSize = panel.pageSize || 10;
      const loading = ctrl.loading && (!ctrl.triggerList || !ctrl.triggerList.length);

      let panelOptions = {};
      for (let prop in PANEL_DEFAULTS) {
        panelOptions[prop] = ctrl.panel[prop];
      }
      const problemsListProps = {
        problems: ctrl.triggerList,
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
      ReactDOM.render(problemsReactElem, elem.find('.panel-content')[0]);
    }
  }
}

TriggerPanelCtrl.templateUrl = 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/module.html';

function filterTriggers(triggers, triggerFilter) {
  if (utils.isRegex(triggerFilter)) {
    return _.filter(triggers, function(trigger) {
      return utils.buildRegex(triggerFilter).test(trigger.description);
    });
  } else {
    return _.filter(triggers, function(trigger) {
      return trigger.description === triggerFilter;
    });
  }
}
