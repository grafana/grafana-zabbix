#!/bin/bash

# Exit script if a statement returns a non-true return value.
set -o errexit
# Use the error status of the first failure, rather than that of the last item in a pipeline.
set -o pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$GRAFANA_API_KEY" ]
then
  echo -e "${RED}Error: \$GRAFANA_API_KEY variable should be set to sign plugin${NC}"
  exit 1
fi

# Install Dependencies
echo -e "${GREEN}Installing dependencies${NC}"
make install

# Build plugin for all platforms
echo -e "${GREEN}Building plugin for all platforms${NC}"
make dist

# Prepare plugin for packaging
echo -e "${GREEN}Preparing plugin for packaging${NC}"
rm -rf ci/jobs/build_plugin/dist
mkdir -p ci/jobs/build_plugin
mv dist/ ci/jobs/build_plugin
cp CHANGELOG.md ci/jobs/build_plugin/dist

# Package and sign plugin
echo -e "${GREEN}Packaging and signing plugin${NC}"
yarn grafana-toolkit plugin:ci-package

echo -e "${GREEN}Packaged plugin located in ${BLUE}ci/packages${NC}"
