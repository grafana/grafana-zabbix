import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
// eslint-disable-next-line
import moment from 'moment';
import { TimeRange, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { getDataSourceSrv } from '@grafana/runtime';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXTag } from '../../../datasource/types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { AckModal, AckProblemData } from '../AckModal';
import { EventTag } from '../EventTag';
import AcknowledgesList from './AcknowledgesList';
import ProblemTimeline from './ProblemTimeline';
import { AckButton, ExecScriptButton, ExploreButton, FAIcon, ModalController } from '../../../components';
import { ExecScriptData, ExecScriptModal } from '../ExecScriptModal';
import ProblemStatusBar from './ProblemStatusBar';
import { RTRow } from '../../types';
import { ProblemItems } from './ProblemItems';
import { ProblemHosts, ProblemHostsDescription } from './ProblemHosts';
import { ProblemGroups } from './ProblemGroups';
import { ProblemExpression } from './ProblemExpression';

interface Props extends RTRow<ProblemDTO> {
  rootWidth: number;
  timeRange: TimeRange;
  showTimeline?: boolean;
  panelId?: number;
  allowDangerousHTML?: boolean;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  getScripts: (problem: ProblemDTO) => Promise<ZBXScript[]>;
  onExecuteScript(problem: ProblemDTO, scriptid: string): Promise<APIExecuteScriptResponse>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => Promise<any> | any;
  onTagClick?: (tag: ZBXTag, datasource: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

export const ProblemDetails = ({
  original,
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
    if (showTimeline) {
      fetchProblemEvents();
    }
    fetchProblemAlerts();
    requestAnimationFrame(() => {
      setShow(true);
    });
  }, []);

  const fetchProblemEvents = async () => {
    const problem = original;
    const events = await getProblemEvents(problem);
    setEvents(events);
  };

  const fetchProblemAlerts = async () => {
    const problem = original;
    const alerts = await getProblemAlerts(problem);
    setAletrs(alerts);
  };

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

  const onExecuteScriptInternal = (data: ExecScriptData) => {
    const problem = original as ProblemDTO;
    return onExecuteScript(problem, data.scriptid);
  };

  const problem = original as ProblemDTO;
  const displayClass = show ? 'show' : '';
  const wideLayout = rootWidth > 1200;
  const compactStatusBar = rootWidth < 800 || (problem.acknowledges && wideLayout && rootWidth < 1400);
  const age = moment.unix(problem.timestamp).fromNow(true);
  const showAcknowledges = problem.acknowledges && problem.acknowledges.length !== 0;
  const problemSeverity = Number(problem.severity);
  const styles = useStyles2(getStyles);

  let dsName: string = original.datasource as string;
  if ((original.datasource as DataSourceRef)?.uid) {
    const dsInstance = getDataSourceSrv().getInstanceSettings((original.datasource as DataSourceRef).uid);
    dsName = dsInstance.name;
  }

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
                          canClose: problem.manual_close === '1',
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
              <div className={styles.problemDescription}>
                <Tooltip placement="right" content={problemDescriptionEl}>
                  <span className="description-label">Description:&nbsp;</span>
                </Tooltip>
                {problemDescriptionEl}
              </div>
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
            <span>{dsName}</span>
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
    flex: 10 1 auto;
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

    &:after {
      content: '';
      text-align: right;
      position: inherit;
      bottom: 0;
      right: 0;
      width: 70%;
      height: 1.5rem;
      background: linear-gradient(to right, rgba(0, 0, 0, 0), ${theme.colors.background.canvas} 50%);
    }
  `,
});
