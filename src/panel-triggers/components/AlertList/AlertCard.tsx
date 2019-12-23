import React, { PureComponent, CSSProperties } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import { isNewProblem, formatLastChange } from '../../utils';
import { ProblemsPanelOptions, ZBXTrigger, ZBXTag } from '../../types';
import { AckProblemData, Modal } from '.././Modal';
import EventTag from '../EventTag';
import Tooltip from '.././Tooltip/Tooltip';
import AlertAcknowledges from './AlertAcknowledges';
import AlertIcon from './AlertIcon';

interface AlertCardProps {
  problem: ZBXTrigger;
  panelOptions: ProblemsPanelOptions;
  onTagClick?: (tag: ZBXTag, datasource: string) => void;
  onProblemAck?: (problem: ZBXTrigger, data: AckProblemData) => Promise<any> | any;
}

interface AlertCardState {
  showAckDialog: boolean;
}

export default class AlertCard extends PureComponent<AlertCardProps, AlertCardState> {
  constructor(props) {
    super(props);
    this.state = { showAckDialog: false };
  }

  handleTagClick = (tag: ZBXTag) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.problem.datasource);
    }
  }

  ackProblem = (data: AckProblemData) => {
    const problem = this.props.problem;
    return this.props.onProblemAck(problem, data).then(result => {
      this.closeAckDialog();
    }).catch(err => {
      console.log(err);
      this.closeAckDialog();
    });
  }

  showAckDialog = () => {
    const problem = this.props.problem;
    if (problem.showAckButton) {
      this.setState({ showAckDialog: true });
    }
  }

  closeAckDialog = () => {
    this.setState({ showAckDialog: false });
  }

  render() {
    const { problem, panelOptions } = this.props;
    const showDatasourceName = panelOptions.targets && panelOptions.targets.length > 1;
    const cardClass = classNames('alert-rule-item', 'zbx-trigger-card', { 'zbx-trigger-highlighted': panelOptions.highlightBackground });
    const descriptionClass = classNames('alert-rule-item__text', { 'zbx-description--newline': panelOptions.descriptionAtNewLine });
    const severityDesc = _.find(panelOptions.triggerSeverity, s => s.priority === Number(problem.priority));
    const lastchange = formatLastChange(problem.lastchangeUnix, panelOptions.customLastChangeFormat && panelOptions.lastChangeFormat);
    const age = moment.unix(problem.lastchangeUnix).fromNow(true);

    let newProblem = false;
    if (panelOptions.highlightNewerThan) {
      newProblem = isNewProblem(problem, panelOptions.highlightNewerThan);
    }
    const blink = panelOptions.highlightNewEvents && newProblem;

    let problemColor: string;
    if (problem.value === '0') {
      problemColor = panelOptions.okEventColor;
    } else if (panelOptions.markAckEvents && problem.acknowledges && problem.acknowledges.length) {
      problemColor = panelOptions.ackEventColor;
    } else {
      problemColor = severityDesc.color;
    }

    const cardStyle: CSSProperties = {};
    if (panelOptions.highlightBackground) {
      cardStyle.backgroundColor = problemColor;
    }

    return (
      <li className={cardClass} style={cardStyle}>
        <AlertIcon problem={problem} color={problemColor} highlightBackground={panelOptions.highlightBackground} blink={blink} />

        <div className="alert-rule-item__body">
          <div className="alert-rule-item__header">
            <div className="alert-rule-item__name">
              <span className="zabbix-trigger-name">{problem.description}</span>
              {(panelOptions.hostField || panelOptions.hostTechNameField) && (
                <AlertHost problem={problem} panelOptions={panelOptions} />
              )}
              {panelOptions.hostGroups && <AlertGroup problem={problem} panelOptions={panelOptions} />}

              {panelOptions.showTags && (
                <span className="zbx-trigger-tags">
                  {problem.tags && problem.tags.map(tag =>
                    <EventTag
                      key={tag.tag + tag.value}
                      tag={tag}
                      highlight={tag.tag === problem.correlation_tag}
                      onClick={this.handleTagClick}
                    />
                  )}
                </span>
              )}
            </div>

            <div className={descriptionClass}>
              {panelOptions.statusField && <AlertStatus problem={problem} blink={blink} />}
              {panelOptions.severityField && (
                <AlertSeverity severityDesc={severityDesc} blink={blink} highlightBackground={panelOptions.highlightBackground} />
              )}
              <span className="alert-rule-item__time">
                {panelOptions.ageField && "for " + age}
              </span>
              {panelOptions.descriptionField && !panelOptions.descriptionAtNewLine && (
                <span className="zbx-description" dangerouslySetInnerHTML={{ __html: problem.comments }} />
              )}
            </div>

            {panelOptions.descriptionField && panelOptions.descriptionAtNewLine && (
              <div className="alert-rule-item__text zbx-description--newline" >
                <span
                  className="alert-rule-item__info zbx-description"
                  dangerouslySetInnerHTML={{ __html: problem.comments }}
                />
              </div>
            )}

          </div>
        </div>

        {showDatasourceName && (
          <div className="alert-rule-item__time zabbix-trigger-source">
            <span>
              <i className="fa fa-database"></i>
              {problem.datasource}
            </span>
          </div>
        )}

        <div className="alert-rule-item__time zbx-trigger-lastchange">
          <span>{lastchange || "last change unknown"}</span>
          <div className="trigger-info-block zbx-status-icons">
            {problem.url && <a href={problem.url} target="_blank"><i className="fa fa-external-link"></i></a>}
            {problem.state === '1' && (
              <Tooltip placement="bottom" content={problem.error}>
                <span><i className="fa fa-question-circle"></i></span>
              </Tooltip>
            )}
            {problem.lastEvent && (
              <AlertAcknowledgesButton problem={problem} onClick={this.showAckDialog} />
            )}
          </div>
        </div>
        <Modal withBackdrop={true}
          isOpen={this.state.showAckDialog}
          onSubmit={this.ackProblem}
          onClose={this.closeAckDialog} />
      </li>
    );
  }
}

interface AlertHostProps {
  problem: ZBXTrigger;
  panelOptions: ProblemsPanelOptions;
}

function AlertHost(props: AlertHostProps) {
  const problem = props.problem;
  const panel = props.panelOptions;
  let host = "";
  if (panel.hostField && panel.hostTechNameField) {
    host = `${problem.host} (${problem.hostTechName})`;
  } else if (panel.hostField || panel.hostTechNameField) {
    host = panel.hostField ? problem.host : problem.hostTechName;
  }
  if (panel.hostProxy && problem.proxy) {
    host = `${problem.proxy}: ${host}`;
  }

  return (
    <span className="zabbix-hostname">
      {problem.maintenance && <i className="fa fa-wrench zbx-maintenance-icon"></i>}
      {host}
    </span>
  );
}

interface AlertGroupProps {
  problem: ZBXTrigger;
  panelOptions: ProblemsPanelOptions;
}

function AlertGroup(props: AlertGroupProps) {
  const problem = props.problem;
  const panel = props.panelOptions;
  let groupNames = "";
  if (panel.hostGroups) {
    const groups = _.map(problem.groups, 'name').join(', ');
    groupNames += `[ ${groups} ]`;
  }

  return (
    <span className="zabbix-hostname">{groupNames}</span>
  );
}

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';

function AlertStatus(props) {
  const { problem, okColor, problemColor, blink } = props;
  const status = problem.value === '0' ? 'RESOLVED' : 'PROBLEM';
  const color = problem.value === '0' ? okColor || DEFAULT_OK_COLOR : problemColor || DEFAULT_PROBLEM_COLOR;
  const className = classNames(
    'zbx-trigger-state',
    { 'alert-state-critical': problem.value === '1' },
    { 'alert-state-ok': problem.value === '0' },
    { 'zabbix-trigger--blinked': blink }
  );
  return (
    <span className={className}>
      {status}
    </span>
  );
}

function AlertSeverity(props) {
  const { severityDesc, highlightBackground, blink } = props;
  const className = classNames('zbx-trigger-severity', { 'zabbix-trigger--blinked': blink });
  const style: CSSProperties = {};
  if (!highlightBackground) {
    style.color = severityDesc.color;
  }
  return (
    <span className={className} style={style}>
      {severityDesc.severity}
    </span>
  );
}

interface AlertAcknowledgesButtonProps {
  problem: ZBXTrigger;
  onClick: (event?) => void;
}

class AlertAcknowledgesButton extends PureComponent<AlertAcknowledgesButtonProps> {
  handleClick = (event) => {
    this.props.onClick(event);
  }

  renderTooltipContent = () => {
    return <AlertAcknowledges problem={this.props.problem} onClick={this.handleClick} />;
  }

  render() {
    const { problem } = this.props;
    let content = null;
    if (problem.acknowledges && problem.acknowledges.length) {
      content = (
        <Tooltip placement="bottom" popperClassName="ack-tooltip" content={this.renderTooltipContent}>
          <span><i className="fa fa-comments"></i></span>
        </Tooltip>
      );
    } else if (problem.showAckButton) {
      content = (
        <Tooltip placement="bottom" content="Acknowledge problem">
          <span role="button" onClick={this.handleClick}><i className="fa fa-comments-o"></i></span>
        </Tooltip>
      );
    }
    return content;
  }
}
