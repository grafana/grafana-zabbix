import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { ZBX_ACK_ACTION_ADD_MESSAGE, ZBX_ACK_ACTION_ACK, ZBX_ACK_ACTION_CHANGE_SEVERITY, ZBX_ACK_ACTION_CLOSE } from '../../datasource-zabbix/constants';
import { Button, Input, VerticalGroup, Spinner } from '@grafana/ui';
import { FAIcon } from '../../components';

import * as grafanaUi from '@grafana/ui';
const Checkbox: any = grafanaUi.Forms?.Checkbox || (grafanaUi as any).Checkbox;
const RadioButtonGroup: any = grafanaUi.Forms?.RadioButtonGroup || (grafanaUi as any).RadioButtonGroup;

const KEYBOARD_ENTER_KEY = 13;
const KEYBOARD_ESCAPE_KEY = 27;

interface Props {
  canAck?: boolean;
  canClose?: boolean;
  isOpen?: boolean;
  severity?: number;
  withBackdrop?: boolean;
  onSubmit: (data?: AckProblemData) => Promise<any> | any;
  onClose?: () => void;
}

interface State {
  value: string;
  error: boolean;
  errorMessage: string;
  ackError: string;
  acknowledge: boolean;
  closeProblem: boolean;
  changeSeverity: boolean;
  selectedSeverity: number;
  loading: boolean;
}

export interface AckProblemData {
  message: string;
  closeProblem?: boolean;
  action?: number;
  severity?: number;
}

const severityOptions = [
  {value: 0, label: 'Not classified'},
  {value: 1, label: 'Information'},
  {value: 2, label: 'Warning'},
  {value: 3, label: 'Average'},
  {value: 4, label: 'High'},
  {value: 5, label: 'Disaster'}
];

export class AckModal extends PureComponent<Props, State> {
  modalContainer: HTMLElement;

  static defaultProps: Partial<Props> = {
    withBackdrop: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      value: '',
      error: false,
      errorMessage: '',
      ackError: '',
      acknowledge: false,
      closeProblem: false,
      changeSeverity: false,
      selectedSeverity: props.severity || 0,
      loading: false,
    };

    this.modalContainer = document.body;
  }

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value, error: false });
  }

  handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.which === KEYBOARD_ENTER_KEY || event.key === 'Enter') {
      this.submit();
    } else if (event.which === KEYBOARD_ESCAPE_KEY || event.key === 'Escape') {
      this.dismiss();
    }
  }

  handleBackdropClick = () => {
    this.dismiss();
  }

  onAcknowledgeToggle = () => {
    this.setState({ acknowledge: !this.state.acknowledge, error: false });
  }

  onChangeSeverityToggle = () => {
    this.setState({ changeSeverity: !this.state.changeSeverity, error: false });
  }

  onCloseProblemToggle = () => {
    this.setState({ closeProblem: !this.state.closeProblem, error: false });
  }

  onChangeSelectedSeverity = v => {
    this.setState({ selectedSeverity: v });
  };

  dismiss = () => {
    this.setState({ value: '', error: false, errorMessage: '', ackError: '', loading: false });
    this.props.onClose();
  }

  submit = () => {
    const { acknowledge, changeSeverity, closeProblem } = this.state;

    const actionSelected = acknowledge || changeSeverity || closeProblem;
    if (!this.state.value && !actionSelected) {
      return this.setState({
        error: true,
        errorMessage: 'Enter message text or select an action'
      });
    }

    this.setState({ ackError: '', loading: true });

    const ackData: AckProblemData = {
      message: this.state.value,
    };

    let action = ZBX_ACK_ACTION_ADD_MESSAGE;
    if (this.state.acknowledge) {
      action += ZBX_ACK_ACTION_ACK;
    }
    if (this.state.changeSeverity) {
      action += ZBX_ACK_ACTION_CHANGE_SEVERITY;
      ackData.severity = this.state.selectedSeverity;
    }
    if (this.state.closeProblem) {
      action += ZBX_ACK_ACTION_CLOSE;
    }
    ackData.action = action;

    this.props.onSubmit(ackData).then((response) => {
      this.dismiss();
    }).catch(err => {
      this.setState({
        ackError: err.message || err.data,
        loading: false,
      });
    });
  }

  render() {
    const { canClose, canAck } = this.props;
    if (!this.props.isOpen || !this.modalContainer) {
      return null;
    }

    const inputClass = classNames({ 'zbx-ack-error': this.state.error });

    const modalNode = (
      <div className="modal modal--narrow zbx-ack-modal" key="modal">
        <div className="modal-body">
          <div className="modal-header">
            <h2 className="modal-header-title" style={{ display: 'flex' }}>
              {this.state.loading ? <Spinner size={18} /> : <FAIcon icon="reply-all" />}
              <span className="p-l-1">Acknowledge Problem</span>
            </h2>

            <a className="modal-header-close" onClick={this.dismiss}>
              <FAIcon icon="remove" />
            </a>
          </div>
          <div className="modal-content">
            <div className="gf-form">
              <label className="gf-form-hint">
                <Input className={inputClass}
                  type="text"
                  name="message"
                  placeholder="Message"
                  maxLength={64}
                  autoComplete="off"
                  autoFocus={true}
                  value={this.state.value}
                  onChange={this.handleChange}
                  onKeyUp={this.handleKeyUp}>
                </Input>
                <small className="gf-form-hint-text muted">Press Enter to submit</small>
                {this.state.error &&
                  <small className="gf-form-hint-text muted ack-error-message">{this.state.errorMessage}</small>
                }
              </label>
            </div>

            <div className="gf-form">
              <VerticalGroup>
                <Checkbox label="Acknowledge" value={this.state.acknowledge} onChange={this.onAcknowledgeToggle} />
                <Checkbox label="Change severity" description="" value={this.state.changeSeverity} onChange={this.onChangeSeverityToggle} />
                {this.state.changeSeverity &&
                  <RadioButtonGroup
                    size="sm"
                    options={severityOptions}
                    value={this.state.selectedSeverity}
                    onChange={this.onChangeSelectedSeverity}
                  />
                }
                {canClose &&
                  <Checkbox label="Close problem" disabled={!canClose} value={this.state.closeProblem} onChange={this.onCloseProblemToggle} />
                }
              </VerticalGroup>
            </div>

            {this.state.ackError &&
              <div className="gf-form ack-request-error">
                <span className="ack-error-message">{this.state.ackError}</span>
              </div>
            }

            <div className="gf-form-button-row text-center">
              <Button variant="primary" onClick={this.submit}>Update</Button>
              <Button variant="secondary" onClick={this.dismiss}>Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    );

    const modalNodeWithBackdrop = [
      modalNode,
      <div className="modal-backdrop in" key="modal-backdrop" onClick={this.handleBackdropClick}></div>
    ];

    const modal = this.props.withBackdrop ? modalNodeWithBackdrop : modalNode;
    return ReactDOM.createPortal(modal, this.modalContainer);
  }
}
