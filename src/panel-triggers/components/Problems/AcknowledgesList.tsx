import React from 'react';
import { ZBXAcknowledge } from '../../types';

interface AcknowledgesListProps {
  acknowledges: ZBXAcknowledge[];
}

export default function AcknowledgesList(props: AcknowledgesListProps) {
  const { acknowledges } = props;
  return (
    <div className="problem-ack-list">
      <div className="problem-ack-col problem-ack-time">
        {acknowledges.map(ack => <span key={ack.acknowledgeid} className="problem-ack-time">{ack.time}</span>)}
      </div>
      <div className="problem-ack-col problem-ack-user">
        {acknowledges.map(ack => <span key={ack.acknowledgeid} className="problem-ack-user">{ack.user}</span>)}
      </div>
      <div className="problem-ack-col problem-ack-message">
        {acknowledges.map(ack => <span key={ack.acknowledgeid} className="problem-ack-message">{ack.message}</span>)}
      </div>
    </div>
  );
}
