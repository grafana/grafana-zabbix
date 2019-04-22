import React, { PureComponent } from 'react';
import { ZBXTrigger } from '../../types';

interface AlertAcknowledgesProps {
  problem: ZBXTrigger;
  onClick: (event?) => void;
}

export default class AlertAcknowledges extends PureComponent<AlertAcknowledgesProps> {
  handleClick = (event) => {
    this.props.onClick(event);
  }

  render() {
    const { problem } = this.props;
    const ackRows = problem.acknowledges && problem.acknowledges.map(ack => {
      return (
        <tr key={ack.acknowledgeid}>
          <td>{ack.time}</td>
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
          <tbody>
            {ackRows}
          </tbody>
        </table>
        {problem.showAckButton &&
          <div className="ack-add-button">
            <button id="add-acknowledge-btn" className="btn btn-mini btn-inverse gf-form-button" onClick={this.handleClick}>
              <i className="fa fa-plus"></i>
            </button>
          </div>
        }
      </div>
    );
  }
}
