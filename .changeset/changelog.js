const changelogFunctions = {
  getReleaseLine: async (changeset, type, options) => {
    let prefix = '🎉';
    if (type === 'major') {
      prefix = '🎉';
    } else if (type === 'minor') {
      prefix = '🚀';
    } else if (type === 'patch') {
      prefix = '🐛';
    }
    if (changeset && changeset.summary) {
      const summary = changeset.summary || '';
      if (summary.indexOf('Docs') > -1) {
        prefix = '📝';
      }
      if (
        summary.indexOf('Chore') > -1 ||
        summary.indexOf('grafana-plugin-sdk-go') > -1 ||
        summary.indexOf('compiled') > -1
      ) {
        prefix = '⚙️';
      }
      return [prefix, summary].join(' ');
    }
    return [prefix, changeset?.summary].join(' ');
  },
  getDependencyReleaseLine: async (changesets, dependenciesUpdated, options) => {
    return '\n';
  },
};

module.exports = changelogFunctions;
