import React, { PureComponent } from 'react';
import { GFTimeRange, ZBXEvent } from 'panel-triggers/types';

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';
const EVENT_ITEM_SIZE = 16;

export interface ProblemTimelineProps {
  events: ZBXEvent[];
  timeRange: GFTimeRange;
  okColor?: string;
  problemColor?: string;
}

interface ProblemTimelineState {
  width: number;
}

export default class ProblemTimeline extends PureComponent<ProblemTimelineProps, ProblemTimelineState> {
  rootWidth: number;
  rootRef: any;

  static defaultProps = {
    okColor: DEFAULT_OK_COLOR,
    problemColor: DEFAULT_PROBLEM_COLOR,
  };

  constructor(props) {
    super(props);
    this.state = {
      width: 0
    };
  }

  setRootRef = ref => {
    this.rootRef = ref;
    const width = this.rootRef && this.rootRef.clientWidth || 0;
    this.setState({ width });
  }

  render() {
    if (!this.rootRef) {
      return <div className="event-timeline" ref={this.setRootRef} />;
    }
    const { events, timeRange } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;
    const width = this.state.width;

    let firstItem;
    if (events.length) {
      const firstTs = events.length ? Number(events[0].clock) : timeTo;
      const duration = (firstTs - timeFrom) / range;
      const firstEventColor = events[0].value !== '1' ? this.props.problemColor : this.props.okColor;
      const firstEventStyle: React.CSSProperties = {
        width: duration * width,
        left: 0,
        background: firstEventColor,
      };
      firstItem = (
        <div key='0' className="problem-event-interval" style={firstEventStyle}></div>
      );
    }

    const eventsIntervalItems = events.map((event, index) => {
      const ts = Number(event.clock);
      const nextTs = index < events.length - 1 ? Number(events[index + 1].clock) : timeTo;
      const duration = (nextTs - ts) / range;
      const posLeft = (ts - timeFrom) / range * width;
      const eventColor = event.value === '1' ? this.props.problemColor : this.props.okColor;
      const styles: React.CSSProperties = {
        width: duration * width,
        left: posLeft,
        background: eventColor,
      };

      return (
        <div key={event.eventid} className="problem-event-interval" style={styles}></div>
      );
    });

    const eventsItems = events.map(event => {
      const ts = Number(event.clock);
      const posLeft = (ts - timeFrom) / range * width - EVENT_ITEM_SIZE / 2;
      const eventColor = event.value === '1' ? this.props.problemColor : this.props.okColor;
      const styles: React.CSSProperties = {
        transform: `translate(${posLeft}px, -2px)`,
        // background: eventColor,
        borderColor: eventColor,
      };

      return (
        <div key={event.eventid} className="problem-event-item" style={styles}></div>
      );
    });

    return (
      <div className="event-timeline" ref={this.setRootRef}>
        {firstItem}
        {eventsIntervalItems}
        {eventsItems}
      </div>
    );
  }
}
