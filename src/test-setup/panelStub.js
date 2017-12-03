// JSHint options
/* jshint ignore:start */

export class PanelCtrl {
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
