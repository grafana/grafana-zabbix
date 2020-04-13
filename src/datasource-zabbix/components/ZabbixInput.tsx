import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { Themeable, withTheme, Input, EventsWithValidation, ValidationEvents } from '@grafana/ui';
import { isRegex, variableRegex } from '../utils';
import { GrafanaTheme } from '@grafana/data';

const variablePattern = RegExp(`^${variableRegex.source}`);

const getStyles = (theme: GrafanaTheme) => ({
  inputRegex: css`
    color: ${theme.colors.orange}
  `,
  inputVariable: css`
    color: ${theme.colors.variable}
  `,
});

const zabbixInputValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
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
      rule: value => {
        if (value === '*') {
          return false;
        }
        return true;
      },
      errorMessage: 'Wildcards not supported. Use /.*/ instead',
    },
  ],
};

interface Props extends React.ComponentProps<typeof Input>, Themeable {
}

const UnthemedZabbixInput: FC<Props> = ({ theme, value, ref, validationEvents, ...restProps }) => {
  const styles = getStyles(theme);

  let inputClass;
  if (variablePattern.test(value as string)) {
    inputClass = styles.inputVariable;
  }
  if (isRegex(value)) {
    inputClass = styles.inputRegex;
  }

  return (
    <Input
      className={inputClass}
      value={value}
      validationEvents={zabbixInputValidationEvents}
      {...restProps}
    />
  );
};

export const ZabbixInput = withTheme(UnthemedZabbixInput);
