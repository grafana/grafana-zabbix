import React, { PureComponent } from 'react';
import moment from 'moment';
import * as utils from '../../datasource-zabbix/utils';
import { Trigger, ZBXItem, ZBXAcknowledge, ZBXHost, ZBXGroup, ZBXEvent, GFTimeRange, RTRow, ZBXTag } from '../types';
import { Modal, AckProblemData } from './Modal';
import EventTag from './EventTag';
import Tooltip from './Tooltip/Tooltip';
import ProblemTimeline from './ProblemTimeline';
import FAIcon from './FAIcon';

interface ProblemDetailsProps extends RTRow<Trigger> {
  rootWidth: number;
  timeRange: GFTimeRange;
  getProblemEvents: (problem: Trigger) => Promise<ZBXEvent[]>;
  onProblemAck?: (problem: Trigger, data: AckProblemData) => Promise<any> | any;
  onTagClick?: (tag: ZBXTag, datasource: string) => void;
}

interface ProblemDetailsState {
  events: ZBXEvent[];
  show: boolean;
  showAckDialog: boolean;
}

export default class ProblemDetails extends PureComponent<ProblemDetailsProps, ProblemDetailsState> {
  constructor(props) {
    super(props);
    this.state = {
      events: [],
      show: false,
      showAckDialog: false,
    };
  }

  componentDidMount() {
    this.fetchProblemEvents();
    requestAnimationFrame(() => {
      this.setState({ show: true });
    });
  }

  handleTagClick = (tag: ZBXTag) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource);
    }
  }

  fetchProblemEvents() {
    const problem = this.props.original;
    this.props.getProblemEvents(problem)
    .then(events => {
      console.log(events, this.props.timeRange);
      this.setState({ events });
    });
  }

  ackProblem = (data: AckProblemData) => {
    const problem = this.props.original as Trigger;
    console.log('acknowledge: ', problem.lastEvent && problem.lastEvent.eventid, data);
    return this.props.onProblemAck(problem, data).then(result => {
      this.closeAckDialog();
    }).catch(err => {
      console.log(err);
      this.closeAckDialog();
    });
  }

  showAckDialog = () => {
    this.setState({ showAckDialog: true });
  }

  closeAckDialog = () => {
    this.setState({ showAckDialog: false });
  }

  render() {
    const problem = this.props.original as Trigger;
    const rootWidth = this.props.rootWidth;
    const displayClass = this.state.show ? 'show' : '';
    const wideLayout = rootWidth > 1200;
    const compactStatusBar = rootWidth < 800 || problem.acknowledges && wideLayout && rootWidth < 1400;
    const age = moment.unix(problem.lastchangeUnix).fromNow(true);

    return (
      <div className={`problem-details-container ${displayClass}`}>
        <div className="problem-details">
          <div className="problem-details-row">
            <div className="problem-value-container">
              <div className="problem-age">
                <FAIcon icon="clock-o" />
                <span>{age}</span>
              </div>
              {problem.items && <ProblemItems items={problem.items} />}
            </div>
            <ProblemStatusBar problem={problem} className={compactStatusBar && 'compact'} />
            <div className="problem-actions">
              <ProblemActionButton className="navbar-button navbar-button--settings"
                icon="reply-all"
                tooltip="Acknowledge problem"
                onClick={this.showAckDialog} />
            </div>
          </div>
          {problem.comments &&
            <div className="problem-description">
              <span className="description-label">Description:&nbsp;</span>
              <span>{problem.comments}</span>
            </div>
          }
          {problem.tags && problem.tags.length > 0 &&
            <div className="problem-tags">
              {problem.tags && problem.tags.map(tag =>
                <EventTag
                  key={tag.tag + tag.value}
                  tag={tag}
                  highlight={tag.tag === problem.correlation_tag}
                  onClick={this.handleTagClick}
                />)
              }
            </div>
          }
          {this.state.events.length > 0 &&
            <ProblemTimeline events={this.state.events} timeRange={this.props.timeRange} />
          }
          {problem.acknowledges && !wideLayout &&
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          }
        </div>
        {problem.acknowledges && wideLayout &&
          <div className="problem-details-middle">
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          </div>
        }
        <div className="problem-details-right">
          <div className="problem-details-right-item">
            <FAIcon icon="database" />
            <span>{problem.datasource}</span>
          </div>
          {problem.proxy &&
            <div className="problem-details-right-item">
              <FAIcon icon="cloud" />
              <span>{problem.proxy}</span>
            </div>
          }
          {problem.groups && <ProblemGroups groups={problem.groups} className="problem-details-right-item" />}
          {problem.hosts && <ProblemHosts hosts={problem.hosts} className="problem-details-right-item" />}
        </div>
        <Modal withBackdrop={true}
          isOpen={this.state.showAckDialog}
          onSubmit={this.ackProblem}
          onClose={this.closeAckDialog} />
      </div>
    );
  }
}

interface ProblemItemProps {
  item: ZBXItem;
  showName?: boolean;
}

function ProblemItem(props: ProblemItemProps) {
  const { item, showName } = props;
  const itemName = utils.expandItemName(item.name, item.key_);
  return (
    <Tooltip placement="bottom" content={itemName}>
      <div className="problem-item">
        <FAIcon icon="thermometer-three-quarters" />
        {showName && <span className="problem-item-name">{item.name}: </span>}
        <span className="problem-item-value">{item.lastvalue}</span>
      </div>
    </Tooltip>
  );
}

interface ProblemItemsProps {
  items: ZBXItem[];
}

class ProblemItems extends PureComponent<ProblemItemsProps> {
  render() {
    const { items } = this.props;
    return (items.length > 1 ?
      items.map(item => <ProblemItem item={item} key={item.itemid} showName={true} />) :
      <ProblemItem item={items[0]} />
    );
  }
}

interface AcknowledgesListProps {
  acknowledges: ZBXAcknowledge[];
}

function AcknowledgesList(props: AcknowledgesListProps) {
  const { acknowledges } = props;
  return (
    <div className="problem-ack-list">
      <div className="problem-ack-col problem-ack-time">
        {acknowledges.map(ack => <span key={ack.acknowledgeid} className="problem-ack-time">{ack.time}</span>)}
      </div>
      <div className="problem-ack-col problem-ack-user">
        {acknowledges.map(ack => <span key={ack.acknowledgeid} className="problem-ack-user">{ack.user}</span>)}
      </div>
      <div className="problem-ack-col problem-ack-message">
        {acknowledges.map(ack => <span key={ack.acknowledgeid} className="problem-ack-message">{ack.message}</span>)}
      </div>
    </div>
  );
}

interface ProblemGroupsProps {
  groups: ZBXGroup[];
  className?: string;
}

class ProblemGroups extends PureComponent<ProblemGroupsProps> {
  render() {
    return this.props.groups.map(g => (
      <div className={this.props.className || ''} key={g.groupid}>
        <FAIcon icon="folder" />
        <span>{g.name}</span>
      </div>
    ));
  }
}

interface ProblemHostsProps {
  hosts: ZBXHost[];
  className?: string;
}

class ProblemHosts extends PureComponent<ProblemHostsProps> {
  render() {
    return this.props.hosts.map(h => (
      <div className={this.props.className || ''} key={h.hostid}>
        <FAIcon icon="server" />
        <span>{h.name}</span>
      </div>
    ));
  }
}

interface ProblemStatusBarProps {
  problem: Trigger;
  className?: string;
}

function ProblemStatusBar(props: ProblemStatusBarProps) {
  const { problem, className } = props;
  const multiEvent = problem.type === '1';
  const link = problem.url && problem.url !== '';
  const maintenance = problem.maintenance;
  const manualClose = problem.manual_close === '1';
  const error = problem.error && problem.error !== '';
  const stateUnknown = problem.state === '1';
  const closeByTag = problem.correlation_mode === '1';
  const actions = problem.alerts && problem.alerts.length !== 0;
  const actionMessage = problem.alerts ? problem.alerts[0].message : '';

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

interface ProblemActionButtonProps {
  icon: string;
  tooltip?: string;
  className?: string;
  onClick?: (event?) => void;
}

class ProblemActionButton extends PureComponent<ProblemActionButtonProps> {
  handleClick = (event) => {
    this.props.onClick(event);
  }

  render() {
    const { icon, tooltip, className } = this.props;
    let button = (
      <button className={`btn problem-action-button ${className || ''}`} onClick={this.handleClick}>
        <FAIcon icon={icon} />
      </button>
    );
    if (tooltip) {
      button = (
        <Tooltip placement="bottom" content={tooltip}>
          {button}
        </Tooltip>
      );
    }
    return button;
  }
}
