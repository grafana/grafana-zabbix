import React, { FC } from 'react';
import { cx } from 'emotion';

interface Props {
  status: 'critical' | 'warning' | 'online' | 'ok' | 'problem';
  className?: string;
}

export const GFHeartIcon: FC<Props> = ({ status, className }) => {
  const iconClass = cx(
    className,
    'icon-gf',
    { "icon-gf-critical": status === 'critical' || status === 'problem' || status === 'warning'},
    { "icon-gf-online": status === 'online' || status === 'ok' },
  );

  return (
    <i className={iconClass}></i>
  );
};

export default GFHeartIcon;
