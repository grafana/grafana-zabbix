import React from 'react';

interface FAIconProps {
  icon: string;
  customClass?: string;
}

export const FAIcon: React.FC<FAIconProps> = (props: FAIconProps) => {
  return (
    <span className={`fa-icon-container ${props.customClass || ''}`}>
      <i className={`fa fa-${props.icon}`}></i>
    </span>
  );
};

export default FAIcon;
