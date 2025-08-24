import React from 'react';
import { ZBXAcknowledge } from '../../../datasource/types';

interface AcknowledgesListProps {
  acknowledges: ZBXAcknowledge[];
}

export default function AcknowledgesList(props: AcknowledgesListProps) {
  const { acknowledges } = props;
  return (
    <div className="problem-ack-list">
      <div className="problem-ack-col problem-ack-time">
        {acknowledges.map((ack) => (
          <span key={ack.acknowledgeid} className="problem-ack-time">
            {ack.time}
          </span>
        ))}
      </div>
      <div className="problem-ack-col problem-ack-user">
        {acknowledges.map((ack) => (
          <span key={ack.acknowledgeid} className="problem-ack-user">
            {formatUserName(ack)}
          </span>
        ))}
      </div>
      <div className="problem-ack-col problem-ack-message">
        {acknowledges.map((ack) => (
          <span key={ack.acknowledgeid} className="problem-ack-message">
            {formatAckMessage(ack.message)}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatUserName(ack: ZBXAcknowledge): string {
  if (!ack.name && !ack.surname) {
    return ack.user;
  } else {
    return `${ack.name} ${ack.surname}`.trim();
  }
}

function formatAckMessage(ack: ZBXAcknowledge): string 
{
  let msg = ack.message;
  if ((ack.action & 2) !== 0) {
    msg = "(Acknowledged) ";
  } else if ((ack.action & 16) !== 0) {
    msg = "(Unacknowledged) ";
  }

  if ((ack.action & 32) !== 0) {
    msg = msg + "(Suppressed) ";
  } else if ((ack.action & 64) !== 0) {
    msg = msg + "(Unsuppressed) ";
  }
  
  if ((ack.action & 8) !== 0) {
    msg = msg + "(Changed severity) ";
  }
  
  msg = msg + ack.message
  return msg.trim();
}
