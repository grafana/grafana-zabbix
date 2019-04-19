import React, { PureComponent } from 'react';
import ReactTable from 'react-table';
import classNames from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import * as utils from '../../../datasource-zabbix/utils';
import { isNewProblem } from '../../utils';
import { ProblemsPanelOptions, ZBXTrigger, ZBXEvent, GFTimeRange, RTCell, ZBXTag, TriggerSeverity, RTResized, ZBXAlert } from '../../types';
import EventTag from '../EventTag';
import ProblemDetails from './ProblemDetails';
import { AckProblemData } from '../Modal';
import GFHeartIcon from '../GFHeartIcon';

export interface ProblemListProps {
  problems: ZBXTrigger[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: GFTimeRange;
  pageSize?: number;
  fontSize?: number;
  getProblemEvents: (problem: ZBXTrigger) => ZBXEvent[];
  getProblemAlerts: (problem: ZBXTrigger) => ZBXAlert[];
  onProblemAck?: (problem: ZBXTrigger, data: AckProblemData) => void;
  onTagClick?: (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
  onPageSizeChange?: (pageSize: number, pageIndex: number) => void;
  onColumnResize?: (newResized: RTResized) => void;
}

interface ProblemListState {
  expanded: any;
  page: number;
}

export default class ProblemList extends PureComponent<ProblemListProps, ProblemListState> {
  rootWidth: number;
  rootRef: any;

  constructor(props) {
    super(props);
    this.state = {
      expanded: {},
      page: 0,
    };
  }

  setRootRef = ref => {
    this.rootRef = ref;
  }

  handleProblemAck = (problem: ZBXTrigger, data: AckProblemData) => {
    return this.props.onProblemAck(problem, data);
  }

  handlePageSizeChange = (pageSize, pageIndex) => {
    if (this.props.onPageSizeChange) {
      this.props.onPageSizeChange(pageSize, pageIndex);
    }
  }

  handleResizedChange = (newResized, event) => {
    if (this.props.onColumnResize) {
      this.props.onColumnResize(newResized);
    }
  }

  handleExpandedChange = expanded => {
    const nextExpanded = { ...this.state.expanded };
    nextExpanded[this.state.page] = expanded;
    this.setState({
      expanded: nextExpanded
    });
  }

  handleTagClick = (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, datasource, ctrlKey, shiftKey);
    }
  }

  getExpandedPage = (page: number) => {
    return this.state.expanded[page] || {};
  }

  buildColumns() {
    const result = [];
    const options = this.props.panelOptions;
    const highlightNewerThan = options.highlightNewEvents && options.highlightNewerThan;
    const statusCell = props => StatusCell(props, options.okEventColor, DEFAULT_PROBLEM_COLOR, highlightNewerThan);
    const statusIconCell = props => StatusIconCell(props, highlightNewerThan);

    const columns = [
      { Header: 'Host', accessor: 'host', show: options.hostField },
      { Header: 'Host (Technical Name)', accessor: 'hostTechName', show: options.hostTechNameField },
      { Header: 'Host Groups', accessor: 'groups', show: options.hostGroups, Cell: GroupCell },
      { Header: 'Proxy', accessor: 'proxy', show: options.hostProxy },
      {
        Header: 'Severity', show: options.severityField, className: 'problem-severity', width: 120,
        accessor: problem => problem.priority,
        id: 'severity',
        Cell: props => SeverityCell(props, options.triggerSeverity, options.markAckEvents, options.ackEventColor),
      },
      {
        Header: '', id: 'statusIcon', show: options.statusIcon, className: 'problem-status-icon', width: 50,
        accessor: 'value',
        Cell: statusIconCell,
      },
      { Header: 'Status', accessor: 'value', show: options.statusField, width: 100, Cell: statusCell },
      { Header: 'Problem', accessor: 'description', minWidth: 200, Cell: ProblemCell},
      {
        Header: 'Tags', accessor: 'tags', show: options.showTags, className: 'problem-tags',
        Cell: props => <TagCell {...props} onTagClick={this.handleTagClick} />
      },
      {
        Header: 'Age', className: 'problem-age', width: 100, show: options.ageField, accessor: 'lastchangeUnix',
        id: 'age',
        Cell: AgeCell,
      },
      {
        Header: 'Time', className: 'last-change', width: 150, accessor: 'lastchangeUnix',
        id: 'lastchange',
        Cell: props => LastChangeCell(props, options.customLastChangeFormat && options.lastChangeFormat),
      },
      { Header: '', className: 'custom-expander', width: 60, expander: true, Expander: CustomExpander },
    ];
    for (const column of columns) {
      if (column.show || column.show === undefined) {
        delete column.show;
        result.push(column);
      }
    }
    return result;
  }

  render() {
    const columns = this.buildColumns();
    this.rootWidth = this.rootRef && this.rootRef.clientWidth;
    const { pageSize, fontSize, panelOptions } = this.props;
    const panelClass = classNames('panel-problems', { [`font-size--${fontSize}`]: fontSize });
    let pageSizeOptions = [5, 10, 20, 25, 50, 100];
    if (pageSize) {
      pageSizeOptions.push(pageSize);
      pageSizeOptions = _.uniq(_.sortBy(pageSizeOptions));
    }

    return (
      <div className={panelClass} ref={this.setRootRef}>
        <ReactTable
          data={this.props.problems}
          columns={columns}
          defaultPageSize={10}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          resized={panelOptions.resizedColumns}
          minRows={0}
          loading={this.props.loading}
          noDataText="No problems found"
          SubComponent={props =>
            <ProblemDetails {...props}
              rootWidth={this.rootWidth}
              timeRange={this.props.timeRange}
              showTimeline={panelOptions.problemTimeline}
              getProblemEvents={this.props.getProblemEvents}
              getProblemAlerts={this.props.getProblemAlerts}
              onProblemAck={this.handleProblemAck}
              onTagClick={this.handleTagClick}
            />
          }
          expanded={this.getExpandedPage(this.state.page)}
          onExpandedChange={this.handleExpandedChange}
          onPageChange={page => this.setState({ page })}
          onPageSizeChange={this.handlePageSizeChange}
          onResizedChange={this.handleResizedChange}
        />
      </div>
    );
  }
}

function SeverityCell(props: RTCell<ZBXTrigger>, problemSeverityDesc: TriggerSeverity[], markAckEvents?: boolean, ackEventColor?: string) {
  const problem = props.original;
  let color: string;
  const severityDesc = _.find(problemSeverityDesc, s => s.priority === Number(props.original.priority));
  color = severityDesc.color;

  // Mark acknowledged triggers with different color
  if (markAckEvents && problem.acknowledges && problem.acknowledges.length) {
    color = ackEventColor;
  }

  return (
    <div className='severity-cell' style={{ background: color }}>
      {severityDesc.severity}
    </div>
  );
}

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';

function StatusCell(props: RTCell<ZBXTrigger>, okColor = DEFAULT_OK_COLOR, problemColor = DEFAULT_PROBLEM_COLOR, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'RESOLVED' : 'PROBLEM';
  const color = props.value === '0' ? okColor : problemColor;
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  return (
    <span className={newProblem ? 'problem-status--new' : ''} style={{ color }}>{status}</span>
  );
}

function StatusIconCell(props: RTCell<ZBXTrigger>, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'ok' : 'problem';
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  const className = classNames('zbx-problem-status-icon',
    { 'problem-status--new': newProblem },
    { 'zbx-problem': props.value === '1' },
    { 'zbx-ok': props.value === '0' },
  );
  return <GFHeartIcon status={status} className={className} />;
}

function GroupCell(props: RTCell<ZBXTrigger>) {
  let groups = "";
  if (props.value && props.value.length) {
    groups = props.value.map(g => g.name).join(', ');
  }
  return (
    <span>{groups}</span>
  );
}

function ProblemCell(props: RTCell<ZBXTrigger>) {
  const comments = props.original.comments;
  return (
    <div>
      <span className="problem-description">{props.value}</span>
      {/* {comments && <FAIcon icon="file-text-o" customClass="comments-icon" />} */}
    </div>
  );
}

function AgeCell(props: RTCell<ZBXTrigger>) {
  const problem = props.original;
  const timestamp = moment.unix(problem.lastchangeUnix);
  const age = timestamp.fromNow(true);
  return <span>{age}</span>;
}

function LastChangeCell(props: RTCell<ZBXTrigger>, customFormat?: string) {
  const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";
  const problem = props.original;
  const timestamp = moment.unix(problem.lastchangeUnix);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp.format(format);
  return <span>{lastchange}</span>;
}

interface TagCellProps extends RTCell<ZBXTrigger> {
  onTagClick: (tag: ZBXTag, datasource: string) => void;
}

class TagCell extends PureComponent<TagCellProps> {
  handleTagClick = (tag: ZBXTag) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource);
    }
  }

  render() {
    const tags = this.props.value || [];
    return [
      tags.map(tag => <EventTag key={tag.tag + tag.value} tag={tag} onClick={this.handleTagClick} /> )
    ];
  }
}

function CustomExpander(props: RTCell<any>) {
  return (
    <span className={props.isExpanded ? "expanded" : ""}>
      <i className="fa fa-info-circle"></i>
    </span>
  );
}
