import React, { CSSProperties } from 'react';
import classNames from 'classnames';
import { ZBXTrigger } from '../../types';

interface AlertIconProps {
  problem: ZBXTrigger;
  color: string;
  blink?: boolean;
  highlightBackground?: boolean;
}

export default function AlertIcon(props: AlertIconProps) {
  const { problem, color, blink, highlightBackground } = props;
  const priority = Number(problem.priority);
  let iconClass = '';
  if (problem.value === '1' && priority >= 2) {
    iconClass = 'icon-gf-critical';
  } else {
    iconClass = 'icon-gf-online';
  }

  const className = classNames('icon-gf', iconClass, { 'zabbix-trigger--blinked': blink });
  const style: CSSProperties = {};
  if (!highlightBackground) {
    style.color = color;
  }

  return (
    <div className="alert-rule-item__icon" style={style}>
      <i className={className}></i>
    </div>
  );
}
