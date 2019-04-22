import React from 'react';
import FAIcon from '../FAIcon';
import Tooltip from '../Tooltip/Tooltip';
import { ZBXTrigger, ZBXAlert } from '../../types';

export interface ProblemStatusBarProps {
  problem: ZBXTrigger;
  alerts?: ZBXAlert[];
  className?: string;
}

export default function ProblemStatusBar(props: ProblemStatusBarProps) {
  const { problem, alerts, className } = props;
  const multiEvent = problem.type === '1';
  const link = problem.url && problem.url !== '';
  const maintenance = problem.maintenance;
  const manualClose = problem.manual_close === '1';
  const error = problem.error && problem.error !== '';
  const stateUnknown = problem.state === '1';
  const closeByTag = problem.correlation_mode === '1';
  const actions = alerts && alerts.length !== 0;
  const actionMessage = actions ? alerts[0].message : '';

  return (
    <div className={`problem-statusbar ${className || ''}`}>
      <ProblemStatusBarItem icon="wrench" fired={maintenance} tooltip="Host maintenance" />
      <ProblemStatusBarItem icon="globe" fired={link} link={link && problem.url} tooltip="External link" />
      <ProblemStatusBarItem icon="bullhorn" fired={multiEvent} tooltip="Trigger generates multiple problem events" />
      <ProblemStatusBarItem icon="tag" fired={closeByTag} tooltip={`OK event closes problems matched to tag: ${problem.correlation_tag}`} />
      <ProblemStatusBarItem icon="circle-o-notch" fired={actions} tooltip={actionMessage} />
      <ProblemStatusBarItem icon="question-circle" fired={stateUnknown} tooltip="Current trigger state is unknown" />
      <ProblemStatusBarItem icon="warning" fired={error} tooltip={problem.error} />
      <ProblemStatusBarItem icon="window-close-o" fired={manualClose} tooltip="Manual close problem" />
    </div>
  );
}

interface ProblemStatusBarItemProps {
  icon: string;
  fired?: boolean;
  link?: string;
  tooltip?: string;
}

function ProblemStatusBarItem(props: ProblemStatusBarItemProps) {
  const { fired, icon, link, tooltip } = props;
  let item = (
    <div className={`problem-statusbar-item ${fired ? 'fired' : 'muted'}`}>
      <FAIcon icon={icon} />
    </div>
  );
  if (tooltip && fired) {
    item = (
      <Tooltip placement="bottom" content={tooltip}>
        {item}
      </Tooltip>
    );
  }
  return link ? <a href={link} target="_blank">{item}</a> : item;
}
