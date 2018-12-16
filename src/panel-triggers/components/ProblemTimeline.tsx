import React, { PureComponent } from 'react';
import moment from 'moment';
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
  highlightedEvent?: ZBXEvent | null;
  showEventInfo?: boolean;
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

  showEventInfo = (event: ZBXEvent) => {
    this.setState({ highlightedEvent: event, showEventInfo: true });
  }

  hideEventInfo = () => {
    this.setState({ showEventInfo: false });
  }

  render() {
    if (!this.rootRef) {
      return <div className="event-timeline" ref={this.setRootRef} />;
    }

    const { events, timeRange, problemColor, okColor } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;
    const width = this.state.width;

    let firstItem;
    if (events.length) {
      const firstTs = events.length ? Number(events[0].clock) : timeTo;
      const duration = (firstTs - timeFrom) / range;
      const firstEventColor = events[0].value !== '1' ? this.props.problemColor : this.props.okColor;
      const firstEventAttributes = {
        width: duration * width,
        x: 0,
        y: 0,
        fill: firstEventColor,
      };
      firstItem = (
        <rect key='0' className="problem-event-interval" {...firstEventAttributes}></rect>
      );
    }

    const eventsIntervalItems = events.map((event, index) => {
      const ts = Number(event.clock);
      const nextTs = index < events.length - 1 ? Number(events[index + 1].clock) : timeTo;
      const duration = (nextTs - ts) / range;
      const posLeft = (ts - timeFrom) / range * width;
      const eventColor = event.value === '1' ? this.props.problemColor : this.props.okColor;
      const attributes = {
        width: duration * width,
        x: posLeft,
        y: 0,
        fill: eventColor,
      };

      return (
        <rect key={event.eventid} className="problem-event-interval" {...attributes} />
      );
    });

    const eventsItems = events.map(event => {
      const ts = Number(event.clock);
      const posLeft = (ts - timeFrom) / range * width - EVENT_ITEM_SIZE / 2;
      const eventColor = event.value === '1' ? this.props.problemColor : this.props.okColor;

      return (
        <TimelinePoint
          key={event.eventid}
          className="problem-event-item"
          x={posLeft}
          r={10}
          color={eventColor}
        />
      );
    });

    return (
      <div className="event-timeline" ref={this.setRootRef}>
        <TimelineInfoContainer className="timeline-info-container"
          event={this.state.highlightedEvent}
          show={this.state.showEventInfo}
        />
        <svg className="event-timeline-canvas" viewBox={`0 0 ${width + 20} 40`}>
          <defs>
            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="1" dy="1" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="timelinePointBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blurOut" />
            </filter>
          </defs>
          <g className="event-timeline-group">
            <g className="event-timeline-regions">
              {firstItem}
              {eventsIntervalItems}
            </g>
            <g className="timeline-points" transform={`translate(0, 6)`}>
              <TimelinePoints
                events={events}
                timeRange={timeRange}
                width={width}
                okColor={okColor}
                problemColor={problemColor}
                onPointHighlight={this.showEventInfo}
                onPointUnHighlight={this.hideEventInfo}
              />
            </g>
          </g>
        </svg>
      </div>
    );
  }
}

interface TimelineInfoContainerProps {
  event?: ZBXEvent | null;
  show?: boolean;
  className?: string;
}

class TimelineInfoContainer extends PureComponent<TimelineInfoContainerProps> {
  render() {
    const { show, className } = this.props;
    const event = this.props.event;
    let infoItems;
    if (event) {
      console.log(event);
      const ts = moment(Number(event.clock) * 1000);
      const tsFormatted = ts.format('HH:mm:ss');
      infoItems = [
        <span className="event-timestamp">{tsFormatted}</span>
      ];
    }
    const containerStyle: React.CSSProperties = {
      opacity: show ? 1 : 0,
    };
    return (
      <div className={className} style={containerStyle}>
        {infoItems}
      </div>
    );
  }
}

function TimelineRegion(props) {
  return (
    <rect></rect>
  );
}

interface TimelinePointsProps {
  events: ZBXEvent[];
  timeRange: GFTimeRange;
  width: number;
  okColor: string;
  problemColor: string;
  onPointHighlight?: (event: ZBXEvent) => void;
  onPointUnHighlight?: () => void;
}

interface TimelinePointsState {
  order: number[];
}

class TimelinePoints extends PureComponent<TimelinePointsProps, TimelinePointsState> {
  constructor(props) {
    super(props);
    this.state = { order: [] };
  }

  bringToFront = index => {
    const { events } = this.props;
    const length = events.length;
    const order = events.map((v, i) => i);
    order.splice(index, 1);
    order.push(index);
    this.setState({ order });
  }

  highlightPoint = index => () => {
    if (this.props.onPointHighlight) {
      this.props.onPointHighlight(this.props.events[index]);
    }
    this.bringToFront(index);
  }


  unHighlightPoint = index => () => {
    if (this.props.onPointUnHighlight) {
      this.props.onPointUnHighlight();
    }
    const order = this.props.events.map((v, i) => i);
    this.setState({ order });
  }

  render() {
    const { events, timeRange, width, okColor, problemColor } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;
    const eventsItems = events.map((event, index) => {
      const ts = Number(event.clock);
      const posLeft = (ts - timeFrom) / range * width - EVENT_ITEM_SIZE / 2;
      const eventColor = event.value === '1' ? problemColor : okColor;

      return (
        <TimelinePoint
          key={event.eventid}
          className="problem-event-item"
          x={posLeft}
          r={10}
          color={eventColor}
          onPointHighlight={this.highlightPoint(index)}
          onPointUnHighlight={this.unHighlightPoint(index)}
        />
      );
    });
    if (this.state.order.length) {
      return this.state.order.map(i => eventsItems[i]);
    }
    return eventsItems;
  }
}

interface TimelinePointProps {
  x: number;
  r: number;
  color: string;
  className?: string;
  onPointHighlight?: () => void;
  onPointUnHighlight?: () => void;
}

interface TimelinePointState {
  highlighted?: boolean;
}

class TimelinePoint extends PureComponent<TimelinePointProps, TimelinePointState> {
  constructor(props) {
    super(props);
    this.state = { highlighted: false };
  }

  handleMouseOver = () => {
    if (this.props.onPointHighlight) {
      this.props.onPointHighlight();
    }
    this.setState({ highlighted: true });
  }

  handleMouseLeave = () => {
    if (this.props.onPointUnHighlight) {
      this.props.onPointUnHighlight();
    }
    this.setState({ highlighted: false });
  }

  render() {
    const { x, color, className } = this.props;
    const r = this.state.highlighted ? this.props.r * 1.2 : this.props.r;
    const cx = x + this.props.r;
    const rInner = Math.floor(r * 0.6);
    return (
      <g className={className}
        transform={`translate(${cx}, 0)`}
        filter="url(#dropShadow)"
        onMouseOver={this.handleMouseOver}
        onMouseLeave={this.handleMouseLeave}>
        <circle cx={0} cy={0} r={r} fill={color} className="point-border" />
        <circle cx={0} cy={0} r={rInner} fill="#000000" className="point-core" />
      </g>
    );
  }
}
