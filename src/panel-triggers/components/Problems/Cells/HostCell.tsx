import React from 'react';
import FAIcon from '../../../../components/FAIcon/FAIcon';

interface HostCellProps {
  name: string;
  maintenance: boolean;
}

export const HostCell: React.FC<HostCellProps> = ({ name, maintenance }) => {
  return (
    <div>
      <span style={{ paddingRight: '0.4rem' }}>{name}</span>
      {maintenance && <FAIcon customClass="fired" icon="wrench" />}
    </div>
  );
};
