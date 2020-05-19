import React, { FC } from 'react';
import ReactDOM from 'react-dom';
import { provideTheme } from '../ConfigProvider/ConfigProvider';

interface ModalWrapperProps {
  showModal: <T>(component: React.ComponentType<T>, props: T) => void;
  hideModal: () => void;
}

type ModalWrapper<T> = FC<ModalWrapperProps>;

interface Props {
  children: ModalWrapper<any>;
}

interface State {
  component: React.ComponentType<any> | null;
  props: any;
}

export class ModalController extends React.Component<Props, State> {
  modalRoot = document.body;
  modalNode = document.createElement('div');

  constructor(props: Props) {
    super(props);
    this.state = {
      component: null,
      props: {},
    };
  }

  showModal = (component: React.ComponentType<any>, props: any) => {
    this.setState({
      component,
      props
    });
  };

  hideModal = () => {
    this.modalRoot.removeChild(this.modalNode);
    this.setState({
      component: null,
      props: {},
    });
  };

  renderModal() {
    const { component, props } = this.state;
    if (!component) {
      return null;
    }

    this.modalRoot.appendChild(this.modalNode);
    const modal = React.createElement(provideTheme(component), props);
    return ReactDOM.createPortal(modal, this.modalNode);
  }

  render() {
    const { children } = this.props;
    const ChildrenComponent = children;

    return (
      <>
        <ChildrenComponent showModal={this.showModal} hideModal={this.hideModal} />
        {this.renderModal()}
      </>
    );
  }
}
