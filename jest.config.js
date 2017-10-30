module.exports = {
  "roots": [
    "<rootDir>/dist/test"
  ],
  "setupFiles": [
    "<rootDir>/dist/test/test-setup/jest-setup.js"
  ],
  "moduleNameMapper": {
    "^[./a-zA-Z0-9$_-]+\.css\!?$": "<rootDir>/dist/test/test-setup/cssStub.js",
  },
  "coverageDirectory": "<rootDir>/tmp/coverage/",
  "collectCoverage": false
};
