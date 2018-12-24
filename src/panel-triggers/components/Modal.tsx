import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  isOpen?: boolean;
  withBackdrop?: boolean;
  onSubmit: (data?: AckProblemData) => Promise<any> | any;
  onClose?: () => void;
}

interface ModalState {
  value: string;
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
    this.state = { value: '' };

    this.modalContainer = document.body;
  }

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value });
  }

  dismiss = () => {
    console.log('dismiss');
    this.setState({ value: '' });
    this.props.onClose();
  }

  submit = () => {
    console.log('submit', this.state.value);
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

    const modalNode = (
      <div className="modal modal--narrow" key="modal">
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
            {/* Message */}
            <div className="gf-form">
              <label className="gf-form-hint">
                <input className="gf-form-input"
                  type="text"
                  name="message"
                  placeholder="Message"
                  maxLength={64}
                  autoComplete="off"
                  autoFocus={true}
                  value={this.state.value}
                  onChange={this.handleChange}>
                </input>
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
      <div className="modal-backdrop in" key="modal-backdrop"></div>
    ];

    const modal = this.props.withBackdrop ? modalNodeWithBackdrop : modalNode;
    return ReactDOM.createPortal(modal, this.modalContainer);
  }
}
