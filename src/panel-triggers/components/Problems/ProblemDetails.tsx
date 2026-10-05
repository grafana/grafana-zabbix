import React, { useEffect, useState } from 'react';
import { css, cx } from '@emotion/css';
import moment from 'moment/moment';
import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { getDataSourceSrv } from '@grafana/runtime';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXTag } from '../../../datasource/types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { AckModal, AckProblemData } from '../AckModal';
import { EventTag } from '../EventTag';
import AcknowledgesList from './AcknowledgesList';
import ProblemTimeline from './ProblemTimeline';
import { ModalController } from '../../../components';
import { openInExplore } from '../../../components/ExploreButton/ExploreButton';
import { ExecScriptData, ExecScriptModal } from '../ExecScriptModal';
import ProblemStatusBar from './ProblemStatusBar';
import { ProblemItems } from './ProblemItems';
import { ProblemHosts } from './ProblemHosts';
import { ProblemGroups } from './ProblemGroups';
import { getMetaRowStyles } from './detailsStyles';
import { em } from './Cells/cellStyles';

interface Props {
  original: ProblemDTO;
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
  const [events, setEvents] = useState<ZBXEvent[]>([]);
  const [alerts, setAlerts] = useState<ZBXAlert[]>([]);
  const [show, setShow] = useState(false);
  const styles = useStyles2(getStyles);
  const metaStyles = useStyles2(getMetaRowStyles);

  useEffect(() => {
    const fetchData = async () => {
      const problem = original;
      if (showTimeline) {
        const eventsData = await getProblemEvents(problem);
        setEvents(eventsData);
      }
      const alertsData = await getProblemAlerts(problem);
      setAlerts(alertsData);
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

  const problem = original as ProblemDTO;

  const ackProblem = (data: AckProblemData) => onProblemAck(problem, data);
  const getScriptsInternal = () => getScripts(problem);
  const onExecuteScriptInternal = ({ scriptid, scope }: ExecScriptData) => onExecuteScript(problem, scriptid, scope);

  const wideLayout = rootWidth > 1200;
  const age = moment.unix(problem.timestamp).fromNow(true);
  const showAcknowledges = problem.acknowledges && problem.acknowledges.length !== 0;
  const problemSeverity = Number(problem.severity);
  const hostDescriptions = (problem.hosts ?? []).map((h) => h.description).filter(Boolean);

  let dsName: string = original.datasource as string;
  if ((original.datasource as DataSourceRef)?.uid) {
    const dsInstance = getDataSourceSrv().getInstanceSettings((original.datasource as DataSourceRef).uid);
    dsName = dsInstance?.name ?? dsName;
  }

  const problemDescriptionEl = allowDangerousHTML ? (
    <span dangerouslySetInnerHTML={{ __html: problem.comments }} />
  ) : (
    <span>{problem.comments}</span>
  );

  const acknowledgesSection = showAcknowledges && (
    <section className={styles.section}>
      <h6 className={styles.sectionTitle}>
        <Icon name="comment-alt-message" size="sm" />
        Acknowledges
      </h6>
      <AcknowledgesList acknowledges={problem.acknowledges} />
    </section>
  );

  return (
    // The problem-details-container class scopes the timeline stylesheet. The block sticks to the
    // visible width of the (horizontally scrollable) table so nothing hides off to the right.
    <div
      className={cx('problem-details-container', styles.container, { [styles.visible]: show })}
      style={rootWidth > 0 ? { width: rootWidth } : undefined}
    >
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.header}>
            <div className={styles.actions}>
              <Button
                size="sm"
                variant="secondary"
                icon="compass"
                onClick={() => openInExplore(problem, panelId, timeRange)}
              >
                Explore
              </Button>
              {problem.showAckButton && (
                <>
                  <ModalController>
                    {({ showModal, hideModal }) => (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="brackets-curly"
                        onClick={() => {
                          showModal(ExecScriptModal, {
                            getScripts: getScriptsInternal,
                            onSubmit: onExecuteScriptInternal,
                            onDismiss: hideModal,
                          });
                        }}
                      >
                        Run script
                      </Button>
                    )}
                  </ModalController>
                  <ModalController>
                    {({ showModal, hideModal }) => (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="comment-alt-message"
                        onClick={() => {
                          showModal(AckModal, {
                            canClose: problem.manual_close === '1',
                            severity: problemSeverity,
                            onSubmit: ackProblem,
                            onDismiss: hideModal,
                          });
                        }}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </ModalController>
                </>
              )}
            </div>
            <ProblemStatusBar problem={problem} alerts={alerts} />
          </div>

          <dl className={styles.facts}>
            <dt>
              <Icon name="clock-nine" size="sm" />
              Age
            </dt>
            <dd>{age}</dd>
            {problem.items?.length > 0 && (
              <>
                <dt>
                  <Icon name="chart-line" size="sm" />
                  Items
                </dt>
                <dd>
                  <ProblemItems items={problem.items} />
                </dd>
              </>
            )}
            {problem.comments && (
              <>
                <dt>
                  <Icon name="file-alt" size="sm" />
                  Description
                </dt>
                <dd className={styles.description}>{problemDescriptionEl}</dd>
              </>
            )}
            {problem.expression && (
              <>
                <dt>
                  <Icon name="brackets-curly" size="sm" />
                  Expression
                </dt>
                <dd>
                  <code className={styles.code}>{problem.expression}</code>
                </dd>
              </>
            )}
            {hostDescriptions.length > 0 && (
              <>
                <dt>
                  <Icon name="monitor" size="sm" />
                  Host description
                </dt>
                <dd className={styles.description}>{hostDescriptions.join('\n')}</dd>
              </>
            )}
          </dl>

          {problem.tags?.length > 0 && (
            <div className={styles.tags}>
              {problem.tags.map((tag) => (
                <EventTag
                  key={tag.tag + tag.value}
                  variant="chip"
                  tag={tag}
                  datasource={problem.datasource}
                  highlight={tag.tag === problem.correlation_tag}
                  onClick={handleTagClick}
                />
              ))}
            </div>
          )}

          {showTimeline && events.length > 0 && <ProblemTimeline events={events} timeRange={timeRange} />}
          {!wideLayout && acknowledgesSection}
        </div>

        {wideLayout && showAcknowledges && <aside className={styles.acks}>{acknowledgesSection}</aside>}

        <aside className={styles.meta}>
          <div className={metaStyles.row} title={dsName}>
            <Icon name="database" size="sm" className={metaStyles.icon} />
            <span className={metaStyles.text}>{dsName}</span>
          </div>
          {problem.proxy && (
            <div className={metaStyles.row} title={problem.proxy}>
              <Icon name="cloud" size="sm" className={metaStyles.icon} />
              <span className={metaStyles.text}>{problem.proxy}</span>
            </div>
          )}
          {problem.groups && <ProblemGroups groups={problem.groups} />}
          {problem.hosts && <ProblemHosts hosts={problem.hosts} />}
        </aside>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'sticky',
    left: 0,
    boxSizing: 'border-box',
    maxWidth: '100%',
    padding: theme.spacing(2, 2, 2, 2.5),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontSize: em(theme, 12),
    lineHeight: 1.5,
    whiteSpace: 'normal',
    opacity: 0,
    transform: 'translateY(-4px)',
    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
  }),
  visible: css({
    opacity: 1,
    transform: 'none',
  }),
  layout: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
  }),
  main: css({
    flex: '1 1 480px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),
  actions: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),
  facts: css({
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.75),
    margin: 0,
    '& dt': {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
    },
    '& dd': {
      margin: 0,
      minWidth: 0,
      color: theme.colors.text.primary,
      overflowWrap: 'anywhere',
    },
  }),
  description: css({
    whiteSpace: 'pre-line',
    maxHeight: '8em',
    overflow: 'auto',
  }),
  code: css({
    display: 'inline-block',
    maxWidth: '100%',
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.weak}`,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: em(theme, 11),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
  tags: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  }),
  acks: css({
    flex: '1 1 320px',
    minWidth: 0,
  }),
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  sectionTitle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    margin: 0,
    fontSize: em(theme, 11),
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: theme.colors.text.secondary,
  }),
  meta: css({
    flex: '0 0 auto',
    minWidth: 180,
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
});
