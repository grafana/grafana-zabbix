import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, Spinner, Modal, Select, stylesFactory, withTheme, Themeable, ButtonGroup } from '@grafana/ui';
import { ZBXScript, APIExecuteScriptResponse } from '../../datasource/zabbix/connectors/zabbix_api/types';
import { FAIcon } from '../../components';

interface Props extends Themeable {
  getScripts(): Promise<ZBXScript[]>;
  onSubmit(data?: ExecScriptData): Promise<any> | any;
  onDismiss?(): void;
}

interface State {
  selectedScript: SelectableValue<string>;
  scriptOptions: Array<SelectableValue<string>>;
  script: ZBXScript;
  error: boolean;
  errorMessage: string | JSX.Element;
  result: string | JSX.Element;
  selectError: string;
  loading: boolean;
}

export interface ExecScriptData {
  scriptid: string;
  scope: string;
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
    const scriptOptions: Array<SelectableValue<string>> = scripts.map((s) => {
      return {
        value: s.scriptid,
        label: s.name,
        description: s.description || s.command,
      };
    });

    const selectedScript = scriptOptions?.length ? scriptOptions[0] : null;
    const script = scripts.find((s) => selectedScript.value === s.scriptid);

    this.setState({ scriptOptions, selectedScript, script });
  }

  onChangeSelectedScript = (v: SelectableValue<string>) => {
    const script = this.scripts.find((s) => v.value === s.scriptid);
    this.setState({ selectedScript: v, script, errorMessage: '', loading: false, result: '' });
  };

  dismiss = () => {
    this.setState({ selectedScript: null, error: false, errorMessage: '', selectError: '', loading: false });
    this.props.onDismiss();
  };

  submit = () => {
    const { selectedScript } = this.state;

    if (!selectedScript) {
      return this.setState({
        selectError: 'Select a script to execute.',
      });
    }

    this.setState({ errorMessage: '', loading: true, result: '' });

    const data: ExecScriptData = {
      scriptid: selectedScript.value,
      scope: this.state.script.scope,
    };

    this.props
      .onSubmit(data)
      .then((result: APIExecuteScriptResponse) => {
        const message = this.formatResult(result?.value || '');
        if (result?.response === 'success') {
          this.setState({ result: message, loading: false });
        } else {
          this.setState({ error: true, errorMessage: message, loading: false });
        }
      })
      .catch((err) => {
        let errorMessage = err.data?.message || err.data?.error || err.data || err.statusText || '';
        errorMessage = this.formatResult(errorMessage);
        this.setState({
          error: true,
          loading: false,
          errorMessage,
        });
      });
  };

  formatResult = (result: string) => {
    const formatted = result.split('\n').map((p, i) => {
      return <p key={i}>{p}</p>;
    });
    return <>{formatted}</>;
  };

  render() {
    const { theme } = this.props;
    const { scriptOptions, selectedScript, script, result, selectError, errorMessage, error } = this.state;

    const styles = getStyles(theme);

    return (
      <Modal
        isOpen={true}
        onDismiss={this.dismiss}
        className={styles.modal}
        title={
          <div className={styles.modalHeaderTitle}>
            {this.state.loading ? <Spinner size={18} /> : <FAIcon icon="terminal" />}
            Execute script
          </div>
        }
      >
        <Select options={scriptOptions} value={selectedScript} onChange={this.onChangeSelectedScript} />
        {selectError && <small className={styles.inputError}>{selectError}</small>}

        <div className={styles.scriptCommandContainer}>
          {script && <small className={styles.scriptCommand}>{script.command}</small>}
        </div>

        <div className={styles.resultContainer}>
          {result && <span className={styles.execResult}>{result}</span>}
          {error && <span className={styles.execError}>{errorMessage}</span>}
        </div>

        <ButtonGroup className={styles.buttonGroup}>
          <Button variant="primary" onClick={this.submit}>
            Execute
          </Button>

          <Button variant="secondary" onClick={this.dismiss}>
            Cancel
          </Button>
        </ButtonGroup>
      </Modal>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const red = theme.palette.red;
  return {
    modal: css`
      width: 600px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.heading.h3};
      padding-top: ${theme.spacing.sm};
      margin: 0 ${theme.spacing.md};
      display: flex;
    `,
    input: css`
      border-color: ${red};
      border-radius: 2px;
      outline-offset: 2px;
      box-shadow:
        0 0 0 2px ${theme.colors.bg1},
        0 0 0px 4px ${red};
    `,
    scriptCommandContainer: css`
      margin-bottom: ${theme.spacing.md};
    `,
    scriptCommand: css`
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
    resultContainer: css`
      min-height: 50px;
      font-family: ${theme.typography.fontFamily.monospace};
      font-size: ${theme.typography.size.sm};
      p {
        font-size: ${theme.typography.size.sm};
        margin-bottom: 0px;
      }
    `,
    execResult: css``,
    execError: css`
      color: ${red};
    `,
    buttonGroup: css`
      justify-content: center;
      gap: ${theme.spacing.sm};
      margin-top: ${theme.spacing.md};
    `,
  };
});

export const ExecScriptModal = withTheme(ExecScriptModalUnthemed);
