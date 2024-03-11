import _ from 'lodash';
import TableModel from 'grafana/app/core/table_model';
import * as c from './constants';
import * as utils from './utils';
import {
  ArrayVector,
  DataFrame,
  dataFrameFromJSON,
  DataFrameJSON,
  DataQueryResponse,
  Field,
  FieldType,
  getTimeField,
  MutableDataFrame,
  MutableField,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { ZabbixMetricsQuery } from './types/query';
import { ZBXGroup, ZBXTrigger } from './types';

/**
 * Convert Zabbix API history.get response to Grafana format
 *
 * @return {Array}            Array of timeseries in Grafana format
 *                            {
 *                               target: "Metric name",
 *                               datapoints: [[<value>, <unixtime>], ...]
 *                            }
 */
function convertHistory(history, items, addHostName, convertPointCallback) {
  /**
   * Response should be in the format:
   * data: [
   *          {
   *             target: "Metric name",
   *             datapoints: [[<value>, <unixtime>], ...]
   *          }, ...
   *       ]
   */

  // Group history by itemid
  const grouped_history = _.groupBy(history, 'itemid');
  const hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid'); //uniqBy is needed to deduplicate

  return _.map(grouped_history, (hist, itemid) => {
    const item = _.find(items, { itemid: itemid }) as any;
    let alias = item.name;

    // Add scopedVars for using in alias functions
    const scopedVars: any = {
      __zbx_item: { value: item.name },
      __zbx_item_name: { value: item.name },
      __zbx_item_key: { value: item.key_ },
      __zbx_item_interval: { value: item.delay },
    };

    if (_.keys(hosts).length > 0) {
      const host = _.find(hosts, { hostid: item.hostid });
      scopedVars['__zbx_host'] = { value: host.host };
      scopedVars['__zbx_host_name'] = { value: host.name };

      // Only add host when multiple hosts selected
      if (_.keys(hosts).length > 1 && addHostName) {
        alias = host.name + ': ' + alias;
      }
    }

    return {
      target: alias,
      datapoints: _.map(hist, convertPointCallback),
      scopedVars,
      item,
    };
  });
}

function handleMacro(macros, target): MutableDataFrame {
  const frame = new MutableDataFrame({
    refId: target.refId,
    name: 'macros',
    fields: [
      { name: 'Host', type: FieldType.string },
      { name: 'Macros', type: FieldType.string },
      { name: TIME_SERIES_VALUE_FIELD_NAME, type: FieldType.string },
    ],
  });

  for (let i = 0; i < macros.length; i++) {
    const m = macros[i];
    const dataRow: any = {
      Host: m.hosts[0]!.name,
      Macros: m.macro,
      [TIME_SERIES_VALUE_FIELD_NAME]: m.value,
    };
    frame.add(dataRow);
  }
  return frame;
}

export function seriesToDataFrame(
  timeseries,
  target: ZabbixMetricsQuery,
  valueMappings?: any[],
  fieldType?: FieldType
): MutableDataFrame {
  const { datapoints, scopedVars, target: seriesName, item } = timeseries;

  const timeFiled: Field = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {
      custom: {},
    },
    values: new ArrayVector<number>(datapoints.map((p) => p[c.DATAPOINT_TS])),
  };

  let values: ArrayVector<number> | ArrayVector<string>;
  if (fieldType === FieldType.string) {
    values = new ArrayVector<string>(datapoints.map((p) => p[c.DATAPOINT_VALUE]));
  } else {
    values = new ArrayVector<number>(datapoints.map((p) => p[c.DATAPOINT_VALUE]));
  }

  const valueFiled: Field = {
    name: TIME_SERIES_VALUE_FIELD_NAME,
    type: fieldType ?? FieldType.number,
    labels: {},
    config: {
      displayNameFromDS: seriesName,
      custom: {},
    },
    values,
  };

  if (scopedVars) {
    timeFiled.config.custom = {
      itemInterval: scopedVars['__zbx_item_interval']?.value,
    };

    valueFiled.labels = {
      host: scopedVars['__zbx_host_name']?.value,
      item: scopedVars['__zbx_item']?.value,
      item_key: scopedVars['__zbx_item_key']?.value,
    };

    valueFiled.config.custom = {
      itemInterval: scopedVars['__zbx_item_interval']?.value,
    };
  }

  if (item) {
    // Try to use unit configured in Zabbix
    const unit = utils.convertZabbixUnit(item.units);
    if (unit) {
      console.log(`Datasource: unit detected: ${unit} (${item.units})`);
      valueFiled.config.unit = unit;

      if (unit === 'percent') {
        valueFiled.config.min = 0;
        valueFiled.config.max = 100;
      }
    }

    // Try to use value mapping from Zabbix
    const mappings = utils.getValueMapping(item, valueMappings);
    if (mappings && target.options?.useZabbixValueMapping) {
      console.log(`Datasource: using Zabbix value mapping`);
      valueFiled.config.mappings = mappings;
    }
  }

  const fields: Field[] = [timeFiled, valueFiled];

  const frame: DataFrame = {
    name: seriesName,
    refId: target.refId,
    fields,
    length: datapoints.length,
  };

  const mutableFrame = new MutableDataFrame(frame);
  return mutableFrame;
}

// Converts DataResponse to the format which backend works with (for data processing)
export function dataResponseToTimeSeries(response: DataFrameJSON[], items, request) {
  const series = [];
  if (response.length === 0) {
    return [];
  }

  for (const frameJSON of response) {
    const frame = dataFrameFromJSON(frameJSON);
    const { timeField, timeIndex } = getTimeField(frame);
    for (let i = 0; i < frame.fields.length; i++) {
      const field = frame.fields[i];
      if (i === timeIndex || !field.values || !field.values.length) {
        continue;
      }

      const s = [];
      for (let j = 0; j < field.values.length; j++) {
        const v = field.values.get(j);
        if (v !== null) {
          s.push({ time: timeField.values.get(j) / 1000, value: v });
        }
      }

      const itemid = field.name;
      const item = _.find(items, { itemid: itemid });

      // Convert interval to nanoseconds in order to unmarshall it on the backend to time.Duration
      let interval = request.intervalMs * 1000000;
      const itemInterval = utils.parseItemInterval(item.delay) * 1000000;
      // Provided interval is using for the data alignment, so it shouldn't be less than item update interval
      interval = Math.max(interval, itemInterval);
      if (interval === 0) {
        interval = null;
      }

      let seriesName = item.name;
      if (item.hosts?.length > 0) {
        seriesName = `${item.hosts[0].name}: ${seriesName}`;
      }

      const timeSeriesData = {
        ts: s,
        meta: {
          name: seriesName,
          item,
          interval,
        },
      };

      series.push(timeSeriesData);
    }
  }

  return series;
}

// Get units from Zabbix
export function convertZabbixUnits(response: DataQueryResponse) {
  for (let i = 0; i < response.data.length; i++) {
    const frame: DataFrame = response.data[i];
    for (const field of frame.fields) {
      const zabbixUnits = field.config.custom?.units;
      if (zabbixUnits) {
        const unit = utils.convertZabbixUnit(zabbixUnits);
        if (unit) {
          field.config.unit = unit;

          if (unit === 'percent') {
            field.config.min = 0;
            field.config.max = 100;
          }
        }
      }
    }
  }
  return response;
}

export function itServiceResponseToTimeSeries(response: any, interval) {
  const series = [];
  if (response.length === 0) {
    return [];
  }

  for (const s of response) {
    const ts = [];

    if (!s.datapoints) {
      continue;
    }

    const dp = s.datapoints;
    for (let i = 0; i < dp.length; i++) {
      ts.push({ time: dp[i][1] / 1000, value: dp[i][0] });
    }

    // Convert interval to nanoseconds in order to unmarshall it on the backend to time.Duration
    let intervalNS = utils.parseItemInterval(interval) * 1000000;
    if (intervalNS === 0) {
      intervalNS = null;
    }

    const timeSeriesData = {
      ts: ts,
      meta: {
        name: s.target,
        interval: null,
        item: {},
      },
    };

    series.push(timeSeriesData);
  }

  return series;
}

export function isConvertibleToWide(data: DataFrame[]): boolean {
  if (!data || data.length < 2) {
    return false;
  }

  const first = data[0].fields.find((f) => f.type === FieldType.time);
  if (!first) {
    return false;
  }

  for (let i = 1; i < data.length; i++) {
    const timeField = data[i].fields.find((f) => f.type === FieldType.time);

    for (let j = 0; j < Math.min(data.length, 2); j++) {
      if (timeField.values.get(j) !== first.values.get(j)) {
        return false;
      }
    }
  }

  return true;
}

export function alignFrames(data: MutableDataFrame[]): MutableDataFrame[] {
  if (!data || data.length === 0) {
    return data;
  }

  // Get oldest time stamp for all frames
  let minTimestamp = data[0].fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME).values.get(0);
  for (let i = 0; i < data.length; i++) {
    const timeField = data[i].fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
    const firstTs = timeField.values.get(0);
    if (firstTs < minTimestamp) {
      minTimestamp = firstTs;
    }
  }

  for (let i = 0; i < data.length; i++) {
    const frame = data[i];
    const timeField = frame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
    const valueField = frame.fields.find((f) => f.name === TIME_SERIES_VALUE_FIELD_NAME);
    const firstTs = timeField.values.get(0);

    if (firstTs > minTimestamp) {
      console.log('Data frames: adding missing points');
      let timestamps = timeField.values.toArray();
      let values = valueField.values.toArray();
      const missingTimestamps = [];
      const missingValues = [];
      const frameInterval: number = timeField.config.custom?.itemInterval;
      for (let j = minTimestamp; j < firstTs; j += frameInterval) {
        missingTimestamps.push(j);
        missingValues.push(null);
      }

      timestamps = missingTimestamps.concat(timestamps);
      values = missingValues.concat(values);
      timeField.values = new ArrayVector(timestamps);
      valueField.values = new ArrayVector(values);
    }
  }

  return data;
}

export function convertToWide(data: MutableDataFrame[]): DataFrame[] {
  const maxLengthIndex = getLongestFrame(data);
  const timeField = data[maxLengthIndex].fields.find((f) => f.type === FieldType.time);
  if (!timeField) {
    return [];
  }

  const fields: MutableField[] = [timeField];

  for (let i = 0; i < data.length; i++) {
    const valueField = data[i].fields.find((f) => f.name === TIME_SERIES_VALUE_FIELD_NAME);
    if (!valueField) {
      continue;
    }

    valueField.name = data[i].name;

    // Add null value to the end if series is shifted by 1 time frame
    if (timeField.values.length - valueField.values.length === 1) {
      valueField.values.add(null);
    }
    fields.push(valueField);
  }

  const frame: DataFrame = {
    name: 'wide',
    fields,
    length: timeField.values.length,
  };

  return [frame];
}

function getLongestFrame(data: MutableDataFrame[]): number {
  let maxLengthIndex = 0;
  let maxLength = 0;
  for (let i = 0; i < data.length; i++) {
    const timeField = data[i].fields.find((f) => f.type === FieldType.time);
    if (timeField.values.length > maxLength) {
      maxLength = timeField.values.length;
      maxLengthIndex = i;
    }
  }

  return maxLengthIndex;
}

function sortTimeseries(timeseries) {
  // Sort trend data, issue #202
  _.forEach(timeseries, (series) => {
    series.datapoints = _.sortBy(series.datapoints, (point) => point[c.DATAPOINT_TS]);
  });
  return timeseries;
}

function handleHistory(history, items, addHostName = true) {
  return convertHistory(history, items, addHostName, convertHistoryPoint);
}

function handleTrends(history, items, valueType, addHostName = true) {
  const convertPointCallback = _.partial(convertTrendPoint, valueType);
  return convertHistory(history, items, addHostName, convertPointCallback);
}

function handleText(history, items, target, addHostName = true) {
  const convertTextCallback = _.partial(convertText, target);
  return convertHistory(history, items, addHostName, convertTextCallback);
}

function handleHistoryAsTable(history, items, target) {
  const table: any = new TableModel();
  table.addColumn({ text: 'Host' });
  table.addColumn({ text: 'Item' });
  table.addColumn({ text: 'Key' });
  table.addColumn({ text: 'Last value' });

  const grouped_history = _.groupBy(history, 'itemid');
  _.each(items, (item) => {
    const itemHistory = grouped_history[item.itemid] || [];
    const lastPoint = _.last(itemHistory);
    let lastValue = lastPoint ? lastPoint.value : null;

    if (target.options.skipEmptyValues && (!lastValue || lastValue === '')) {
      return;
    }

    // Regex-based extractor
    if (target.textFilter) {
      lastValue = extractText(lastValue, target.textFilter, target.useCaptureGroups);
    }

    let host: any = _.first(item.hosts);
    host = host ? host.name : '';

    table.rows.push([host, item.name, item.key_, lastValue]);
  });

  return table;
}

function convertText(target, point) {
  let value = point.value;

  // Regex-based extractor
  if (target.textFilter) {
    value = extractText(point.value, target.textFilter, target.useCaptureGroups);
  }

  return [value, point.clock * 1000 + Math.round(point.ns / 1000000)];
}

function extractText(str, pattern, useCaptureGroups) {
  const extractPattern = new RegExp(pattern);
  const extractedValue = extractPattern.exec(str);
  if (extractedValue) {
    if (useCaptureGroups) {
      return extractedValue[1];
    } else {
      return extractedValue[0];
    }
  }
  return '';
}

export function handleSLIResponse(response: any, itservices: any[], target: ZabbixMetricsQuery) {
  const timestamps = [];
  for (let i = 0; i < response?.periods?.length; i++) {
    const period = response.periods[i];
    timestamps.push(period.period_from * 1000);
  }

  const timeFiled: Field = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {
      custom: {},
    },
    values: new ArrayVector<number>(timestamps),
  };

  const valueFields: Field[] = [];
  const values: number[][] = [];

  let slaProperty = mapLegacySLAProperty(target.slaProperty);
  for (let i = 0; i < response?.sli?.length; i++) {
    const slis = response.sli[i];
    for (let j = 0; j < slis.length; j++) {
      const sli = slis[j];
      const value = sli[slaProperty];
      if (!values[j]) {
        values[j] = [];
      }
      values[j].push(value);
    }
  }

  for (let i = 0; i < response?.serviceids?.length; i++) {
    const serviceId = response?.serviceids[i].toString();
    const service = itservices.find((s) => s.serviceid === serviceId);
    valueFields.push({
      name: service ? service.name : serviceId,
      type: FieldType.number,
      config: {},
      values: new ArrayVector<number>(values[i]),
    });
  }

  return new MutableDataFrame({
    refId: target.refId,
    name: 'SLI',
    fields: [timeFiled, ...valueFields],
  });
}

export function handleMultiSLIResponse(response: any[], itservices: any[], slas: any[], target: ZabbixMetricsQuery) {
  if (!response || response?.length === 0) {
    return new MutableDataFrame({
      refId: target.refId,
      name: 'SLI',
      fields: [],
    });
  }

  const firstResponse = response[0];
  const timestamps = [];
  for (let i = 0; i < firstResponse?.periods?.length; i++) {
    const period = firstResponse.periods[i];
    timestamps.push(period.period_from * 1000);
  }

  const timeFiled: Field = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {
      custom: {},
    },
    values: new ArrayVector<number>(timestamps),
  };

  const valueFields: Field[] = [];
  const slaProperty = mapLegacySLAProperty(target.slaProperty);

  for (let respIdx = 0; respIdx < response.length; respIdx++) {
    const res = response[respIdx];
    const values: number[][] = [];
    for (let i = 0; i < res?.sli?.length; i++) {
      const slis = res.sli[i];
      for (let j = 0; j < slis.length; j++) {
        const sli = slis[j];
        const value = sli[slaProperty];
        if (!values[j]) {
          values[j] = [];
        }
        values[j].push(value);
      }
    }

    for (let i = 0; i < res?.serviceids?.length; i++) {
      const serviceId = res?.serviceids[i].toString();
      const service = itservices.find((s) => s.serviceid === serviceId);
      let name = `${service?.name || serviceId}`;
      if (response.length > 1) {
        const sla = slas[respIdx];
        name = `${name}: ${sla.name}`;
      }

      valueFields.push({
        name,
        type: FieldType.number,
        config: {},
        values: new ArrayVector<number>(values[i]),
      });
    }
  }

  return new MutableDataFrame({
    refId: target.refId,
    name: 'SLI',
    fields: [timeFiled, ...valueFields],
  });
}

function mapLegacySLAProperty(property: string) {
  switch (property) {
    case 'sla':
      return 'sli';
    case 'okTime':
      return 'uptime';
    case 'downtimeTime':
      return 'downtime';
    default:
      return property;
  }
}

export function handleServiceResponse(response: any, itservices: any[], target: ZabbixMetricsQuery) {
  const valueFields: Field[] = [];
  for (let i = 0; i < response?.length; i++) {
    const service = response[i];
    const status = Number(service.status);
    valueFields.push({
      name: service ? service.name : i,
      type: FieldType.number,
      config: {},
      values: new ArrayVector<number>([status]),
    });
  }

  const timeFiled: Field = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {
      custom: {},
    },
    values: new ArrayVector<number>([Date.now()]),
  };

  return new MutableDataFrame({
    refId: target.refId,
    name: 'Service status',
    fields: [timeFiled, ...valueFields],
  });
}

export function handleSLAResponse(itservice, slaProperty, slaObject) {
  const targetSLA = slaObject[itservice.serviceid].sla;
  if (slaProperty === 'status') {
    const targetStatus = parseInt(slaObject[itservice.serviceid].status, 10);
    return {
      target: itservice.name + ' ' + slaProperty,
      datapoints: [[targetStatus, targetSLA[0].to * 1000]],
    };
  } else {
    let i;
    const slaArr = [];
    for (i = 0; i < targetSLA.length; i++) {
      if (i === 0) {
        slaArr.push([targetSLA[i][slaProperty], targetSLA[i].from * 1000]);
      }
      slaArr.push([targetSLA[i][slaProperty], targetSLA[i].to * 1000]);
    }
    return {
      target: itservice.name + ' ' + slaProperty,
      datapoints: slaArr,
    };
  }
}

function handleTriggersResponse(triggers: ZBXTrigger[], groups: ZBXGroup[], timeRange: number[], target) {
  if (!_.isArray(triggers)) {
    // Handling count mode
    let triggersCount = null;
    try {
      triggersCount = Number(triggers);
    } catch (err) {
      console.log('Error when handling triggers count: ', err);
    }

    const frame = new MutableDataFrame({
      name: `Count ${target.refId}`,
      refId: target.refId,
      fields: [
        { name: TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time, values: new ArrayVector([timeRange[1] * 1000]) },
        { name: TIME_SERIES_VALUE_FIELD_NAME, type: FieldType.number, values: new ArrayVector([triggersCount]) },
      ],
      length: 1,
    });

    return frame;
  } else {
    const stats = getTriggerStats(triggers);
    const frame = new MutableDataFrame({
      name: `Triggers ${target.refId}`,
      refId: target.refId,
      fields: [{ name: 'Host group', type: FieldType.string, values: new ArrayVector() }],
    });

    for (let i = c.TRIGGER_SEVERITY.length - 1; i >= 0; i--) {
      frame.fields.push({
        name: c.TRIGGER_SEVERITY[i].text,
        type: FieldType.number,
        config: { unit: 'none', decimals: 0 },
        values: new ArrayVector(),
      });
    }

    const groupNames = groups?.map((g) => g.name);
    groupNames?.forEach((group) => {
      frame.add({
        'Host group': group,
        Disaster: stats[group] ? stats[group][5] : 0,
        High: stats[group] ? stats[group][4] : 0,
        Average: stats[group] ? stats[group][3] : 0,
        Warning: stats[group] ? stats[group][2] : 0,
        Information: stats[group] ? stats[group][1] : 0,
        'Not classified': stats[group] ? stats[group][0] : 0,
      });
    });

    return frame;
  }
}

function getTriggerStats(triggers) {
  const groups = _.uniq(_.flattenDeep(_.map(triggers, (trigger) => _.map(trigger.groups, 'name'))));
  // let severity = _.map(c.TRIGGER_SEVERITY, 'text');
  const stats = {};
  _.each(groups, (group) => {
    stats[group] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; // severity:count
  });
  _.each(triggers, (trigger) => {
    _.each(trigger.groups, (group) => {
      stats[group.name][trigger.priority]++;
    });
  });
  return stats;
}

function convertHistoryPoint(point) {
  // Value must be a number for properly work
  return [Number(point.value), point.clock * 1000 + Math.round(point.ns / 1000000)];
}

function convertTrendPoint(valueType, point) {
  let value;
  switch (valueType) {
    case 'min':
      value = point.value_min;
      break;
    case 'max':
      value = point.value_max;
      break;
    case 'avg':
      value = point.value_avg;
      break;
    case 'sum':
      value = point.value_avg * point.num;
      break;
    case 'count':
      value = point.num;
      break;
    default:
      value = point.value_avg;
  }

  return [Number(value), point.clock * 1000];
}

export default {
  handleHistory,
  convertHistory,
  handleTrends,
  handleText,
  handleMacro,
  handleHistoryAsTable,
  handleSLAResponse,
  handleTriggersResponse,
  sortTimeseries,
  seriesToDataFrame,
  dataResponseToTimeSeries,
  itServiceResponseToTimeSeries,
  isConvertibleToWide,
  convertToWide,
  alignFrames,
  convertZabbixUnits,
};
