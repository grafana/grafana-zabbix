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
    // Wrap the component once here instead of in renderModal(): provideTheme()
    // creates a new component type on every call, so wrapping during render
    // would remount the modal (dropping its state) on every parent re-render.
    this.setState({
      component: provideTheme(component),
      props,
    });
  };

  hideModal = () => {
    this.modalRoot.removeChild(this.modalNode);
    this.setState({
      component: null,
      props: {},
    });
  };

  renderModal(): React.ReactNode {
    const { component, props } = this.state;
    if (!component) {
      return null;
    }

    this.modalRoot.appendChild(this.modalNode);
    const modal = React.createElement(component, props);
    return ReactDOM.createPortal(modal, this.modalNode) as React.ReactNode;
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
