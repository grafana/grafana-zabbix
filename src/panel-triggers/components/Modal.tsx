import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

const KEYBOARD_ENTER_KEY = 13;
const KEYBOARD_ESCAPE_KEY = 27;

interface ModalProps {
  isOpen?: boolean;
  withBackdrop?: boolean;
  onSubmit: (data?: AckProblemData) => Promise<any> | any;
  onClose?: () => void;
}

interface ModalState {
  value: string;
  error: boolean;
  message: string;
}

export interface AckProblemData {
  message: string;
  closeProblem?: boolean;
  action?: number;
}

export class Modal extends PureComponent<ModalProps, ModalState> {
  modalContainer: HTMLElement;

  constructor(props) {
    super(props);
    this.state = {
      value: '',
      error: false,
      message: '',
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

  dismiss = () => {
    this.setState({ value: '', error: false, message: '' });
    this.props.onClose();
  }

  submit = () => {
    if (!this.state.value) {
      return this.setState({
        error: true,
        message: 'Enter message text'
      });
    }
    this.props.onSubmit({
      message: this.state.value
    }).then(() => {
      this.dismiss();
    });
  }

  render() {
    if (!this.props.isOpen || !this.modalContainer) {
      return null;
    }

    const inputClass = classNames('gf-form-input', { 'zbx-ack-error': this.state.error });

    const modalNode = (
      <div className="modal modal--narrow zbx-ack-modal" key="modal">
        <div className="modal-body">
          <div className="modal-header">
            <h2 className="modal-header-title">
              <i className="fa fa-reply-all"></i>
              <span className="p-l-1">Acknowledge Problem</span>
            </h2>

            <a className="modal-header-close" onClick={this.dismiss}>
              <i className="fa fa-remove"></i>
            </a>
          </div>
          <div className="modal-content">
            <div className="gf-form">
              <label className="gf-form-hint">
                <input className={inputClass}
                  type="text"
                  name="message"
                  placeholder="Message"
                  maxLength={64}
                  autoComplete="off"
                  autoFocus={true}
                  value={this.state.value}
                  onChange={this.handleChange}
                  onKeyUp={this.handleKeyUp}>
                </input>
                <small className="gf-form-hint-text muted">Press Enter to submit</small>
                {this.state.error &&
                  <small className="gf-form-hint-text muted ack-error-message">{this.state.message}</small>
                }
              </label>
            </div>

            <div className="gf-form-button-row text-center">
              <button className="btn btn-success" onClick={this.submit}>Acknowledge</button>
              <button className="btn btn-inverse" onClick={this.dismiss}>Cancel</button>
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
