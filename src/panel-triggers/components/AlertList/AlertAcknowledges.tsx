import React, { PureComponent } from 'react';
import { TimeZone } from '@grafana/schema';
import { ProblemDTO } from '../../../datasource/types';
import { ACK_TIME_FORMAT, formatUnixTime } from '../../utils';

interface AlertAcknowledgesProps {
  problem: ProblemDTO;
  timeZone?: TimeZone;
  onClick: (event?) => void;
}

export default class AlertAcknowledges extends PureComponent<AlertAcknowledgesProps> {
  handleClick = (event) => {
    this.props.onClick(event);
  };

  render() {
    const { problem, timeZone } = this.props;
    const ackRows =
      problem.acknowledges &&
      problem.acknowledges.map((ack) => {
        return (
          <tr key={ack.acknowledgeid}>
            <td>{formatUnixTime(ack.clock, ACK_TIME_FORMAT, timeZone)}</td>
            <td>{ack.user}</td>
            <td>{ack.message}</td>
          </tr>
        );
      });
    return (
      <div className="ack-tooltip">
        <table className="table">
          <thead>
            <tr>
              <th className="ack-time">Time</th>
              <th className="ack-user">User</th>
              <th className="ack-comments">Comments</th>
            </tr>
          </thead>
          <tbody>{ackRows}</tbody>
        </table>
        {problem.showAckButton && (
          <div className="ack-add-button">
            <button
              id="add-acknowledge-btn"
              className="btn btn-mini btn-inverse gf-form-button"
              onClick={this.handleClick}
            >
              <i className="fa fa-plus"></i>
            </button>
          </div>
        )}
      </div>
    );
  }
}
