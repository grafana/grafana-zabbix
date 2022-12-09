import React, { FC } from 'react';
import { css } from '@emotion/css';
import { EventsWithValidation, ValidationEvents, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { isRegex, variableRegex } from '../utils';

import * as grafanaUi from '@grafana/ui';
const Input = (grafanaUi as any).LegacyForms?.Input || (grafanaUi as any).Input;

const variablePattern = RegExp(`^${variableRegex.source}`);

const getStyles = (theme: GrafanaTheme2) => ({
  inputRegex: css`
    color: ${theme.colors.warning.main};
  `,
  inputVariable: css`
    color: ${theme.colors.action.focus};
  `,
});

const zabbixInputValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: (value) => {
        if (!value) {
          return true;
        }
        if (value.length > 1 && value[0] === '/') {
          if (value[value.length - 1] !== '/') {
            return false;
          }
        }
        return true;
      },
      errorMessage: 'Not a valid regex',
    },
    {
      rule: (value) => {
        if (value === '*') {
          return false;
        }
        return true;
      },
      errorMessage: 'Wildcards not supported. Use /.*/ instead',
    },
  ],
};

export const ZabbixInput: FC<any> = ({ value, ref, validationEvents, ...restProps }) => {
  const styles = useStyles2(getStyles);

  let inputClass = styles.inputRegex;
  if (variablePattern.test(value as string)) {
    inputClass = styles.inputVariable;
  } else if (isRegex(value)) {
    inputClass = styles.inputRegex;
  }

  return <Input className={inputClass} value={value} validationEvents={zabbixInputValidationEvents} {...restProps} />;
};
