import _ from 'lodash';
import * as utils from './utils';
import { getTemplateSrv } from '@grafana/runtime';
import { DataFrame, FieldType, TIME_SERIES_VALUE_FIELD_NAME } from '@grafana/data';

function setAlias(alias: string, frame: DataFrame) {
  if (frame.fields?.length <= 2) {
    const valueField = frame.fields.find(f => f.name === TIME_SERIES_VALUE_FIELD_NAME);
    if (valueField?.config?.custom?.scopedVars) {
      alias = getTemplateSrv().replace(alias, valueField?.config?.custom?.scopedVars);
    }
    if (valueField) {
      valueField.config.displayNameFromDS = alias;
    }
    frame.name = alias;
    return frame;
  }

  for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
    const field = frame.fields[fieldIndex];
    if (field.type !== FieldType.time) {
      if (field?.config?.custom?.scopedVars) {
        alias = getTemplateSrv().replace(alias, field?.config?.custom?.scopedVars);
      }
      field.config.displayNameFromDS = alias;
    }
  }
  return frame;
}

function replaceAlias(regexp: string, newAlias: string, frame: DataFrame) {
  let pattern: string | RegExp;
  if (utils.isRegex(regexp)) {
    pattern = utils.buildRegex(regexp);
  } else {
    pattern = regexp;
  }

  if (frame.fields?.length <= 2) {
    let alias = frame.name.replace(pattern, newAlias);
    const valueField = frame.fields.find(f => f.name === TIME_SERIES_VALUE_FIELD_NAME);
    if (valueField?.state?.scopedVars) {
      alias = getTemplateSrv().replace(alias, valueField?.state?.scopedVars);
    }
    if (valueField) {
      valueField.config.displayNameFromDS = alias;
    }
    frame.name = alias;
    return frame;
  }

  for (const field of frame.fields) {
    if (field.type !== FieldType.time) {
      let alias = field.config?.displayNameFromDS?.replace(pattern, newAlias);
      if (field?.state?.scopedVars && alias) {
        alias = getTemplateSrv().replace(alias, field?.state?.scopedVars);
      }
      field.name = alias || field.name;
    }
  }
  return frame;
}

function setAliasByRegex(alias: string, frame: DataFrame) {
  if (frame.fields?.length <= 2) {
    const valueField = frame.fields.find(f => f.name === TIME_SERIES_VALUE_FIELD_NAME);
    try {
      if (valueField) {
        valueField.config.displayNameFromDS = extractText(valueField.config?.displayNameFromDS, alias);
      }
      frame.name = extractText(frame.name, alias);
    } catch (error) {
      console.error('Failed to apply RegExp:', error?.message || error);
    }
    return frame;
  }

  for (const field of frame.fields) {
    if (field.type !== FieldType.time) {
      try {
        field.config.displayNameFromDS = extractText(field.config?.displayNameFromDS, alias);
      } catch (error) {
        console.error('Failed to apply RegExp:', error?.message || error);
      }
    }
  }

  return frame;
}

function extractText(str: string, pattern: string) {
  const extractPattern = new RegExp(pattern);
  const extractedValue = extractPattern.exec(str);
  return extractedValue[0];
}

function timeShift(interval, range) {
  const shift = utils.parseTimeShiftInterval(interval) / 1000;
  return _.map(range, time => {
    return time - shift;
  });
}

const metricFunctions = {
  timeShift: timeShift,
  setAlias: setAlias,
  setAliasByRegex: setAliasByRegex,
  replaceAlias: replaceAlias
};

export default {
  get metricFunctions() {
    return metricFunctions;
  }
};
