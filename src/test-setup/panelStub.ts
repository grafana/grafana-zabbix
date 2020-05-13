import { PanelEvents } from '@grafana/data';

export class PanelCtrl {
  panel: any;
  error: any;
  dashboard: any;
  pluginName: string;
  pluginId: string;
  editorTabs: any;
  $scope: any;
  $injector: any;
  $location: any;
  $timeout: any;
  editModeInitiated: boolean;
  height: number;
  width: number;
  containerHeight: any;
  events: any;
  loading: boolean;
  timing: any;

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$scope = $scope;
    this.panel = $scope.panel;
    this.timing = {};
    this.events = {
      on: () => {},
      emit: () => {}
    };
  }

  init() {
  }

  renderingCompleted() {
  }

  refresh() {
  }

  publishAppEvent(evtName, evt) {
  }

  changeView(fullscreen, edit) {
  }

  viewPanel() {
    this.changeView(true, false);
  }

  editPanel() {
    this.changeView(true, true);
  }

  exitFullscreen() {
    this.changeView(false, false);
  }

  initEditMode() {
  }

  changeTab(newIndex) {
  }

  addEditorTab(title, directiveFn, index) {
  }

  getMenu() {
    return [];
  }

  getExtendedMenu() {
    return [];
  }

  otherPanelInFullscreenMode() {
    return false;
  }

  calculatePanelHeight() {
  }

  render(payload) {
  }

  toggleEditorHelp(index) {
  }

  duplicate() {
  }

  updateColumnSpan(span) {
  }

  removePanel() {
  }

  editPanelJson() {
  }

  replacePanel(newPanel, oldPanel) {
  }

  sharePanel() {
  }

  getInfoMode() {
  }

  getInfoContent(options) {
  }

  openInspector() {
  }
}

export class MetricsPanelCtrl extends PanelCtrl {
  scope: any;
  datasource: any;
  $timeout: any;
  contextSrv: any;
  datasourceSrv: any;
  timeSrv: any;
  templateSrv: any;
  range: any;
  interval: any;
  intervalMs: any;
  resolution: any;
  timeInfo?: string;
  skipDataOnInit: boolean;
  dataList: any[];
  querySubscription?: any;
  useDataFrames = false;

  constructor($scope, $injector) {
    super($scope, $injector);

    this.events.on(PanelEvents.refresh, this.onMetricsPanelRefresh.bind(this));

    this.timeSrv = {
      timeRange: () => {},
    };
  }

  onInitMetricsPanelEditMode() {}
  onMetricsPanelRefresh() {}
  setTimeQueryStart() {}
  setTimeQueryEnd() {}
  updateTimeRange() {}
  calculateInterval() {}
  applyPanelTimeOverrides() {}
  issueQueries(datasource) {}
  handleQueryResult(result) {}
  handleDataStream(stream) {}
  setDatasource(datasource) {}
  getAdditionalMenuItems() {}
  explore() {}
  addQuery(target) {}
  removeQuery(target) {}
  moveQuery(target, direction) {}
}
