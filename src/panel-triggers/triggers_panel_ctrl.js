import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import * as utils from '../datasource-zabbix/utils';
import {PanelCtrl} from 'app/plugins/sdk';
import {triggerPanelOptionsTab} from './options_tab';
import {triggerPanelTriggersTab} from './triggers_tab';
import {migratePanelSchema, CURRENT_SCHEMA_VERSION} from './migrations';

const ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';

export const DEFAULT_TARGET = {
  group: {filter: ""},
  host: {filter: ""},
  application: {filter: ""},
  trigger: {filter: ""},
  tags: {filter: ""},
};

export const DEFAULT_SEVERITY = [
  { priority: 0, severity: 'Not classified',  color: 'rgb(108, 108, 108)', show: true},
  { priority: 1, severity: 'Information',     color: 'rgb(120, 158, 183)', show: true},
  { priority: 2, severity: 'Warning',         color: 'rgb(175, 180, 36)', show: true},
  { priority: 3, severity: 'Average',         color: 'rgb(255, 137, 30)', show: true},
  { priority: 4, severity: 'High',            color: 'rgb(255, 101, 72)', show: true},
  { priority: 5, severity: 'Disaster',        color: 'rgb(215, 0, 0)', show: true},
];

const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";

export const PANEL_DEFAULTS = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  datasources: [],
  targets: {},
  // Fields
  hostField: true,
  hostTechNameField: false,
  hostGroups: false,
  showTags: true,
  statusField: true,
  severityField: true,
  descriptionField: true,
  descriptionAtNewLine: false,
  // Options
  hostsInMaintenance: true,
  showTriggers: 'all triggers',
  sortTriggersBy: { text: 'last change', value: 'lastchange' },
  showEvents: { text: 'Problems', value: '1' },
  limit: 100,
  // View options
  fontSize: '100%',
  pageSize: 10,
  highlightBackground: false,
  highlightNewEvents: false,
  highlightNewerThan: '1h',
  customLastChangeFormat: false,
  lastChangeFormat: "",
  // Triggers severity and colors
  triggerSeverity: DEFAULT_SEVERITY,
  okEventColor: 'rgb(56, 189, 113)',
  ackEventColor: 'rgb(56, 219, 156)'
};

const triggerStatusMap = {
  '0': 'OK',
  '1': 'PROBLEM'
};

export class TriggerPanelCtrl extends PanelCtrl {

  /** @ngInject */
  constructor($scope, $injector, $timeout, datasourceSrv, templateSrv, contextSrv, dashboardSrv) {
    super($scope, $injector);
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.contextSrv = contextSrv;
    this.dashboardSrv = dashboardSrv;
    this.scope = $scope;
    this.$timeout = $timeout;

    this.editorTabIndex = 1;
    this.triggerStatusMap = triggerStatusMap;
    this.defaultTimeFormat = DEFAULT_TIME_FORMAT;
    this.pageIndex = 0;
    this.triggerList = [];
    this.currentTriggersPage = [];
    this.datasources = {};

    this.panel = migratePanelSchema(this.panel);
    _.defaultsDeep(this.panel, _.cloneDeep(PANEL_DEFAULTS));

    this.available_datasources = _.map(this.getZabbixDataSources(), 'name');
    if (this.panel.datasources.length === 0) {
      this.panel.datasources.push(this.available_datasources[0]);
    }
    if (_.isEmpty(this.panel.targets)) {
      this.panel.targets[this.panel.datasources[0]] = DEFAULT_TARGET;
    }

    this.initDatasources();
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
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

  onInitEditMode() {
    this.addEditorTab('Triggers', triggerPanelTriggersTab, 1);
    this.addEditorTab('Options', triggerPanelOptionsTab, 2);
  }

  setTimeQueryStart() {
    this.timing.queryStart = new Date().getTime();
  }

  setTimeQueryEnd() {
    this.timing.queryEnd = new Date().getTime();
  }

  onRefresh() {
    // ignore fetching data if another panel is in fullscreen
    if (this.otherPanelInFullscreenMode()) { return; }

    // clear loading/error state
    delete this.error;
    this.loading = true;
    this.setTimeQueryStart();
    this.pageIndex = 0;

    return this.getTriggers()
    .then(zabbixTriggers => {
      // Notify panel that request is finished
      this.loading = false;
      this.setTimeQueryEnd();

      this.render(zabbixTriggers);
    })
    .catch(err => {
      // if cancelled  keep loading set to true
      if (err.cancelled) {
        console.log('Panel request cancelled', err);
        return;
      }

      this.loading = false;
      this.error = err.message || "Request Error";

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
    });
  }

  render(zabbixTriggers) {
    let triggers = _.cloneDeep(zabbixTriggers || this.triggerListUnfiltered);
    this.triggerListUnfiltered = _.cloneDeep(triggers);

    triggers = _.map(triggers, this.formatTrigger.bind(this));
    triggers = this.filterTriggersPost(triggers);
    triggers = this.sortTriggers(triggers);

    // Limit triggers number
    triggers = triggers.slice(0, this.panel.limit || PANEL_DEFAULTS.limit);

    this.triggerList = triggers;
    this.getCurrentTriggersPage();

    this.$timeout(() => {
      super.render(this.triggerList);
    });
  }

  getTriggers() {
    let promises = _.map(this.panel.datasources, (ds) => {
      return this.datasourceSrv.get(ds)
      .then(datasource => {
        var zabbix = datasource.zabbix;
        var showEvents = this.panel.showEvents.value;
        var triggerFilter = this.panel.targets[ds];

        // Replace template variables
        var groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
        var hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
        var appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);

        let triggersOptions = {
          showTriggers: showEvents
        };

        return zabbix.getTriggers(groupFilter, hostFilter, appFilter, triggersOptions);
      }).then((triggers) => {
        return this.getAcknowledges(triggers, ds);
      }).then((triggers) => {
        return this.setMaintenanceStatus(triggers);
      }).then((triggers) => {
        return this.filterTriggersPre(triggers, ds);
      }).then((triggers) => {
        return this.addTriggerDataSource(triggers, ds);
      });
    });

    return Promise.all(promises)
    .then(results => _.flatten(results));
  }

  getAcknowledges(triggerList, ds) {
    // Request acknowledges for trigger
    var eventids = _.map(triggerList, trigger => {
      return trigger.lastEvent.eventid;
    });

    return this.datasources[ds].zabbix.getAcknowledges(eventids)
    .then(events => {

      // Map events to triggers
      _.each(triggerList, trigger => {
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

      return triggerList;
    });
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
        return !trigger.acknowledges;
      });
    } else if (this.panel.showTriggers === 'acknowledged') {
      triggerList = _.filter(triggerList, 'acknowledges');
    } else {
      triggerList = triggerList;
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

  addTriggerDataSource(triggers, ds) {
    _.each(triggers, (trigger) => {
      trigger.datasource = ds;
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
    let triggerObj = trigger;

    // Set host that the trigger belongs
    if (trigger.hosts && trigger.hosts.length) {
      triggerObj.host = trigger.hosts[0].name;
      triggerObj.hostTechName = trigger.hosts[0].host;
    }

    // Set tags if present
    if (trigger.tags && trigger.tags.length === 0) {
      trigger.tags = null;
    }

    // Handle multi-line description
    if (trigger.comments) {
      trigger.comments = trigger.comments.replace('\n', '<br>');
    }

    // Format last change and age
    trigger.lastchangeUnix = Number(trigger.lastchange);
    triggerObj = this.setTriggerLastChange(triggerObj);
    triggerObj = this.setTriggerSeverity(triggerObj);
    return triggerObj;
  }

  updateTriggerFormat(trigger) {
    trigger = this.setTriggerLastChange(trigger);
    trigger = this.setTriggerSeverity(trigger);
    return trigger;
  }

  setTriggerSeverity(trigger) {
    if (trigger.value === '1') {
      // Problem state
      trigger.color = this.panel.triggerSeverity[trigger.priority].color;
    } else {
      // OK state
      trigger.color = this.panel.okEventColor;
    }
    trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;

    // Mark acknowledged triggers with different color
    if (this.panel.markAckEvents && trigger.acknowledges && trigger.acknowledges.length) {
      trigger.color = this.panel.ackEventColor;
    }

    return trigger;
  }

  setTriggerLastChange(trigger) {
    if (!trigger.lastchangeUnix) {
      trigger.lastchange = "";
      trigger.age = "";
      return trigger;
    }

    let timestamp = moment.unix(trigger.lastchangeUnix);
    if (this.panel.customLastChangeFormat) {
      // User defined format
      trigger.lastchange = timestamp.format(this.panel.lastChangeFormat);
    } else {
      trigger.lastchange = timestamp.format(this.defaultTimeFormat);
    }
    trigger.age = timestamp.fromNow(true);
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

  switchComment(trigger) {
    trigger.showComment = !trigger.showComment;
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
        return datasource.zabbix.zabbixAPI.acknowledgeEvent(eventid, ack_message);
      } else {
        return Promise.reject({message: 'Trigger has no events. Nothing to acknowledge.'});
      }
    })
    .then(this.onRefresh.bind(this))
    .catch((err) => {
      this.error = err.message || "Acknowledge Error";
      this.events.emit('data-error', err);
      console.log('Panel data error:', err);
    });
  }

  getCurrentTriggersPage() {
    let pageSize = this.panel.pageSize || PANEL_DEFAULTS.pageSize;
    let startPos = this.pageIndex * pageSize;
    let endPos = Math.min(startPos + pageSize, this.triggerList.length);
    this.currentTriggersPage = this.triggerList.slice(startPos, endPos);
    return this.currentTriggersPage;
  }

  formatHostName(trigger) {
    let host = "";
    if (this.panel.hostField && this.panel.hostTechNameField) {
      host = `${trigger.host} (${trigger.hostTechName})`;
    } else if (this.panel.hostField || this.panel.hostTechNameField) {
      host = this.panel.hostField ? trigger.host : trigger.hostTechName;
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

  getAlertIconClass(trigger) {
    let iconClass = '';
    if (trigger.value === '1') {
      if (trigger.priority >= 3) {
        iconClass = 'icon-gf-critical';
      } else {
        iconClass = 'icon-gf-warning';
      }
    } else {
      iconClass = 'icon-gf-online';
    }

    if (this.panel.highlightNewEvents && this.isNewTrigger(trigger)) {
      iconClass += ' zabbix-trigger--blinked';
    }
    return iconClass;
  }

  getAlertIconClassBySeverity(triggerSeverity) {
    let iconClass = 'icon-gf-warning';
    if (triggerSeverity.priority >= 3) {
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

  getBackground(trigger) {
    const mainColor = trigger.color;
    const secondColor = this.contextSrv.user.lightTheme ? '#dde4ed' : '#262628';
    if (this.contextSrv.user.lightTheme) {
      return `linear-gradient(135deg, ${secondColor}, ${mainColor})`;
    }
    return `linear-gradient(135deg, ${mainColor}, ${secondColor})`;
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

  link(scope, elem, attrs, ctrl) {
    let panel = ctrl.panel;
    let pageCount = 0;
    let triggerList = ctrl.triggerList;

    scope.$watchGroup(['ctrl.currentTriggersPage', 'ctrl.triggerList'], renderPanel);
    elem.on('click', '.triggers-panel-page-link', switchPage);
    ctrl.events.on('render', (renderData) => {
      triggerList = renderData || triggerList;
      renderPanel();
    });

    function getContentHeight() {
      let panelHeight = ctrl.height;
      if (pageCount > 1) {
        panelHeight -= 36;
      }
      return panelHeight + 'px';
    }

    function switchPage(e) {
      let el = $(e.currentTarget);
      ctrl.pageIndex = (parseInt(el.text(), 10)-1);

      let pageSize = panel.pageSize || 10;
      let startPos = ctrl.pageIndex * pageSize;
      let endPos = Math.min(startPos + pageSize, triggerList.length);
      ctrl.currentTriggersPage = triggerList.slice(startPos, endPos);

      scope.$apply(() => {
        renderPanel();
      });
    }

    function appendPaginationControls(footerElem) {
      footerElem.empty();

      let pageSize = panel.pageSize || 5;
      pageCount = Math.ceil(triggerList.length / pageSize);
      if (pageCount === 1) {
        return;
      }

      let startPage = Math.max(ctrl.pageIndex - 3, 0);
      let endPage = Math.min(pageCount, startPage + 9);

      let paginationList = $('<ul></ul>');

      for (let i = startPage; i < endPage; i++) {
        let activeClass = i === ctrl.pageIndex ? 'active' : '';
        let pageLinkElem = $('<li><a class="triggers-panel-page-link pointer ' + activeClass + '">' + (i+1) + '</a></li>');
        paginationList.append(pageLinkElem);
      }

      footerElem.append(paginationList);
    }

    function setFontSize() {
      const fontSize = parseInt(panel.fontSize.slice(0, panel.fontSize.length - 1));
      let triggerCardElem = elem.find('.alert-rule-item');
      if (fontSize && fontSize !== 100) {
        triggerCardElem.find('.alert-rule-item__icon').css({
          'font-size': fontSize + '%',
          'margin': fontSize / 100 * 6 + 'px'
        });
        triggerCardElem.find('.alert-rule-item__name').css({'font-size': fontSize + '%'});
        triggerCardElem.find('.alert-rule-item__text').css({'font-size': fontSize * 0.8 + '%'});
        triggerCardElem.find('.zbx-trigger-lastchange').css({'font-size': fontSize * 0.8 + '%'});
        triggerCardElem.find('.zbx-tag').css({'font-size': fontSize * 0.6 + '%'});
        triggerCardElem.find('.zbx-tag').css({'line-height': fontSize / 100 * 16 + 'px'});
      } else {
        // remove css
        triggerCardElem.find('.alert-rule-item__icon').css({'font-size': '', 'margin-right': ''});
        triggerCardElem.find('.alert-rule-item__name').css({'font-size': ''});
        triggerCardElem.find('.alert-rule-item__text').css({'font-size': ''});
        triggerCardElem.find('.zbx-trigger-lastchange').css({'font-size': ''});
        triggerCardElem.find('.zbx-tag').css({'font-size': ''});
        triggerCardElem.find('.zbx-tag').css({'line-height': ''});
      }
    }

    function renderPanel() {
      let rootElem = elem.find('.triggers-panel-scroll');
      let footerElem = elem.find('.triggers-panel-footer');
      appendPaginationControls(footerElem);
      rootElem.css({'max-height': getContentHeight()});
      rootElem.css({'height': getContentHeight()});
      setFontSize();
      ctrl.renderingCompleted();
    }

    let unbindDestroy = scope.$on('$destroy', function() {
      elem.off('click', '.triggers-panel-page-link');
      unbindDestroy();
    });
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
