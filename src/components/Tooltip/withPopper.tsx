import React from 'react';

export interface UsingPopperProps {
  showPopper: (prevState: object) => void;
  hidePopper: (prevState: object) => void;
  renderContent: (content: any) => any;
  show: boolean;
  placement?: string;
  content: string | ((props: any) => JSX.Element);
  className?: string;
  refClassName?: string;
  popperClassName?: string;
}

interface Props {
  placement?: string;
  className?: string;
  refClassName?: string;
  popperClassName?: string;
  content: string | ((props: any) => JSX.Element);
}

interface State {
  show: boolean;
}

export const withPopper = (WrappedComponent) => {
  return class extends React.Component<Props, State> {
    static defaultProps: Partial<Props> = {
      placement: 'auto',
    };

    constructor(props) {
      super(props);
      this.state = {
        show: false,
      };
    }

    showPopper = () => {
      this.setState({ show: true });
    };

    hidePopper = () => {
      this.setState({ show: false });
    };

    renderContent(content) {
      if (typeof content === 'function') {
        // If it's a function we assume it's a React component
        const ReactComponent = content;
        return <ReactComponent />;
      }
      return content;
    }

    render() {
      const { show } = this.state;
      const { placement, className } = this.props;

      return (
        <WrappedComponent
          {...this.props}
          showPopper={this.showPopper}
          hidePopper={this.hidePopper}
          renderContent={this.renderContent}
          placement={placement}
          className={className}
          show={show}
        />
      );
    }
  };
};

export default withPopper;
