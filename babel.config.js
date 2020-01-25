module.exports = {
  "presets": [
    [ "@babel/preset-env", { "targets": { "node": "current" } } ],
    "@babel/react"
  ],
  "plugins": ["angularjs-annotate"],
  "retainLines": true
};
