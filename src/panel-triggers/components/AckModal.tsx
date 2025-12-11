import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import {
  ZBX_ACK_ACTION_ADD_MESSAGE,
  ZBX_ACK_ACTION_ACK,
  ZBX_ACK_ACTION_CHANGE_SEVERITY,
  ZBX_ACK_ACTION_CLOSE,
  ZBX_ACK_ACTION_UNACK,
  ZBX_ACK_ACTION_SUPPRESS,
  ZBX_ACK_ACTION_UNSUPPRESS,
} from '../../datasource/constants';
import {
  Button,
  Spinner,
  Modal,
  Checkbox,
  RadioButtonGroup,
  TextArea,
  ButtonGroup,
  DateTimePicker,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { FAIcon } from '../../components';
import { DateTime, GrafanaTheme2, dateTime } from '@grafana/data';

export interface AckProblemData {
  message?: string;
  closeProblem?: boolean;
  action?: number;
  severity?: number;
  suppress_until?: number;
}

interface AckModalProps {
  canAck?: boolean;
  canClose?: boolean;
  canSuppress?: boolean;
  severity?: number;
  onSubmit: (data?: AckProblemData) => Promise<any> | any;
  onDismiss?: () => void;
}

interface AckModalState {
  message: string;
  error: boolean;
  errorMessage: string;
  ackError: string;
  acknowledge: boolean;
  unacknowledge: boolean;
  closeProblem: boolean;
  changeSeverity: boolean;
  selectedSeverity: number;
  suppressEvent: boolean;
  unsuppressEvent: boolean;
  suppressUntil: DateTime | undefined;
  suppressIndefinitely: boolean;
  loading: boolean;
}

const SEVERITY_OPTIONS = [
  { value: 0, label: 'Not classified' },
  { value: 1, label: 'Information' },
  { value: 2, label: 'Warning' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Disaster' },
];

const getInitialState = (severity?: number): AckModalState => ({
  message: '',
  error: false,
  errorMessage: '',
  ackError: '',
  acknowledge: false,
  unacknowledge: false,
  closeProblem: false,
  changeSeverity: false,
  selectedSeverity: severity ?? 0,
  suppressEvent: false,
  unsuppressEvent: false,
  suppressUntil: undefined,
  suppressIndefinitely: true,
  loading: false,
});

export function AckModal(props: AckModalProps) {
  const { canClose = false, canSuppress = false, severity, onSubmit, onDismiss } = props;
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<AckModalState>(() => getInitialState(severity));

  const updateState = useCallback((updates: Partial<AckModalState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleDismiss = useCallback(() => {
    setState(getInitialState(severity));
    onDismiss?.();
  }, [onDismiss, severity]);

  const handleMessageChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateState({ message: event.target.value, error: false });
    },
    [updateState]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  const handleAcknowledgeToggle = useCallback(() => {
    updateState({
      acknowledge: !state.acknowledge,
      unacknowledge: false,
      error: false,
    });
  }, [state.acknowledge, updateState]);

  const handleUnacknowledgeToggle = useCallback(() => {
    updateState({
      unacknowledge: !state.unacknowledge,
      acknowledge: false,
      error: false,
    });
  }, [state.unacknowledge, updateState]);

  const handleChangeSeverityToggle = useCallback(() => {
    updateState({ changeSeverity: !state.changeSeverity, error: false });
  }, [state.changeSeverity, updateState]);

  const handleCloseProblemToggle = useCallback(() => {
    updateState({ closeProblem: !state.closeProblem, error: false });
  }, [state.closeProblem, updateState]);

  const handleSuppressEventToggle = useCallback(() => {
    updateState({
      suppressEvent: !state.suppressEvent,
      unsuppressEvent: false,
      error: false,
    });
  }, [state.suppressEvent, updateState]);

  const handleUnsuppressEventToggle = useCallback(() => {
    updateState({
      unsuppressEvent: !state.unsuppressEvent,
      suppressEvent: false,
      error: false,
    });
  }, [state.unsuppressEvent, updateState]);

  const handleSuppressIndefinitelyToggle = useCallback(() => {
    updateState({ suppressIndefinitely: !state.suppressIndefinitely });
  }, [state.suppressIndefinitely, updateState]);

  const handleSuppressUntilChange = useCallback(
    (date?: DateTime) => {
      updateState({ suppressUntil: date });
    },
    [updateState]
  );

  const handleSelectedSeverityChange = useCallback(
    (value: number) => {
      updateState({ selectedSeverity: value });
    },
    [updateState]
  );

  const handleSubmit = useCallback(() => {
    const {
      acknowledge,
      unacknowledge,
      changeSeverity,
      closeProblem,
      suppressEvent,
      unsuppressEvent,
      suppressIndefinitely,
      suppressUntil,
      message,
      selectedSeverity,
    } = state;

    const actionSelected =
      acknowledge || unacknowledge || changeSeverity || closeProblem || suppressEvent || unsuppressEvent;

    if ((!message || !message.trim()) && !actionSelected) {
      updateState({
        error: true,
        errorMessage: 'Enter message text or select an action',
      });
      return;
    }

    if (suppressEvent && !suppressIndefinitely && !suppressUntil) {
      updateState({
        error: true,
        errorMessage: 'Please select a suppress until date or choose indefinite suppression',
      });
      return;
    }

    updateState({ ackError: '', loading: true });

    const ackData: AckProblemData = {};

    let action = 0;
    if (message && message.trim() !== '') {
      action += ZBX_ACK_ACTION_ADD_MESSAGE;
      ackData.message = message;
    }
    if (acknowledge) {
      action += ZBX_ACK_ACTION_ACK;
    }
    if (unacknowledge) {
      action += ZBX_ACK_ACTION_UNACK;
    }
    if (changeSeverity) {
      action += ZBX_ACK_ACTION_CHANGE_SEVERITY;
      ackData.severity = selectedSeverity;
    }
    if (closeProblem) {
      action += ZBX_ACK_ACTION_CLOSE;
    }
    if (suppressEvent) {
      action += ZBX_ACK_ACTION_SUPPRESS;
      ackData.suppress_until = suppressIndefinitely ? 0 : Math.floor(suppressUntil!.valueOf() / 1000);
    }
    if (unsuppressEvent) {
      action += ZBX_ACK_ACTION_UNSUPPRESS;
    }
    ackData.action = action;

    Promise.resolve(onSubmit(ackData))
      .then(() => {
        handleDismiss();
      })
      .catch((err) => {
        const errorMessage = err.data?.message || err.data?.error || err.data || err.statusText || '';
        updateState({
          ackError: errorMessage,
          loading: false,
        });
      });
  }, [state, onSubmit, handleDismiss, updateState]);

  const renderActions = () => {
    const actions: React.ReactNode[] = [
      <Checkbox key="ack" label="Acknowledge" value={state.acknowledge} onChange={handleAcknowledgeToggle} />,
      <Checkbox key="unack" label="Unacknowledge" value={state.unacknowledge} onChange={handleUnacknowledgeToggle} />,
      <Checkbox
        key="change-severity"
        label="Change severity"
        value={state.changeSeverity}
        onChange={handleChangeSeverityToggle}
      />,
    ];

    if (state.changeSeverity) {
      actions.push(
        <RadioButtonGroup
          key="severity"
          size="sm"
          options={SEVERITY_OPTIONS}
          value={state.selectedSeverity}
          onChange={handleSelectedSeverityChange}
        />
      );
    }

    if (canClose) {
      actions.push(
        <Checkbox
          key="close"
          label="Close problem"
          disabled={!canClose}
          value={state.closeProblem}
          onChange={handleCloseProblemToggle}
        />
      );
    }

    if (canSuppress) {
      actions.push(
        <Checkbox
          key="suppress"
          label="Suppress event"
          value={state.suppressEvent}
          onChange={handleSuppressEventToggle}
        />
      );

      if (state.suppressEvent) {
        actions.push(
          <div key="suppress-options" className={styles.suppressOptions}>
            <Checkbox
              label="Indefinite suppression"
              value={state.suppressIndefinitely}
              onChange={handleSuppressIndefinitelyToggle}
            />
            {!state.suppressIndefinitely && (
              <Stack direction="row" alignItems="center" gap={1}>
                <span>Suppress until:</span>
                <DateTimePicker
                  date={state.suppressUntil}
                  onChange={handleSuppressUntilChange}
                  minDate={dateTime().toDate()}
                />
              </Stack>
            )}
          </div>
        );
      }

      actions.push(
        <Checkbox
          key="unsuppress"
          label="Unsuppress event"
          value={state.unsuppressEvent}
          onChange={handleUnsuppressEventToggle}
        />
      );
    }

    return actions;
  };

  return (
    <Modal
      isOpen={true}
      onDismiss={handleDismiss}
      className={styles.modal}
      title={
        <div className={styles.modalHeaderTitle}>
          {state.loading ? <Spinner size={18} /> : <FAIcon icon="reply-all" />}Acknowledge Problem
        </div>
      }
    >
      <div className={styles.inputGroup}>
        <TextArea
          className={state.error ? styles.inputError : undefined}
          name="message"
          placeholder="Message"
          autoComplete="off"
          autoFocus={true}
          value={state.message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
        />
        <small className={styles.inputHint}>Press Enter to submit</small>
        {state.error && <small className={styles.errorText}>{state.errorMessage}</small>}
      </div>

      <Stack direction="column" gap={1} alignItems="flex-start">
        {renderActions()}
      </Stack>

      {state.ackError && <span className={styles.ackError}>{state.ackError}</span>}

      <ButtonGroup className={styles.buttonGroup}>
        <Button variant="primary" onClick={handleSubmit}>
          Update
        </Button>
        <Button variant="secondary" onClick={handleDismiss}>
          Cancel
        </Button>
      </ButtonGroup>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '500px',
  }),
  modalHeaderTitle: css({
    fontSize: theme.typography.h3.fontSize,
    margin: `0 ${theme.spacing(2)}`,
    gap: theme.spacing(1),
    display: 'flex',
  }),
  inputGroup: css({
    marginBottom: theme.spacing(2),
  }),
  inputError: css({
    borderColor: theme.colors.error.main,
    borderRadius: '2px',
    outlineOffset: '2px',
    boxShadow: `0 0 0 2px ${theme.colors.background.primary}, 0 0 0px 4px ${theme.colors.error.main}`,
  }),
  inputHint: css({
    display: 'inherit',
    float: 'right',
    color: theme.colors.text.secondary,
  }),
  errorText: css({
    float: 'left',
    color: theme.colors.error.main,
  }),
  ackError: css({
    color: theme.colors.error.main,
  }),
  buttonGroup: css({
    justifyContent: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  }),
  suppressOptions: css({
    marginLeft: theme.spacing(3),
    padding: `${theme.spacing(1)} 0`,
  }),
});
