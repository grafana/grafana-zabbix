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
import {PanelCtrl} from 'app/plugins/sdk';
import {triggerPanelEditor} from './editor';

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
  showEvents: { text: 'Problem events', value: '1' },
  triggerSeverity: defaultSeverity,
  okEventColor: '#890F02',
};

var triggerStatusMap = {
  '0': 'OK',
  '1': 'Problem'
};

var defaultTimeFormat = "DD MMM YYYY HH:mm:ss";

class TriggerPanelCtrl extends PanelCtrl {

  /** @ngInject */
  constructor($scope, $injector, $q, $element, datasourceSrv) {
    super($scope, $injector);
    this.datasourceSrv = datasourceSrv;
    this.triggerStatusMap = triggerStatusMap;
    this.defaultTimeFormat = defaultTimeFormat;

    // Load panel defaults
    _.defaults(this.panel, panelDefaults);

    this.triggerList = [];
    this.refreshData();
  }

  // Add panel editor
  initEditMode() {
    super.initEditMode();
    this.icon = "fa fa-lightbulb-o";
    this.addEditorTab('Options', triggerPanelEditor, 2);
  }

  refreshData() {
    var self = this;

    // Load datasource
    return this.datasourceSrv.get(this.panel.datasource).then(datasource => {
      var zabbix = datasource.zabbixAPI;
      var queryProcessor = datasource.queryProcessor;
      var triggerFilter = self.panel.triggers;
      var showEvents = self.panel.showEvents.value;
      var buildQuery = queryProcessor.buildTriggerQuery(triggerFilter.group.filter,
                                                        triggerFilter.host.filter,
                                                        triggerFilter.application.filter);
      return buildQuery.then(query => {
        return zabbix.getTriggers(query.groupids,
                                  query.hostids,
                                  query.applicationids,
                                  showEvents)
          .then(triggers => {
            return _.map(triggers, trigger => {
              var triggerObj = trigger;

              // Format last change and age
              trigger.lastchangeUnix = Number(trigger.lastchange);
              var timestamp = moment.unix(trigger.lastchangeUnix);
              if (self.panel.customLastChangeFormat) {
                // User defined format
                triggerObj.lastchange = timestamp.format(self.panel.lastChangeFormat);
              } else {
                triggerObj.lastchange = timestamp.format(self.defaultTimeFormat);
              }
              triggerObj.age = timestamp.fromNow(true);

              // Set color
              if (trigger.value === '1') {
                triggerObj.color = self.panel.triggerSeverity[trigger.priority].color;
              } else {
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
                      var time = new Date(+ack.clock * 1000);
                      ack.time = time.toLocaleString();
                      ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                      return ack;
                    });
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
                self.triggerList  = _.first(triggerList, self.panel.limit);

                self.renderingCompleted();
              });
          });
      });
    });
  }
}

TriggerPanelCtrl.templateUrl = 'module.html';

function filterTriggers(triggers, triggerFilter) {
  if (isRegex(triggerFilter)) {
    return _.filter(triggers, function(trigger) {
      return buildRegex(triggerFilter).test(trigger.description);
    });
  } else {
    return _.filter(triggers, function(trigger) {
      return trigger.description === triggerFilter;
    });
  }
}

function isRegex(str) {
  // Pattern for testing regex
  var regexPattern = /^\/(.*)\/([gmi]*)$/m;
  return regexPattern.test(str);
}

function buildRegex(str) {
  var regexPattern = /^\/(.*)\/([gmi]*)$/m;
  var matches = str.match(regexPattern);
  var pattern = matches[1];
  var flags = matches[2] !== "" ? matches[2] : undefined;
  return new RegExp(pattern, flags);
}

export {
  TriggerPanelCtrl,
  TriggerPanelCtrl as PanelCtrl
};
