import React, { FC } from 'react';
import { cx } from 'emotion';

interface Props {
  icon: string;
  customClass?: string;
}

export const FAIcon: FC<Props> = ({ icon, customClass }) => {
  const wrapperClass = cx('fa-icon-container', customClass);

  return (
    <span className={wrapperClass}>
      <i className={`fa fa-${icon}`}></i>
    </span>
  );
};

export default FAIcon;
