import React, { PureComponent, CSSProperties } from 'react';
import classNames from 'classnames';
import { ProblemsPanelOptions, ZBXTrigger, GFTimeRange, ZBXTag } from '../../types';
import { AckProblemData } from '.././Modal';
import AlertCard from './AlertCard';

export interface AlertListProps {
  problems: ZBXTrigger[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: GFTimeRange;
  pageSize?: number;
  fontSize?: number;
  onProblemAck?: (problem: ZBXTrigger, data: AckProblemData) => void;
  onTagClick?: (tag: ZBXTag, datasource: string) => void;
}

interface AlertListState {
  page: number;
  currentProblems: ZBXTrigger[];
}

export default class AlertList extends PureComponent<AlertListProps, AlertListState> {
  constructor(props) {
    super(props);
    this.state = {
      page: 0,
      currentProblems: this.getCurrentProblems(0),
    };
  }

  getCurrentProblems(page: number) {
    const { pageSize, problems } = this.props;
    const start = pageSize * page;
    const end = Math.min(pageSize * (page + 1), problems.length);
    return this.props.problems.slice(start, end);
  }

  handlePageChange = (newPage: number) => {
    const items = this.getCurrentProblems(newPage);
    this.setState({
      page: newPage,
      currentProblems: items,
    });
  }


  handleTagClick = (tag: ZBXTag, datasource: string) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, datasource);
    }
  }

  handleProblemAck = (problem: ZBXTrigger, data: AckProblemData) => {
    return this.props.onProblemAck(problem, data);
  }

  render() {
    const { problems, panelOptions } = this.props;
    const currentProblems = this.getCurrentProblems(this.state.page);
    let fontSize = parseInt(panelOptions.fontSize.slice(0, panelOptions.fontSize.length - 1), 10);
    fontSize = fontSize && fontSize !== 100 ? fontSize : null;
    const alertListClass = classNames('alert-rule-list', { [`font-size--${fontSize}`]: fontSize });

    return (
      <div className="triggers-panel-container" key="alertListContainer">
        <section className="card-section card-list-layout-list">
          <ol className={alertListClass}>
            {currentProblems.map(problem =>
              <AlertCard
                key={`${problem.triggerid}-${problem.datasource}`}
                problem={problem}
                panelOptions={panelOptions}
                onTagClick={this.handleTagClick}
                onProblemAck={this.handleProblemAck}
              />
            )}
          </ol>
        </section>

        <div className="triggers-panel-footer" key="alertListFooter">
          <PaginationControl
            itemsLength={problems.length}
            pageSize={this.props.pageSize}
            pageIndex={this.state.page}
            onPageChange={this.handlePageChange}
          />
        </div>
      </div>
    );
  }
}

interface PaginationControlProps {
  itemsLength: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (index: number) => void;
}

class PaginationControl extends PureComponent<PaginationControlProps> {

  handlePageChange = (index: number) => () => {
    this.props.onPageChange(index);
  }

  render() {
    const { itemsLength, pageIndex, pageSize } = this.props;
    const pageCount = Math.ceil(itemsLength / pageSize);
    if (pageCount === 1) {
      return <ul></ul>;
    }

    const startPage = Math.max(pageIndex - 3, 0);
    const endPage = Math.min(pageCount, startPage + 9);


    const pageLinks = [];
    for (let i = startPage; i < endPage; i++) {
      const pageLinkClass = classNames('triggers-panel-page-link', 'pointer', { 'active': i === pageIndex });
      const value = i + 1;
      const pageLinkElem = (
        <li key={value.toString()}>
          <a className={pageLinkClass} onClick={this.handlePageChange(i)}>{value}</a>
        </li>
      );
      pageLinks.push(pageLinkElem);
    }

    return (
      <ul>
        {pageLinks}
      </ul>
    );
  }
}
