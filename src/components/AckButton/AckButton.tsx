import React, { FC } from 'react';
import { ActionButton } from '../ActionButton/ActionButton';

interface Props {
  className?: string;
  onClick(): void;
}

export const AckButton: FC<Props> = ({ className, onClick }) => {
  return (
    <ActionButton className={className} icon="reply-all" tooltip="Acknowledge problem" onClick={onClick} />
  );
};
