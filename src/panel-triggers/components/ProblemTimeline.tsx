import React, { PureComponent } from 'react';
import _ from 'lodash';
import moment from 'moment';
import { GFTimeRange, ZBXEvent } from 'panel-triggers/types';

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';
const EVENT_POINT_SIZE = 20;
const INNER_POINT_SIZE = 0.6;
const HIGHLIGHTED_POINT_SIZE = 1.1;
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
  highlightedRegion?: number | null;
  showEventInfo?: boolean;
  eventInfo?: EventInfo;
}

interface EventInfo {
  duration?: number;
}

export default class ProblemTimeline extends PureComponent<ProblemTimelineProps, ProblemTimelineState> {
  rootRef: any;
  sortedEvents: ZBXEvent[];

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
      highlightedRegion: null,
      showEventInfo: false,
    };
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.rootRef && prevState.width !== this.rootRef.clientWidth) {
      const width = this.rootRef.clientWidth;
      this.setState({ width });
    }
  }

  setRootRef = ref => {
    this.rootRef = ref;
    const width = ref && ref.clientWidth || 0;
    this.setState({ width });
  }

  handlePointHighlight = (index: number, secondIndex?: number) => {
    const event: ZBXEvent = this.sortedEvents[index];
    const regionToHighlight = this.getRegionToHighlight(index);
    let duration: number;
    if (secondIndex !== undefined) {
      duration = this.getEventDuration(index, secondIndex);
    }
    this.setState({
      highlightedEvent: event,
      showEventInfo: true,
      highlightedRegion: regionToHighlight,
      eventInfo: {
        duration
      }
    });
    // this.showEventInfo(event);
  }

  handlePointUnHighlight = () => {
    this.setState({ showEventInfo: false, highlightedRegion: null });
  }

  showEventInfo = (event: ZBXEvent) => {
    this.setState({ highlightedEvent: event, showEventInfo: true });
  }

  hideEventInfo = () => {
    this.setState({ showEventInfo: false });
  }

  getRegionToHighlight = (index: number): number => {
    const event = this.sortedEvents[index];
    const regionToHighlight = event.value === '1' ? index + 1 : index;
    return regionToHighlight;
  }

  getEventDuration(firstIndex: number, secondIndex: number): number {
    return Math.abs(Number(this.sortedEvents[firstIndex].clock) - Number(this.sortedEvents[secondIndex].clock)) * 1000;
  }

  sortEvents() {
    const events = _.sortBy(this.props.events, e => Number(e.clock));
    this.sortedEvents = events;
    return events;
  }

  render() {
    if (!this.rootRef) {
      return <div className="event-timeline" ref={this.setRootRef} />;
    }

    const { timeRange, eventPointSize, eventRegionHeight, problemColor, okColor } = this.props;
    const events = this.sortEvents();
    const boxWidth = this.state.width;
    const boxHeight = eventPointSize * 2;
    const width = boxWidth - eventPointSize;
    const padding = Math.round(eventPointSize / 2);
    const pointsYpos = eventRegionHeight / 2;
    const timelineYpos = Math.round(boxHeight / 2);

    return (
      <div className="event-timeline" ref={this.setRootRef}>
        <TimelineInfoContainer className="timeline-info-container"
          event={this.state.highlightedEvent}
          eventInfo={this.state.eventInfo}
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
                highlightedRegion={this.state.highlightedRegion}
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
                onPointHighlight={this.handlePointHighlight}
                onPointUnHighlight={this.handlePointUnHighlight}
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
  eventInfo?: EventInfo | null;
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
    const { event, eventInfo, show, className, left } = this.props;
    let infoItems, durationItem;
    if (event) {
      console.log(event);
      const ts = moment(Number(event.clock) * 1000);
      const tsFormatted = ts.format('HH:mm:ss');
      infoItems = [
        <span key="ts" className="event-timestamp">{tsFormatted}</span>
      ];
    }
    if (eventInfo && eventInfo.duration) {
      const duration = eventInfo.duration;
      const durationFormatted = moment.utc(duration).format('HH:mm:ss');
      durationItem = <span key="duration" className="event-timestamp">duration: {durationFormatted}</span>;
    }
    const containerStyle: React.CSSProperties = {
      opacity: show ? 1 : 0,
      left,
    };
    return (
      <div className={className} style={containerStyle}>
        <div>
          {infoItems}
        </div>
        <div>
          {durationItem}
        </div>
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
  highlightedRegion?: number | null;
}

class TimelineRegions extends PureComponent<TimelineRegionsProps> {
  static defaultProps = {
    highlightedRegion: null,
  };

  render() {
    const { events, timeRange, width, height, okColor, problemColor, highlightedRegion } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;

    let firstItem: React.ReactNode;
    if (events.length) {
      const firstTs = events.length ? Number(events[0].clock) : timeTo;
      const duration = (firstTs - timeFrom) / range;
      const regionWidth = Math.round(duration * width);
      const firstEventColor = events[0].value !== '1' ? problemColor : okColor;
      const highlighted = highlightedRegion === 0;
      const className = `problem-event-region ${highlighted ? 'highlighted' : ''}`;
      const firstEventAttributes = {
        x: 0,
        y: 0,
        width: regionWidth,
        height: height,
        fill: firstEventColor,
      };
      firstItem = (
        <rect key='0' className={className} {...firstEventAttributes}></rect>
      );
    }

    const eventsIntervalItems = events.map((event, index) => {
      const ts = Number(event.clock);
      const nextTs = index < events.length - 1 ? Number(events[index + 1].clock) : timeTo;
      const duration = (nextTs - ts) / range;
      const regionWidth = Math.round(duration * width);
      const posLeft = Math.round((ts - timeFrom) / range * width);
      const eventColor = event.value === '1' ? problemColor : okColor;
      const highlighted = highlightedRegion && highlightedRegion - 1 === index;
      const className = `problem-event-region ${highlighted ? 'highlighted' : ''}`;
      const attributes = {
        x: posLeft,
        y: 0,
        width: regionWidth,
        height: height,
        fill: eventColor,
      };

      return (
        <rect key={event.eventid} className={className} {...attributes} />
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
  highlightRegion?: boolean;
  onPointHighlight?: (index: number, secondIndex?: number) => void;
  onPointUnHighlight?: () => void;
}

interface TimelinePointsState {
  order: number[];
  highlighted: number[];
}

class TimelinePoints extends PureComponent<TimelinePointsProps, TimelinePointsState> {
  static defaultProps = {
    highlightRegion: true,
  };

  constructor(props) {
    super(props);
    this.state = { order: [], highlighted: [] };
  }

  bringToFront = (indexes: number[], highlight = false) => {
    const { events } = this.props;
    let order = events.map((v, i) => i);
    order = moveToEnd(order, indexes);
    const highlighted = highlight ? indexes : null;
    this.setState({ order, highlighted });
  }

  highlightPoint = (index: number) => () => {
    let pointsToHighlight = [index];
    if (this.props.onPointHighlight) {
      if (this.props.highlightRegion) {
        pointsToHighlight = this.getRegionEvents(index);
        const secondIndex = pointsToHighlight.length === 2 ? pointsToHighlight[1] : undefined;
        this.props.onPointHighlight(index, secondIndex);
      } else {
        this.props.onPointHighlight(index);
      }
    }
    this.bringToFront(pointsToHighlight, true);
  }

  getRegionEvents(index: number) {
    const events = this.props.events;
    const event = events[index];
    if (event.value === '1' && index < events.length ) {
      // Problem event
      for (let i = index; i < events.length; i++) {
        if (events[i].value === '0') {
          const okEventIndex = i;
          return [index, okEventIndex];
        }
      }
    } else if (event.value === '0' && index > 0) {
      // OK event
      let lastProblemIndex = null;
      for (let i = index - 1; i >= 0; i--) {
        if (events[i].value === '1') {
          lastProblemIndex = i;
        } else {
          break;
        }
      }
      if (lastProblemIndex !== null) {
        return [index, lastProblemIndex];
      }
    }
    return [index];
  }

  unHighlightPoint = index => () => {
    if (this.props.onPointUnHighlight) {
      this.props.onPointUnHighlight();
    }
    const order = this.props.events.map((v, i) => i);
    this.setState({ order, highlighted: [] });
  }

  render() {
    const { events, timeRange, width, pointSize, okColor, problemColor } = this.props;
    const { timeFrom, timeTo } = timeRange;
    const range = timeTo - timeFrom;
    const pointR = pointSize / 2;
    const eventsItems = events.map((event, i) => {
      const ts = Number(event.clock);
      const posLeft = Math.round((ts - timeFrom) / range * width - pointR);
      const eventColor = event.value === '1' ? problemColor : okColor;
      const highlighted = this.state.highlighted.indexOf(i) !== -1;

      return (
        <TimelinePoint
          key={event.eventid}
          className="problem-event-item"
          x={posLeft}
          r={pointR}
          color={eventColor}
          highlighted={highlighted}
          onPointHighlight={this.highlightPoint(i)}
          onPointUnHighlight={this.unHighlightPoint(i)}
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
  highlighted?: boolean;
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

  componentDidUpdate(prevProps: TimelinePointProps) {
    // Update component after reordering to make animation working
    if (prevProps.highlighted !== this.props.highlighted) {
      this.setState({ highlighted: this.props.highlighted });
    }
  }

  handleMouseOver = () => {
    if (this.props.onPointHighlight) {
      this.props.onPointHighlight();
    }
  }

  handleMouseLeave = () => {
    if (this.props.onPointUnHighlight) {
      this.props.onPointUnHighlight();
    }
  }

  render() {
    const { x, color } = this.props;
    const r = this.state.highlighted ? Math.round(this.props.r * HIGHLIGHTED_POINT_SIZE) : this.props.r;
    const cx = x + this.props.r;
    const rInner = Math.round(r * INNER_POINT_SIZE);
    const className = `${this.props.className || ''} ${this.state.highlighted ? 'highlighted' : ''}`;
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

function moveToEnd<T>(array: T[], itemsToMove: number[]): T[] {
  const removed = _.pullAt(array, itemsToMove);
  removed.reverse();
  array.push(...removed);
  return array;
}
