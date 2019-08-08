import React from 'react';
import classNames from 'classnames';

interface GFHeartIconProps {
  status: 'critical' | 'warning' | 'online' | 'ok' | 'problem';
  className?: string;
}

export default function GFHeartIcon(props: GFHeartIconProps) {
  const status = props.status;
  const className = classNames("icon-gf", props.className,
    { "icon-gf-critical": status === 'critical' || status === 'problem' || status === 'warning'},
    { "icon-gf-online": status === 'online' || status === 'ok' },
  );
  return (
    <i className={className}></i>
  );
}
