import { PanelPlugin } from '@grafana/data';
import { problemsPanelChangedHandler, problemsPanelMigrationHandler } from './migrations';
import { ProblemsPanel } from './ProblemsPanel';
import { defaultPanelOptions, ProblemsPanelOptions } from './types';
import { ResetColumnsEditor } from './components/ResetColumnsEditor';
import { ProblemColorEditor } from './components/ProblemColorEditor';
import { loadPluginCss } from '@grafana/runtime';

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/styles/dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/styles/light.css',
});

export const plugin = new PanelPlugin<ProblemsPanelOptions, {}>(ProblemsPanel)
  .setPanelChangeHandler(problemsPanelChangedHandler)
  .setMigrationHandler(problemsPanelMigrationHandler)
  .setPanelOptions((builder) => {
    builder
      .addSelect({
        path: 'layout',
        name: 'Layout',
        defaultValue: defaultPanelOptions.layout,
        settings: {
          options: [
            { label: 'Table', value: 'table' },
            { label: 'List', value: 'list' },
          ],
        },
      })
      .addSelect({
        path: 'sortProblems',
        name: 'Sort by',
        defaultValue: defaultPanelOptions.sortProblems,
        settings: {
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Last change', value: 'lastchange' },
            { label: 'Severity', value: 'priority' },
          ],
        },
      })
      .addSelect({
        path: 'fontSize',
        name: 'Font size',
        defaultValue: defaultPanelOptions.fontSize,
        settings: {
          options: fontSizeOptions,
        },
      })
      .addNumberInput({
        path: 'pageSize',
        name: 'Page size',
        defaultValue: defaultPanelOptions.pageSize,
      })
      .addBooleanSwitch({
        path: 'problemTimeline',
        name: 'Problem timeline',
        defaultValue: defaultPanelOptions.problemTimeline,
        showIf: (options) => options.layout === 'table',
      })
      .addBooleanSwitch({
        path: 'highlightBackground',
        name: 'Highlight background',
        defaultValue: defaultPanelOptions.highlightBackground,
        showIf: (options) => options.layout === 'list',
      })
      .addBooleanSwitch({
        path: 'highlightNewEvents',
        name: 'Highlight new events',
        defaultValue: defaultPanelOptions.highlightNewEvents,
      })
      .addTextInput({
        path: 'highlightNewerThan',
        name: 'Newer than',
        defaultValue: defaultPanelOptions.highlightNewerThan,
        showIf: (options) => options.highlightNewEvents,
      })
      .addBooleanSwitch({
        path: 'customLastChangeFormat',
        name: 'Custom last change format',
        defaultValue: defaultPanelOptions.customLastChangeFormat,
      })
      .addTextInput({
        path: 'lastChangeFormat',
        name: 'Last change format',
        defaultValue: defaultPanelOptions.lastChangeFormat,
        description: 'See moment.js dosc for time format http://momentjs.com/docs/#/displaying/format/',
        settings: {
          placeholder: 'dddd, MMMM Do YYYY, h:mm:ss a',
        },
        showIf: (options) => options.customLastChangeFormat,
      })
      .addBooleanSwitch({
        path: 'allowDangerousHTML',
        name: 'Allow HTML',
        description: `Format problem description and other data as HTML. Use with caution, it's potential cross-site scripting (XSS) vulnerability.`,
        defaultValue: defaultPanelOptions.allowDangerousHTML,
      })
      .addCustomEditor({
        id: 'resetColumns',
        path: 'resizedColumns',
        name: 'Reset resized columns',
        editor: ResetColumnsEditor,
        showIf: (options) => options.layout === 'table',
      })
      .addCustomEditor({
        id: 'triggerColors',
        path: 'triggerSeverity',
        name: 'Problem colors',
        editor: ProblemColorEditor,
        defaultValue: defaultPanelOptions.triggerSeverity,
        category: ['Colors'],
      })
      .addBooleanSwitch({
        path: 'markAckEvents',
        name: 'Mark acknowledged events',
        defaultValue: defaultPanelOptions.markAckEvents,
        category: ['Colors'],
      })
      .addColorPicker({
        path: 'ackEventColor',
        name: 'Acknowledged color',
        defaultValue: defaultPanelOptions.ackEventColor,
        showIf: (options) => options.markAckEvents,
        // enableNamedColors does not work now
        settings: [{ enableNamedColors: false }],
        category: ['Colors'],
      })
      .addColorPicker({
        path: 'okEventColor',
        name: 'OK event color',
        defaultValue: defaultPanelOptions.okEventColor,
        settings: [{ enableNamedColors: false }],
        category: ['Colors'],
      })

      // Show/hide fields
      .addBooleanSwitch({
        path: 'hostField',
        name: 'Host name',
        defaultValue: defaultPanelOptions.hostField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'hostTechNameField',
        name: 'Technical name',
        defaultValue: defaultPanelOptions.hostTechNameField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'hostGroups',
        name: 'Host groups',
        defaultValue: defaultPanelOptions.hostGroups,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'hostProxy',
        name: 'Host proxy',
        defaultValue: defaultPanelOptions.hostProxy,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'showTags',
        name: 'Tags',
        defaultValue: defaultPanelOptions.showTags,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'statusField',
        name: 'Status',
        defaultValue: defaultPanelOptions.statusField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'statusIcon',
        name: 'Status icon',
        defaultValue: defaultPanelOptions.statusIcon,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'severityField',
        name: 'Severity',
        defaultValue: defaultPanelOptions.severityField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'ackField',
        name: 'Ack',
        defaultValue: defaultPanelOptions.ackField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'ageField',
        name: 'Age',
        defaultValue: defaultPanelOptions.ageField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'opdataField',
        name: 'Operational data',
        defaultValue: defaultPanelOptions.opdataField,
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'descriptionField',
        name: 'Description',
        defaultValue: defaultPanelOptions.descriptionField,
        showIf: (options) => options.layout === 'list',
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'descriptionAtNewLine',
        name: 'At the new line',
        defaultValue: defaultPanelOptions.descriptionAtNewLine,
        showIf: (options) => options.layout === 'list',
        category: ['Fields'],
      })
      .addBooleanSwitch({
        path: 'showDatasourceName',
        name: 'Datasource name',
        defaultValue: defaultPanelOptions.showDatasourceName,
        category: ['Fields'],
      })
      
      // Select tag name to display as column
      .addTextInput({
        path: 'customTagColumn',
        name: 'Custom tag column',
        defaultValue: '',
        description: 'Tag name to display',
        settings: {
          placeholder: 'Specify the key of the tag you need to show. eg. component:interface'
        },
        category: ['Fields'],
      })
      ;
  });

const fontSizeOptions = [
  { label: '80%', value: '80%' },
  { label: '90%', value: '90%' },
  { label: '100%', value: '100%' },
  { label: '110%', value: '110%' },
  { label: '120%', value: '120%' },
  { label: '130%', value: '130%' },
  { label: '150%', value: '150%' },
  { label: '160%', value: '160%' },
  { label: '180%', value: '180%' },
  { label: '200%', value: '200%' },
  { label: '220%', value: '220%' },
  { label: '250%', value: '250%' },
];
