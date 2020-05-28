import { PureComponent } from 'react';
import ReactDOM from 'react-dom';

interface Props {
  className?: string;
  root?: HTMLElement;
}

export default class BodyPortal extends PureComponent<Props> {
  node: HTMLElement;
  portalRoot: HTMLElement;

  constructor(props) {
    super(props);
    const {
      className,
      root = document.body
    } = this.props;

    this.node = document.createElement('div');
    if (className) {
      this.node.classList.add(className);
    }

    this.portalRoot = root;
    this.portalRoot.appendChild(this.node);
  }

  componentWillUnmount() {
    this.portalRoot.removeChild(this.node);
  }

  render() {
    return ReactDOM.createPortal(this.props.children, this.node);
  }
}
