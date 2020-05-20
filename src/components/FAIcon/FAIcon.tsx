import React, { FC } from 'react';
import { cx } from 'emotion';

interface Props {
  icon: string;
  customClass?: string;
}

export const FAIcon: FC<Props> = ({ icon, customClass }) => {
  const wrapperClass = cx(customClass, 'fa-icon-container');

  return (
    <span className={wrapperClass}>
      <i className={`fa fa-${icon}`}></i>
    </span>
  );
};

export default FAIcon;
