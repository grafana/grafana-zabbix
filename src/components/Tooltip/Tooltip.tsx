import React, { FC } from 'react';
import Popper from './Popper';
import withPopper, { UsingPopperProps } from './withPopper';

const Tooltip: FC<UsingPopperProps> = ({ hidePopper, showPopper, className, children, ...restProps }) => {
  return (
    <div className={`popper__manager ${className}`} onMouseEnter={showPopper} onMouseLeave={hidePopper}>
      <Popper {...restProps}>{children}</Popper>
    </div>
  );
};

export default withPopper(Tooltip);
