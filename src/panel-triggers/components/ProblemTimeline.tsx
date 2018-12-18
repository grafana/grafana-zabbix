import React, { PureComponent } from 'react';
import moment from 'moment';
import { GFTimeRange, ZBXEvent } from 'panel-triggers/types';

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';
const EVENT_POINT_SIZE = 20;
const INNER_POINT_SIZE = 0.6;
const HIGHLIGHTED_POINT_SIZE = 1.2;
const EVENT_REGION_HEIGHT = Math.round(EVENT_POINT_SIZE * 0.6);

export interface ProblemTimelineProps {
  events: ZBXEvent[];
  timeRange: GFTimeRange;
  okColor?: string;
  problemColor?: string;
  eventRegionHeight?: number;
  eventPointSize?: number;
}

interface ProblemTimelineState {
  width: number;
  highlightedEvent?: ZBXEvent | null;
  showEventInfo?: boolean;
}

export default class ProblemTimeline extends PureComponent<ProblemTimelineProps, ProblemTimelineState> {
  rootRef: any;

  static defaultProps = {
    okColor: DEFAULT_OK_COLOR,
    problemColor: DEFAULT_PROBLEM_COLOR,
    eventRegionHeight: EVENT_REGION_HEIGHT,
    eventPointSize: EVENT_POINT_SIZE,
  };

  constructor(props) {
    super(props);
    this.state = {
      width: 0,
      highlightedEvent: null,
      showEventInfo: false,
    };
  }

  setRootRef = ref => {
    this.rootRef = ref;
    const width = ref && ref.clientWidth || 0;
    this.setState({ width });
  }

  showEventInfo = (event: ZBXEvent) => {
    this.setState({ highlightedEvent: event, showEventInfo: true });
  }

  hideEventInfo = () => {
    this.setState({ showEventInfo: false });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.rootRef && prevState.width !== this.rootRef.clientWidth) {
      const width = this.rootRef.clientWidth;
      this.setState({ width });
    }
  }

  render() {
    if (!this.rootRef) {
      return <div className="event-timeline" ref={this.setRootRef} />;
    }

    const { events, timeRange, eventPointSize, eventRegionHeight, problemColor, okColor } = this.props;
    const boxWidth = this.state.width;
    const boxHeight = eventPointSize * 2;
    const width = boxWidth - eventPointSize;
    const padding = Math.round(eventPointSize / 2);
    const pointsYpos = Math.round(eventRegionHeight / 2);
    const timelineYpos = Math.round(boxHeight / 2);

    return (
      <div className="event-timeline" ref={this.setRootRef}>
        <TimelineInfoContainer className="timeline-info-container"
          event={this.state.highlightedEvent}
          show={this.state.showEventInfo}
          left={padding}
      />
        <svg className="event-timeline-canvas" viewBox={`0 0 ${boxWidth} ${boxHeight}`}>
          <defs>
            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="1" dy="1" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="boxShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.7" />
              </feComponentTransfer>
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
          <g className="event-timeline-group" transform={`translate(${padding}, ${timelineYpos})`}>
            <g className="event-timeline-regions" filter="url(#boxShadow)">
              <TimelineRegions
                events={events}
                timeRange={timeRange}
                width={width}
                height={eventRegionHeight}
                okColor={okColor}
                problemColor={problemColor}
              />
            </g>
            <g className="timeline-points" transform={`translate(0, ${pointsYpos})`}>
              <TimelinePoints
                events={events}
                timeRange={timeRange}
                width={width}
                pointSize={eventPointSize}
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
  left?: number;
  className?: string;
}

class TimelineInfoContainer extends PureComponent<TimelineInfoContainerProps> {
  static defaultProps = {
    left: 0,
    className: '',
    show: false,
  };

  render() {
    const { show, className, left } = this.props;
    const event = this.props.event;
    let infoItems;
    if (event) {
      console.log(event);
      const ts = moment(Number(event.clock) * 1000);
      const tsFormatted = ts.format('HH:mm:ss');
      infoItems = [
        <span key="ts" className="event-timestamp">{tsFormatted}</span>
      ];
    }
    const containerStyle: React.CSSProperties = {
      opacity: show ? 1 : 0,
      left,
    };
    return (
      <div className={className} style={containerStyle}>
        {infoItems}
      </div>
    );
  }
}

interface TimelineRegionsProps {
  events: ZBXEvent[];
  timeRange: GFTimeRange;
  width: number;
  height: number;
  okColor: string;
  problemColor: string;
}

class TimelineRegions extends PureComponent<TimelineRegionsProps> {
  render() {
    const { events, timeRange, width, height, okColor, problemColor } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;

    let firstItem: React.ReactNode;
    if (events.length) {
      const firstTs = events.length ? Number(events[0].clock) : timeTo;
      const duration = (firstTs - timeFrom) / range;
      const regionWidth = Math.round(duration * width);
      const firstEventColor = events[0].value !== '1' ? problemColor : okColor;
      const firstEventAttributes = {
        x: 0,
        y: 0,
        width: regionWidth,
        height: height,
        fill: firstEventColor,
      };
      firstItem = (
        <rect key='0' className="problem-event-region" {...firstEventAttributes}></rect>
      );
    }

    const eventsIntervalItems = events.map((event, index) => {
      const ts = Number(event.clock);
      const nextTs = index < events.length - 1 ? Number(events[index + 1].clock) : timeTo;
      const duration = (nextTs - ts) / range;
      const regionWidth = Math.round(duration * width);
      const posLeft = Math.round((ts - timeFrom) / range * width);
      const eventColor = event.value === '1' ? problemColor : okColor;
      const attributes = {
        x: posLeft,
        y: 0,
        width: regionWidth,
        height: height,
        fill: eventColor,
      };

      return (
        <rect key={event.eventid} className="problem-event-region" {...attributes} />
      );
    });

    return [
      firstItem,
      eventsIntervalItems
    ];
  }
}

interface TimelinePointsProps {
  events: ZBXEvent[];
  timeRange: GFTimeRange;
  width: number;
  pointSize: number;
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
    const { events, timeRange, width, pointSize, okColor, problemColor } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;
    const pointR = pointSize / 2;
    const eventsItems = events.map((event, index) => {
      const ts = Number(event.clock);
      const posLeft = Math.round((ts - timeFrom) / range * width - pointR);
      const eventColor = event.value === '1' ? problemColor : okColor;

      return (
        <TimelinePoint
          key={event.eventid}
          className="problem-event-item"
          x={posLeft}
          r={pointR}
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
    const r = this.state.highlighted ? Math.round(this.props.r * HIGHLIGHTED_POINT_SIZE) : this.props.r;
    const cx = x + this.props.r;
    const rInner = Math.round(r * INNER_POINT_SIZE);
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
