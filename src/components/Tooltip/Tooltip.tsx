import React, { FC } from 'react';
import Popper from './Popper';
import withPopper, { UsingPopperProps } from './withPopper';

const TooltipWrapper: FC<UsingPopperProps> = ({ hidePopper, showPopper, className, children, ...restProps }) => {
  return (
    <div className={`popper__manager ${className}`} onMouseEnter={showPopper} onMouseLeave={hidePopper}>
      <Popper {...restProps}>{children}</Popper>
    </div>
  );
};

export const Tooltip = withPopper(TooltipWrapper);

export default Tooltip;
