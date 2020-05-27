import React, { PureComponent } from 'react';
import { cx, css } from 'emotion';
import { ZBX_ACK_ACTION_ADD_MESSAGE, ZBX_ACK_ACTION_ACK, ZBX_ACK_ACTION_CHANGE_SEVERITY, ZBX_ACK_ACTION_CLOSE } from '../../datasource-zabbix/constants';
import { APIScriptGetResponse, ZBXScript } from '../../datasource-zabbix/zabbix/connectors/zabbix_api/types';
import { Button, VerticalGroup, Spinner, Modal, Select, Forms, stylesFactory, withTheme, Themeable } from '@grafana/ui';
import { FAIcon } from '../../components';

import * as grafanaUi from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
const Checkbox: any = Forms?.Checkbox || (grafanaUi as any).Checkbox;
const RadioButtonGroup: any = Forms?.RadioButtonGroup || (grafanaUi as any).RadioButtonGroup;

const KEYBOARD_ENTER_KEY = 13;
const KEYBOARD_ESCAPE_KEY = 27;

interface Props extends Themeable {
  getScripts(): Promise<APIScriptGetResponse>;
  onSubmit(data?: AckProblemData): Promise<any> | any;
  onDismiss?(): void;
}

interface State {
  selectedScript: SelectableValue<string>;
  scriptOptions: Array<SelectableValue<string>>;
  script: ZBXScript;
  error: boolean;
  errorMessage: string;
  selectError: string;
  result: string;
  loading: boolean;
}

export interface AckProblemData {
  message: string;
  closeProblem?: boolean;
  action?: number;
  severity?: number;
}

export class ExecScriptModalUnthemed extends PureComponent<Props, State> {
  scripts: ZBXScript[];

  constructor(props) {
    super(props);
    this.state = {
      error: false,
      errorMessage: '',
      selectError: '',
      selectedScript: null,
      result: '',
      loading: false,
      scriptOptions: [],
      script: null,
    };
  }

  async componentDidMount() {
    const scripts = await this.props.getScripts();
    this.scripts = scripts;
    const scriptOptions: Array<SelectableValue<string>> = scripts.map(s => {
      return {
        value: s.scriptid,
        label: s.name,
        description: s.description || s.command,
      };
    });

    const selectedScript = scriptOptions?.length ? scriptOptions[0] : null;
    const script = scripts.find(s => selectedScript.value === s.scriptid);

    this.setState({ scriptOptions, selectedScript, script });
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

  onChangeSelectedScript = (v: SelectableValue<string>) => {
    const script = this.scripts.find(s => v.value === s.scriptid);
    this.setState({ selectedScript: v, script });
  };

  dismiss = () => {
    this.setState({ selectedScript: null, error: false, errorMessage: '', selectError: '', loading: false });
    this.props.onDismiss();
  }

  submit = () => {
    // const { acknowledge, changeSeverity, closeProblem } = this.state;

    // const actionSelected = acknowledge || changeSeverity || closeProblem;
    // if (!this.state.value && !actionSelected) {
    //   return this.setState({
    //     error: true,
    //     errorMessage: 'Enter message text or select an action'
    //   });
    // }

    // this.setState({ ackError: '', loading: true });

    // const ackData: AckProblemData = {
    //   message: this.state.value,
    // };

    // let action = ZBX_ACK_ACTION_ADD_MESSAGE;
    // if (this.state.acknowledge) {
    //   action += ZBX_ACK_ACTION_ACK;
    // }
    // if (this.state.changeSeverity) {
    //   action += ZBX_ACK_ACTION_CHANGE_SEVERITY;
    //   ackData.severity = this.state.selectedSeverity;
    // }
    // if (this.state.closeProblem) {
    //   action += ZBX_ACK_ACTION_CLOSE;
    // }
    // ackData.action = action;

    // this.props.onSubmit(ackData).then(() => {
    //   this.dismiss();
    // }).catch(err => {
    //   this.setState({
    //     ackError: err.message || err.data,
    //     loading: false,
    //   });
    // });
  }

  render() {
    const { theme } = this.props;
    const { scriptOptions, selectedScript, script, selectError, errorMessage } = this.state;

    const styles = getStyles(theme);
    const modalClass = cx(styles.modal);
    const modalTitleClass = cx(styles.modalHeaderTitle);
    const inputGroupClass = cx('gf-form', styles.inputGroup);
    const inputHintClass = cx('gf-form-hint-text', styles.inputHint);
    const inputErrorClass = cx('gf-form-hint-text', styles.inputError);
    const scriptCommandClass = cx('gf-form-hint-text', styles.scriptCommand);

    return (
      <Modal
        isOpen={true}
        onDismiss={this.dismiss}
        className={modalClass}
        title={
          <div className={modalTitleClass}>
            {this.state.loading ? <Spinner size={18} /> : <FAIcon icon="terminal" />}
            <span className="p-l-1">Execute script</span>
          </div>
        }
      >
        <div className={inputGroupClass}>
          <label className="gf-form-hint">
            <Select
              options={scriptOptions}
              value={selectedScript}
              onChange={this.onChangeSelectedScript}
            />
            <small className={inputHintClass}>Press Enter to execute</small>
            {selectError &&
              <small className={inputErrorClass}>{selectError}</small>
            }
          </label>
        </div>
        <div className="gf-form">
          {script && <small className={scriptCommandClass}>{script.command}</small>}
        </div>

        {this.state.error &&
          <div className="gf-form ack-request-error">
            <span className={styles.execError}>{errorMessage}</span>
          </div>
        }

        <div className="gf-form-button-row text-center">
          <Button variant="primary" onClick={this.submit}>Execute</Button>
          <Button variant="secondary" onClick={this.dismiss}>Cancel</Button>
        </div>
      </Modal>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const red = theme.colors.red || (theme as any).palette.red;
  return {
    modal: css`
      width: 500px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.heading.h3};
      padding-top: ${theme.spacing.sm};
      margin: 0 ${theme.spacing.md};
      display: flex;
    `,
    inputGroup: css`
    `,
    input: css`
      border-color: ${red};
      border-radius: 2px;
      outline-offset: 2px;
      box-shadow: 0 0 0 2px ${theme.colors.pageBg || (theme as any).colors.bg1}, 0 0 0px 4px ${red};
    `,
    scriptCommand: css`
      float: left;
      color: ${theme.colors.textWeak};
      text-align: left;
      font-family: ${theme.typography.fontFamily.monospace};
    `,
    inputHint: css`
      display: inherit;
      float: right;
      color: ${theme.colors.textWeak};
    `,
    inputError: css`
      float: left;
      color: ${red};
    `,
    execError: css`
      color: ${red};
    `,
  };
});

export const ExecScriptModal = withTheme(ExecScriptModalUnthemed);
