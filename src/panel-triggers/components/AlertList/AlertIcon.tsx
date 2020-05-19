import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { GFHeartIcon } from '../../../components';
import { ProblemDTO } from '../../../datasource-zabbix/types';

interface Props {
  problem: ProblemDTO;
  color: string;
  blink?: boolean;
  highlightBackground?: boolean;
}

export const AlertIcon: FC<Props> = ({ problem, color, blink, highlightBackground }) => {
  const severity = Number(problem.severity);
  const status = problem.value === '1' && severity >= 2 ? 'critical' : 'online';

  const iconClass = cx(
    'icon-gf',
    blink && 'zabbix-trigger--blinked',
  );

  const wrapperClass = cx(
    'alert-rule-item__icon',
    !highlightBackground && css`color: ${color}`
  );

  return (
    <div className={wrapperClass}>
      <GFHeartIcon status={status} className={iconClass} />
    </div>
  );
};

export default AlertIcon;
