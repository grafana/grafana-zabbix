import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import moment from 'moment/moment';
import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXTag } from '../../../datasource/types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { AckModal, AckProblemData } from '../AckModal';
import { EventTag } from '../EventTag';
import AcknowledgesList from './AcknowledgesList';
import ProblemTimeline from './ProblemTimeline';
import { AckButton, ExecScriptButton, ExploreButton, FAIcon, ModalController } from '../../../components';
import { ExecScriptData, ExecScriptModal } from '../ExecScriptModal';
import { ProblemDescriptionModal } from '../ProblemDescriptionModal';
import ProblemStatusBar from './ProblemStatusBar';
import { ProblemItems } from './ProblemItems';
import { ProblemHosts, ProblemHostsDescription } from './ProblemHosts';
import { ProblemGroups } from './ProblemGroups';
import { ProblemExpression } from './ProblemExpression';
import { getAckModalActionProps } from '../../utils';

interface Props {
  original: ProblemDTO;
  datasourceName: string;
  rootWidth: number;
  timeRange: TimeRange;
  showTimeline?: boolean;
  panelId?: number;
  allowDangerousHTML?: boolean;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  getScripts: (problem: ProblemDTO) => Promise<ZBXScript[]>;
  onExecuteScript(problem: ProblemDTO, scriptid: string, scope: string): Promise<APIExecuteScriptResponse>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => Promise<any> | any;
  onTagClick?: (tag: ZBXTag, datasource: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

export const ProblemDetails = ({
  original,
  datasourceName,
  rootWidth,
  timeRange,
  showTimeline,
  panelId,
  allowDangerousHTML,
  getProblemAlerts,
  getProblemEvents,
  getScripts,
  onExecuteScript,
  onProblemAck,
  onTagClick,
}: Props) => {
  const [events, setEvents] = useState([]);
  const [alerts, setAletrs] = useState([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const problem = original;
      if (showTimeline) {
        const eventsData = await getProblemEvents(problem);
        setEvents(eventsData);
      }
      const alertsData = await getProblemAlerts(problem);
      setAletrs(alertsData);
    };

    fetchData();

    requestAnimationFrame(() => {
      setShow(true);
    });
  }, [original, showTimeline, getProblemEvents, getProblemAlerts]);

  const handleTagClick = (tag: ZBXTag, datasource: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (onTagClick) {
      onTagClick(tag, datasource, ctrlKey, shiftKey);
    }
  };

  const ackProblem = (data: AckProblemData) => {
    const problem = original as ProblemDTO;
    return onProblemAck(problem, data);
  };

  const getScriptsInternal = () => {
    const problem = original as ProblemDTO;
    return getScripts(problem);
  };

  const onExecuteScriptInternal = ({ scriptid, scope }: ExecScriptData) => {
    const problem = original as ProblemDTO;
    return onExecuteScript(problem, scriptid, scope);
  };

  const problem = original as ProblemDTO;
  const displayClass = show ? 'show' : '';
  const wideLayout = rootWidth > 1200;
  const compactStatusBar = rootWidth < 800 || (problem.acknowledges && wideLayout && rootWidth < 1400);
  const age = moment.unix(problem.timestamp).fromNow(true);
  const showAcknowledges = problem.acknowledges && problem.acknowledges.length !== 0;
  const problemSeverity = Number(problem.severity);
  const styles = useStyles2(getStyles);

  // Tooltip replaces its child's ref, so measure the description through its wrapper. The
  // description node can be re-created while the row expands, so read it fresh on every
  // measurement and ignore zero-size (detached or not yet laid out) readings.
  const [descriptionClipped, setDescriptionClipped] = useState(false);
  const descriptionObserver = useRef<ResizeObserver | null>(null);
  const descriptionWrapperRef = useCallback((wrapper: HTMLDivElement | null) => {
    descriptionObserver.current?.disconnect();
    descriptionObserver.current = null;
    if (!wrapper) {
      return;
    }
    const measure = () => {
      const el = wrapper.firstElementChild as HTMLElement | null;
      if (el && el.clientHeight > 0) {
        setDescriptionClipped(el.scrollHeight > el.clientHeight + 1);
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      descriptionObserver.current = new ResizeObserver(measure);
      descriptionObserver.current.observe(wrapper);
    }
  }, []);
  useEffect(() => () => descriptionObserver.current?.disconnect(), []);

  const problemDescriptionEl = allowDangerousHTML ? (
    <span dangerouslySetInnerHTML={{ __html: problem.comments }} />
  ) : (
    <span>{problem.comments}</span>
  );

  return (
    <div className={`problem-details-container ${displayClass}`}>
      <div className="problem-details-body">
        <div className={styles.problemDetails}>
          <div className="problem-details-head">
            <div className="problem-actions-left">
              <ExploreButton problem={problem} panelId={panelId} range={timeRange} />
            </div>
            {problem.showAckButton && (
              <div className="problem-actions">
                <ModalController>
                  {({ showModal, hideModal }) => (
                    <ExecScriptButton
                      className="problem-action-button"
                      onClick={() => {
                        showModal(ExecScriptModal, {
                          getScripts: getScriptsInternal,
                          onSubmit: onExecuteScriptInternal,
                          onDismiss: hideModal,
                        });
                      }}
                    />
                  )}
                </ModalController>
                <ModalController>
                  {({ showModal, hideModal }) => (
                    <AckButton
                      className="problem-action-button"
                      onClick={() => {
                        showModal(AckModal, {
                          ...getAckModalActionProps(problem),
                          severity: problemSeverity,
                          onSubmit: ackProblem,
                          onDismiss: hideModal,
                        });
                      }}
                    />
                  )}
                </ModalController>
              </div>
            )}
            <ProblemStatusBar problem={problem} alerts={alerts} className={compactStatusBar && 'compact'} />
          </div>
          <div className="problem-details-row">
            <div className="problem-value-container">
              <div className="problem-age">
                <FAIcon icon="clock-o" />
                <span>{age}</span>
              </div>
              {problem.items && <ProblemItems items={problem.items} />}
            </div>
          </div>
          {problem.comments && (
            <div className="problem-description-row">
              <ModalController>
                {({ showModal, hideModal }) => {
                  const openDescription = () =>
                    showModal(ProblemDescriptionModal, { problem, allowDangerousHTML, onDismiss: hideModal });
                  // Tooltip overrides its child's onKeyDown, so Enter/Space are handled on this
                  // wrapper, which receives the event bubbling up from the focused description.
                  const onKeyDown = (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDescription();
                    }
                  };
                  return (
                    <div onKeyDown={onKeyDown} ref={descriptionWrapperRef}>
                      <Tooltip content="Click to open the full description" placement="top">
                        <div
                          className={cx(styles.problemDescription, descriptionClipped && styles.descriptionClipped)}
                          role="button"
                          tabIndex={0}
                          aria-label="Open the full problem description"
                          onClick={openDescription}
                        >
                          <span className="description-label">Description:&nbsp;</span>
                          {problemDescriptionEl}
                        </div>
                      </Tooltip>
                    </div>
                  );
                }}
              </ModalController>
            </div>
          )}
          {problem.items && (
            <div>
              <ProblemExpression problem={problem} />
            </div>
          )}
          {problem.hosts && (
            <div>
              <ProblemHostsDescription hosts={problem.hosts} />
            </div>
          )}
          {problem.tags && problem.tags.length > 0 && (
            <div className="problem-tags">
              {problem.tags &&
                problem.tags.map((tag) => (
                  <EventTag
                    key={tag.tag + tag.value}
                    tag={tag}
                    datasource={problem.datasource}
                    highlight={tag.tag === problem.correlation_tag}
                    onClick={handleTagClick}
                  />
                ))}
            </div>
          )}
          {showTimeline && events.length > 0 && <ProblemTimeline events={events} timeRange={timeRange} />}
          {showAcknowledges && !wideLayout && (
            <div className="problem-ack-container">
              <h6>
                <FAIcon icon="reply-all" /> Acknowledges
              </h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          )}
        </div>
        {showAcknowledges && wideLayout && (
          <div className="problem-details-middle">
            <div className="problem-ack-container">
              <h6>
                <FAIcon icon="reply-all" /> Acknowledges
              </h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          </div>
        )}
        <div className="problem-details-right">
          <div className="problem-details-right-item">
            <FAIcon icon="database" />
            <span>{datasourceName}</span>
          </div>
          {problem.proxy && (
            <div className="problem-details-right-item">
              <FAIcon icon="cloud" />
              <span>{problem.proxy}</span>
            </div>
          )}
          {problem.groups && <ProblemGroups groups={problem.groups} />}
          {problem.hosts && <ProblemHosts hosts={problem.hosts} />}
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  problemDetails: css`
    position: relative;
    overflow: auto;
    flex: 1 0 550px;
    // padding: 0.5rem 1rem 0.5rem 1.2rem;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)} ${theme.spacing(0.5)} ${theme.spacing(1.2)};
    display: flex;
    flex-direction: column;
    // white-space: pre-line;
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  problemDescription: css`
    position: relative;
    max-height: 6rem;
    min-height: 3rem;
    overflow: hidden;
    /* The table cell sets nowrap; the preview must wrap inside the details pane. */
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};

    &:hover,
    &:focus-visible {
      background: ${theme.colors.action.hover};
    }
  `,
  // Fade the last visible line out when the text is cut off, hinting there is more.
  descriptionClipped: css`
    mask-image: linear-gradient(to bottom, #000 calc(100% - 1.5rem), transparent);
  `,
});
