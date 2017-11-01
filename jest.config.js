module.exports = {
  "roots": [
    // "<rootDir>/dist/test"
    "<rootDir>/src"
  ],
  "setupFiles": [
    // "<rootDir>/dist/test/test-setup/jest-setup.js"
    "<rootDir>/src/test-setup/jest-setup.js"
  ],
  "moduleNameMapper": {
    "^[./a-zA-Z0-9$_-]+\.css\!?$": "<rootDir>/src/test-setup/cssStub.js",
  },
  "transform": {
    "^.+\\.js$": "babel-jest"
  },
  "coverageDirectory": "<rootDir>/tmp/coverage/",
  "collectCoverage": false
};
