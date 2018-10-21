#!/bin/bash

# Exit script if you try to use an uninitialized variable.
set -o nounset
# Exit script if a statement returns a non-true return value.
set -o errexit
# Use the error status of the first failure, rather than that of the last item in a pipeline.
set -o pipefail

echo "current dir: $(pwd)"

# Setup git env
git config --global user.email $CI_GIT_EMAIL
git config --global user.name $CI_GIT_USER
echo "git user is $CI_GIT_USER ($CI_GIT_EMAIL)"

git checkout -b $GH_PAGES_BRANCH
rm -rf * || true
mv ../gh-pages/docs/site/* ./
git add --force .
git commit -m "build docs from commit ${CIRCLE_SHA1:0:7} (branch $CIRCLE_BRANCH)"
git log -n 3

git push origin $GH_PAGES_BRANCH --force
