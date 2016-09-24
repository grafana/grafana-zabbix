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

import _ from 'lodash';
import moment from 'moment';
import * as utils from '../datasource-zabbix/utils';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {triggerPanelEditor} from './editor';
import './ack-tooltip.directive';
import './css/panel_triggers.css!';

var defaultSeverity = [
  { priority: 0, severity: 'Not classified',  color: '#B7DBAB', show: true },
  { priority: 1, severity: 'Information',     color: '#82B5D8', show: true },
  { priority: 2, severity: 'Warning',         color: '#E5AC0E', show: true },
  { priority: 3, severity: 'Average',         color: '#C15C17', show: true },
  { priority: 4, severity: 'High',            color: '#BF1B00', show: true },
  { priority: 5, severity: 'Disaster',        color: '#890F02', show: true }
];

var panelDefaults = {
  datasource: null,
  triggers: {
    group: {filter: ""},
    host: {filter: ""},
    application: {filter: ""},
    trigger: {filter: ""}
  },
  hostField: true,
  statusField: false,
  severityField: false,
  lastChangeField: true,
  ageField: true,
  infoField: true,
  limit: 10,
  showTriggers: 'all triggers',
  sortTriggersBy: { text: 'last change', value: 'lastchange' },
  showEvents: { text: 'Problems', value: '1' },
  triggerSeverity: defaultSeverity,
  okEventColor: 'rgba(0, 245, 153, 0.45)',
  ackEventColor: 'rgba(0, 0, 0, 0)'
};

var triggerStatusMap = {
  '0': 'OK',
  '1': 'Problem'
};

var defaultTimeFormat = "DD MMM YYYY HH:mm:ss";

class TriggerPanelCtrl extends MetricsPanelCtrl {

  /** @ngInject */
  constructor($scope, $injector, $q, $element, datasourceSrv, templateSrv, contextSrv) {
    super($scope, $injector);
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.contextSrv = contextSrv;
    this.triggerStatusMap = triggerStatusMap;
    this.defaultTimeFormat = defaultTimeFormat;

    // Load panel defaults
    // _.cloneDeep() need for prevent changing shared defaultSeverity.
    // Load object "by value" istead "by reference".
    _.defaults(this.panel, _.cloneDeep(panelDefaults));

    this.triggerList = [];
    this.refreshData();
  }

  /**
   * Override onInitMetricsPanelEditMode() method from MetricsPanelCtrl.
   * We don't need metric editor from Metrics Panel.
   */
  onInitMetricsPanelEditMode() {
    this.addEditorTab('Options', triggerPanelEditor, 2);
  }

  refresh() {
    this.onMetricsPanelRefresh();
  }

  onMetricsPanelRefresh() {
    // ignore fetching data if another panel is in fullscreen
    if (this.otherPanelInFullscreenMode()) { return; }

    this.refreshData();
  }

  refreshData() {
    // clear loading/error state
    delete this.error;
    this.loading = true;
    this.setTimeQueryStart();

    var self = this;

    // Load datasource
    return this.datasourceSrv.get(this.panel.datasource).then(datasource => {
      var zabbix = datasource.zabbixAPI;
      var queryProcessor = datasource.queryProcessor;
      var showEvents = self.panel.showEvents.value;
      var triggerFilter = self.panel.triggers;

      // Replace template variables
      var groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
      var hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
      var appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);

      var buildQuery = queryProcessor.buildTriggerQuery(groupFilter, hostFilter, appFilter);
      return buildQuery.then(query => {
        return zabbix.getTriggers(query.groupids,
                                  query.hostids,
                                  query.applicationids,
                                  showEvents)
          .then(triggers => {
            return _.map(triggers, trigger => {
              let triggerObj = trigger;

              // Format last change and age
              trigger.lastchangeUnix = Number(trigger.lastchange);
              let timestamp = moment.unix(trigger.lastchangeUnix);
              if (self.panel.customLastChangeFormat) {
                // User defined format
                triggerObj.lastchange = timestamp.format(self.panel.lastChangeFormat);
              } else {
                triggerObj.lastchange = timestamp.format(self.defaultTimeFormat);
              }
              triggerObj.age = timestamp.fromNow(true);

              // Set host that the trigger belongs
              if (trigger.hosts.length) {
                triggerObj.host = trigger.hosts[0].name;
                triggerObj.hostTechName = trigger.hosts[0].host;
              }

              // Set color
              if (trigger.value === '1') {
                // Problem state
                triggerObj.color = self.panel.triggerSeverity[trigger.priority].color;
              } else {
                // OK state
                triggerObj.color = self.panel.okEventColor;
              }

              triggerObj.severity = self.panel.triggerSeverity[trigger.priority].severity;
              return triggerObj;
            });
          })
          .then(triggerList => {

            // Request acknowledges for trigger
            var eventids = _.map(triggerList, trigger => {
              return trigger.lastEvent.eventid;
            });

            return zabbix.getAcknowledges(eventids)
              .then(events => {

                // Map events to triggers
                _.each(triggerList, trigger => {
                  var event = _.find(events, event => {
                    return event.eventid === trigger.lastEvent.eventid;
                  });

                  if (event) {
                    trigger.acknowledges = _.map(event.acknowledges, ack => {
                      let timestamp = moment.unix(ack.clock);
                      if (self.panel.customLastChangeFormat) {
                        ack.time = timestamp.format(self.panel.lastChangeFormat);
                      } else {
                        ack.time = timestamp.format(self.defaultTimeFormat);
                      }
                      ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                      return ack;
                    });

                    // Mark acknowledged triggers with different color
                    if (self.panel.markAckEvents && trigger.acknowledges.length) {
                      trigger.color = self.panel.ackEventColor;
                    }
                  }
                });

                // Filter triggers by description
                var triggerFilter = self.panel.triggers.trigger.filter;
                if (triggerFilter) {
                  triggerList = filterTriggers(triggerList, triggerFilter);
                }

                // Filter acknowledged triggers
                if (self.panel.showTriggers === 'unacknowledged') {
                  triggerList = _.filter(triggerList, trigger => {
                    return !trigger.acknowledges;
                  });
                } else if (self.panel.showTriggers === 'acknowledged') {
                  triggerList = _.filter(triggerList, 'acknowledges');
                } else {
                  triggerList = triggerList;
                }

                // Filter triggers by severity
                triggerList = _.filter(triggerList, trigger => {
                  return self.panel.triggerSeverity[trigger.priority].show;
                });

                // Sort triggers
                if (self.panel.sortTriggersBy.value === 'priority') {
                  triggerList = _.sortBy(triggerList, 'priority').reverse();
                } else {
                  triggerList = _.sortBy(triggerList, 'lastchangeUnix').reverse();
                }

                // Limit triggers number
                self.triggerList  = triggerList.slice(0, self.panel.limit);

                // Notify panel that request is finished
                self.setTimeQueryEnd();
                self.loading = false;
              });
          });
      });
    });
  }

  switchComment(trigger) {
    trigger.showComment = !trigger.showComment;
  }

  acknowledgeTrigger(trigger, message) {
    let self = this;
    let eventid = trigger.lastEvent.eventid;
    let grafana_user = this.contextSrv.user.name;
    let ack_message = grafana_user + ' (Grafana): ' + message;
    return this.datasourceSrv.get(this.panel.datasource).then(datasource => {
      let zabbix = datasource.zabbixAPI;
      return zabbix.acknowledgeEvent(eventid, ack_message).then(() => {
        self.refresh();
      });
    });
  }
}

TriggerPanelCtrl.templateUrl = 'panel-triggers/module.html';

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

export {
  TriggerPanelCtrl,
  TriggerPanelCtrl as PanelCtrl
};
