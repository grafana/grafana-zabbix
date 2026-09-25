import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import moment from 'moment/moment';
import {
  ZBX_ACK_ACTION_ADD_MESSAGE,
  ZBX_ACK_ACTION_ACK,
  ZBX_ACK_ACTION_CHANGE_SEVERITY,
  ZBX_ACK_ACTION_CLOSE,
  ZBX_ACK_ACTION_UNACK,
  ZBX_ACK_ACTION_SUPPRESS,
  ZBX_ACK_ACTION_UNSUPPRESS,
  ZBX_ACK_ACTION_RANK_CAUSE,
  ZBX_ACK_ACTION_RANK_SYMPTOM,
} from '../../datasource/constants';
import {
  Button,
  VerticalGroup,
  Spinner,
  Modal,
  Checkbox,
  Input,
  RadioButtonGroup,
  Select,
  stylesFactory,
  withTheme,
  Themeable,
  TextArea,
  ButtonGroup,
} from '@grafana/ui';
import { FAIcon } from '../../components';
import { GrafanaTheme, rangeUtil, SelectableValue } from '@grafana/data';

const KEYBOARD_ENTER_KEY = 13;
const KEYBOARD_ESCAPE_KEY = 27;

export const SUPPRESS_DATE_FORMAT = 'YYYY-MM-DD HH:mm';

interface Props extends Themeable {
  /** Problem is not acknowledged yet */
  canAck?: boolean;
  /** Problem allows manual close */
  canClose?: boolean;
  /** Problem is acknowledged and the server supports unacknowledge (Zabbix 5.0+) */
  canUnack?: boolean;
  /** Problem is not suppressed and the server supports manual suppression (Zabbix 6.2+) */
  canSuppress?: boolean;
  /** Problem is suppressed and the server supports manual suppression (Zabbix 6.2+) */
  canUnsuppress?: boolean;
  /** Problem is a symptom and the server supports event ranking (Zabbix 6.4+) */
  canRankAsCause?: boolean;
  /** Problem is a cause and the server supports event ranking (Zabbix 6.4+) */
  canRankAsSymptom?: boolean;
  /** Problems from the panel which can be selected as the cause event */
  causeEvents?: Array<SelectableValue<string>>;
  severity?: number;
  withBackdrop?: boolean;
  onSubmit: (data?: AckProblemData) => Promise<any> | any;
  onDismiss?: () => void;
}

interface State {
  value: string;
  error: boolean;
  errorMessage: string;
  ackError: string;
  acknowledge: boolean;
  unacknowledge: boolean;
  closeProblem: boolean;
  changeSeverity: boolean;
  selectedSeverity: number;
  suppress: boolean;
  unsuppress: boolean;
  suppressUntilMode: SuppressUntilMode;
  suppressDuration: string;
  suppressDate: string;
  suppressInputError: string;
  rankAsCause: boolean;
  rankAsSymptom: boolean;
  causeEventid: string;
  loading: boolean;
}

export interface AckProblemData {
  message: string;
  closeProblem?: boolean;
  action?: number;
  severity?: number;
  /** Unix timestamp until which the event must be suppressed, 0 for indefinite suppression */
  suppress_until?: number;
  /** Cause event ID, required for the "rank as symptom" action */
  cause_eventid?: string;
}

type SuppressUntilMode = 'indefinite' | 'duration' | 'date';

const severityOptions = [
  { value: 0, label: 'Not classified' },
  { value: 1, label: 'Information' },
  { value: 2, label: 'Warning' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Disaster' },
];

const suppressUntilOptions: Array<{ value: SuppressUntilMode; label: string }> = [
  { value: 'indefinite', label: 'Indefinitely' },
  { value: 'duration', label: 'For duration' },
  { value: 'date', label: 'Until date' },
];

export class AckModalUnthemed extends PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    canAck: true,
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
      unacknowledge: false,
      closeProblem: false,
      changeSeverity: false,
      selectedSeverity: props.severity || 0,
      suppress: false,
      unsuppress: false,
      suppressUntilMode: 'indefinite',
      suppressDuration: '1h',
      suppressDate: '',
      suppressInputError: '',
      rankAsCause: false,
      rankAsSymptom: false,
      causeEventid: '',
      loading: false,
    };
  }

  handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ value: event.target.value, error: false });
  };

  handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.which === KEYBOARD_ENTER_KEY || event.key === 'Enter') {
      // this.submit();
    } else if (event.which === KEYBOARD_ESCAPE_KEY || event.key === 'Escape') {
      this.dismiss();
    }
  };

  handleBackdropClick = () => {
    this.dismiss();
  };

  onAcknowledgeToggle = () => {
    this.setState({
      acknowledge: !this.state.acknowledge,
      unacknowledge: false,
      error: false,
    });
  };

  onUnacknowledgeToggle = () => {
    this.setState({
      unacknowledge: !this.state.unacknowledge,
      acknowledge: false,
      error: false,
    });
  };

  onChangeSeverityToggle = () => {
    this.setState({ changeSeverity: !this.state.changeSeverity, error: false });
  };

  onCloseProblemToggle = () => {
    this.setState({ closeProblem: !this.state.closeProblem, error: false });
  };

  onSuppressToggle = () => {
    this.setState({
      suppress: !this.state.suppress,
      unsuppress: false,
      error: false,
      suppressInputError: '',
    });
  };

  onUnsuppressToggle = () => {
    this.setState({
      unsuppress: !this.state.unsuppress,
      suppress: false,
      error: false,
    });
  };

  onSuppressUntilModeChange = (mode: SuppressUntilMode) => {
    this.setState({ suppressUntilMode: mode, error: false, suppressInputError: '' });
  };

  onSuppressDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const suppressDuration = event.target.value;
    this.setState({
      suppressDuration,
      error: false,
      suppressInputError: validateSuppressDuration(suppressDuration),
    });
  };

  onSuppressDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const suppressDate = event.target.value;
    this.setState({
      suppressDate,
      error: false,
      suppressInputError: validateSuppressDate(suppressDate),
    });
  };

  onRankAsCauseToggle = () => {
    this.setState({
      rankAsCause: !this.state.rankAsCause,
      rankAsSymptom: false,
      error: false,
    });
  };

  onRankAsSymptomToggle = () => {
    this.setState({
      rankAsSymptom: !this.state.rankAsSymptom,
      rankAsCause: false,
      error: false,
    });
  };

  onCauseEventChange = (option: SelectableValue<string>) => {
    this.setState({ causeEventid: option?.value || '', error: false });
  };

  onChangeSelectedSeverity = (v) => {
    this.setState({ selectedSeverity: v });
  };

  dismiss = () => {
    this.setState({ value: '', error: false, errorMessage: '', ackError: '', loading: false });
    this.props.onDismiss();
  };

  setError = (errorMessage: string) => {
    this.setState({ error: true, errorMessage });
  };

  getSuppressUntil = (): number | { error: string } => {
    const { suppressUntilMode, suppressDuration, suppressDate } = this.state;

    if (suppressUntilMode === 'indefinite') {
      return 0;
    }

    if (suppressUntilMode === 'duration') {
      const error = validateSuppressDuration(suppressDuration);
      if (error) {
        return { error };
      }
      return Math.floor(Date.now() / 1000) + rangeUtil.intervalToSeconds(suppressDuration.trim());
    }

    const error = validateSuppressDate(suppressDate);
    if (error) {
      return { error };
    }
    return moment(suppressDate.trim(), SUPPRESS_DATE_FORMAT, true).unix();
  };

  submit = () => {
    const {
      acknowledge,
      unacknowledge,
      changeSeverity,
      closeProblem,
      suppress,
      unsuppress,
      rankAsCause,
      rankAsSymptom,
    } = this.state;

    const actionSelected =
      acknowledge ||
      unacknowledge ||
      changeSeverity ||
      closeProblem ||
      suppress ||
      unsuppress ||
      rankAsCause ||
      rankAsSymptom;
    if (!this.state.value && !actionSelected) {
      return this.setError('Enter message text or select an action');
    }

    if (rankAsSymptom && !this.state.causeEventid.trim()) {
      return this.setError('Select the cause event to rank this problem as symptom');
    }

    const ackData: AckProblemData = {
      message: this.state.value,
    };

    // Always add a message: the panel prefixes it with the acting Grafana user
    // ("<user> (Grafana): ..."), so every action leaves a history entry recording
    // who performed it — otherwise Zabbix attributes it to the plugin's API user.
    let action = ZBX_ACK_ACTION_ADD_MESSAGE;
    if (acknowledge) {
      action += ZBX_ACK_ACTION_ACK;
    }
    if (unacknowledge) {
      action += ZBX_ACK_ACTION_UNACK;
    }
    if (changeSeverity) {
      action += ZBX_ACK_ACTION_CHANGE_SEVERITY;
      ackData.severity = this.state.selectedSeverity;
    }
    if (closeProblem) {
      action += ZBX_ACK_ACTION_CLOSE;
    }
    if (suppress) {
      const suppressUntil = this.getSuppressUntil();
      if (typeof suppressUntil !== 'number') {
        return this.setError(suppressUntil.error);
      }
      action += ZBX_ACK_ACTION_SUPPRESS;
      ackData.suppress_until = suppressUntil;
    }
    if (unsuppress) {
      action += ZBX_ACK_ACTION_UNSUPPRESS;
    }
    if (rankAsCause) {
      action += ZBX_ACK_ACTION_RANK_CAUSE;
    }
    if (rankAsSymptom) {
      action += ZBX_ACK_ACTION_RANK_SYMPTOM;
      ackData.cause_eventid = this.state.causeEventid.trim();
    }
    ackData.action = action;

    this.setState({ ackError: '', loading: true });

    this.props
      .onSubmit(ackData)
      .then(() => {
        this.dismiss();
      })
      .catch((err) => {
        const errorMessage = err.data?.message || err.data?.error || err.data || err.statusText || '';
        this.setState({
          ackError: errorMessage,
          loading: false,
        });
      });
  };

  renderSuppressUntil(styles: ReturnType<typeof getStyles>) {
    const { suppressUntilMode, suppressDuration, suppressDate, suppressInputError } = this.state;

    return (
      <div key="suppress-until" className="gf-form--grow">
        <RadioButtonGroup
          size="sm"
          options={suppressUntilOptions}
          value={suppressUntilMode}
          onChange={this.onSuppressUntilModeChange}
        />
        {suppressUntilMode === 'duration' && (
          <Input
            type="text"
            name="suppressDuration"
            placeholder="1h, 30m, 2d"
            aria-label="Suppress duration"
            invalid={!!suppressInputError}
            value={suppressDuration}
            onChange={this.onSuppressDurationChange}
          />
        )}
        {suppressUntilMode === 'date' && (
          <Input
            type="text"
            name="suppressDate"
            placeholder={SUPPRESS_DATE_FORMAT}
            aria-label="Suppress until date"
            invalid={!!suppressInputError}
            value={suppressDate}
            onChange={this.onSuppressDateChange}
          />
        )}
        {suppressInputError && <small className={styles.fieldError}>{suppressInputError}</small>}
      </div>
    );
  }

  renderActions(styles: ReturnType<typeof getStyles>) {
    const { canAck, canClose, canUnack, canSuppress, canUnsuppress, canRankAsCause, canRankAsSymptom, causeEvents } =
      this.props;

    const actions = [
      canAck && (
        <Checkbox key="ack" label="Acknowledge" value={this.state.acknowledge} onChange={this.onAcknowledgeToggle} />
      ),
      canUnack && (
        <Checkbox
          key="unack"
          label="Unacknowledge"
          value={this.state.unacknowledge}
          onChange={this.onUnacknowledgeToggle}
        />
      ),
      <Checkbox
        key="change-severity"
        label="Change severity"
        description=""
        value={this.state.changeSeverity}
        onChange={this.onChangeSeverityToggle}
      />,
      this.state.changeSeverity && (
        <RadioButtonGroup
          key="severity"
          size="sm"
          options={severityOptions}
          value={this.state.selectedSeverity}
          onChange={this.onChangeSelectedSeverity}
        />
      ),
      canSuppress && (
        <Checkbox key="suppress" label="Suppress" value={this.state.suppress} onChange={this.onSuppressToggle} />
      ),
      canSuppress && this.state.suppress && this.renderSuppressUntil(styles),
      canUnsuppress && (
        <Checkbox
          key="unsuppress"
          label="Unsuppress"
          value={this.state.unsuppress}
          onChange={this.onUnsuppressToggle}
        />
      ),
      canRankAsCause && (
        <Checkbox
          key="rank-cause"
          label="Rank as cause"
          value={this.state.rankAsCause}
          onChange={this.onRankAsCauseToggle}
        />
      ),
      canRankAsSymptom && (
        <Checkbox
          key="rank-symptom"
          label="Rank as symptom"
          value={this.state.rankAsSymptom}
          onChange={this.onRankAsSymptomToggle}
        />
      ),
      canRankAsSymptom && this.state.rankAsSymptom && (
        <div key="cause-event" className={styles.causeEventSelect}>
          <Select
            aria-label="Cause event"
            placeholder="Select cause event"
            options={causeEvents || []}
            value={(causeEvents || []).find((option) => option.value === this.state.causeEventid) || null}
            onChange={this.onCauseEventChange}
          />
        </div>
      ),
      canClose && (
        <Checkbox
          key="close"
          label="Close problem"
          disabled={!canClose}
          value={this.state.closeProblem}
          onChange={this.onCloseProblemToggle}
        />
      ),
    ];

    // <VerticalGroup /> doesn't handle empty elements properly, so don't return it
    return actions.filter((e) => e);
  }

  render() {
    const { theme } = this.props;
    const styles = getStyles(theme);

    return (
      <Modal
        isOpen={true}
        ariaLabel="Update problem"
        onDismiss={this.dismiss}
        className={styles.modal}
        title={
          <div className={styles.modalHeaderTitle}>
            {this.state.loading ? <Spinner size={18} /> : <FAIcon icon="reply-all" />}
            Update Problem
          </div>
        }
      >
        <div className={styles.inputGroup}>
          <TextArea
            className={this.state.error && styles.input}
            type="text"
            name="message"
            placeholder="Message"
            autoComplete="off"
            autoFocus={true}
            value={this.state.value}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyPress}
          />
          <small className={styles.inputHint}>Press Enter to submit</small>
          {this.state.error && <small className={styles.inputError}>{this.state.errorMessage}</small>}
        </div>

        <VerticalGroup>{this.renderActions(styles)}</VerticalGroup>

        {this.state.ackError && <span className={styles.ackError}>{this.state.ackError}</span>}

        <ButtonGroup className={styles.buttonGroup}>
          <Button variant="primary" onClick={this.submit}>
            Update
          </Button>

          <Button variant="secondary" onClick={this.dismiss}>
            Cancel
          </Button>
        </ButtonGroup>
      </Modal>
    );
  }
}

export function validateSuppressDuration(duration: string): string {
  try {
    rangeUtil.intervalToSeconds(duration.trim());
    return '';
  } catch (e) {
    return 'Invalid suppress duration. Use values like 30m, 1h or 2d.';
  }
}

export function validateSuppressDate(date: string): string {
  const parsed = moment(date.trim(), SUPPRESS_DATE_FORMAT, true);
  if (!parsed.isValid()) {
    return `Invalid date. Use format ${SUPPRESS_DATE_FORMAT}.`;
  }
  if (parsed.unix() <= Math.floor(Date.now() / 1000)) {
    return 'Suppress until date must be in the future.';
  }
  return '';
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const red = theme.palette.red;
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
      margin-bottom: 16px;
    `,
    input: css`
      border-color: ${red};
      border-radius: 2px;
      outline-offset: 2px;
      box-shadow:
        0 0 0 2px ${theme.colors.bg1},
        0 0 0px 4px ${red};
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
    fieldError: css`
      color: ${red};
    `,
    ackError: css`
      color: ${red};
    `,
    causeEventSelect: css`
      min-width: 20rem;
    `,
    buttonGroup: css`
      justify-content: center;
      gap: ${theme.spacing.sm};
      margin-top: ${theme.spacing.md};
    `,
  };
});

export const AckModal = withTheme(AckModalUnthemed);
