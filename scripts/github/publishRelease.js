const GithubClient = require('./githubClient');
const fs = require('fs');
const path = require('path');

const GRAFANA_ZABBIX_OWNER = 'konstantin-kornienko';
const GRAFANA_ZABBIX_REPO = 'grafana-zabbix';

const github = new GithubClient(GRAFANA_ZABBIX_OWNER, GRAFANA_ZABBIX_REPO, true);

async function main() {
  let releaseVersion = '';
  if (process.env.CIRCLE_TAG) {
    const tag = process.env.CIRCLE_TAG;
    const tagRegex = /v[0-9]+(\.[0-9]+){2}(-.+|[^-.]*)/;
    if (!tagRegex.test(tag)) {
      console.error(`Release tag should has format v1.2.3[-meta], got ${tag}`);
      process.exit(1);
    }

    releaseVersion = tag.slice(1);
  } else {
    releaseVersion = getPluginVersion();
  }

  console.log('Release version', releaseVersion);
  if (!releaseVersion) {
    console.error('Release not found');
    process.exit(1);
  }

  const releaseNotes = `# Grafana-Zabbix ${releaseVersion}`;
  const preRelease = /(alpha|beta)/.test(releaseVersion);

  let releaseId;
  try {
    const latestRelease = await github.client.get(`releases/tags/v${releaseVersion}`);
    releaseId = latestRelease.data.id;
    console.log('Release found', releaseId);
  } catch (reason) {
    if (reason.response.status !== 404) {
      // 404 just means no release found. Not an error. Anything else though, re throw the error
      console.error(reason.response.data);
      process.exit(1);
    }
  }

  if (!releaseId) {
    console.log('No release exist, finding a tag');
    let releaseCommitHash;
    try {
      const tags = await github.client.get(`tags`);
      const releaseTag = tags.data.find(t => t.name === `v${releaseVersion}`);
      releaseCommitHash = releaseTag.commit.sha;
      console.log('Tag found', releaseTag.name, releaseCommitHash);
    } catch (reason) {
      console.log(reason);
      if (reason.response.status !== 404) {
        // 404 just means no release found. Not an error. Anything else though, re throw the error
        console.error(reason.response.data);
        process.exit(1);
      } else {
        console.error('No release tag found');
        process.exit(1);
      }
    }

    try {
      const newReleaseResponse = await github.client.post('releases', {
        tag_name: `v${releaseVersion}`,
        target_commitish: releaseCommitHash,
        name: `${releaseVersion}`,
        body: releaseNotes,
        draft: false,
        prerelease: preRelease,
      });

      releaseId = newReleaseResponse.data.id;
      console.log('Release published with id', releaseId);
    } catch (reason) {
      console.error(reason.response.data);
      process.exit(1);
    }
  } else {
    try {
      github.client.patch(`releases/${releaseId}`, {
        tag_name: `v${releaseVersion}`,
        name: `${releaseVersion}`,
        body: releaseNotes,
        draft: false,
        prerelease: preRelease,
      });
    } catch (reason) {
      console.error(reason.response.data);
      process.exit(1);
    }
  }

  try {
    await publishAssets(
      `alexanderzobnin-zabbix-app-${releaseVersion}.zip`,
      `https://uploads.github.com/repos/${GRAFANA_ZABBIX_OWNER}/${GRAFANA_ZABBIX_REPO}/releases/${releaseId}/assets`
    );
    // Upload package info with md5 checksum
    await publishAssets(
      `info.json`,
      `https://uploads.github.com/repos/${GRAFANA_ZABBIX_OWNER}/${GRAFANA_ZABBIX_REPO}/releases/${releaseId}/assets`
    );
  } catch (reason) {
    console.error(reason);
    process.exit(1);
  }
}

async function publishAssets(fileName, destUrl) {
  // Add the assets. Loop through files in the ci/dist folder and upload each asset.

  const fileStat = fs.statSync(`${__dirname}/../../ci/packages/${fileName}`);
  const fileData = fs.readFileSync(`${__dirname}/../../ci/packages/${fileName}`);
  return await github.client.post(`${destUrl}?name=${fileName}`, fileData, {
    headers: {
      'Content-Type': resolveContentType(path.extname(fileName)),
      'Content-Length': fileStat.size,
    },
    maxContentLength: fileStat.size * 2 * 1024 * 1024,
    maxBodyLength: fileStat.size * 2 * 1024 * 1024,
  });
}

const resolveContentType = (extension) => {
  if (extension.startsWith('.')) {
    extension = extension.substr(1);
  }
  switch (extension) {
    case 'zip':
      return 'application/zip';
    case 'json':
      return 'application/json';
    case 'sha1':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
};

const getPluginVersion = () => {
  const pkg = fs.readFileSync(`${__dirname}/../../package.json`, 'utf8');
  const { version } = JSON.parse(pkg);
  if (!version) {
    throw `Could not find the toolkit version`;
  }
  return version;
};

main();
