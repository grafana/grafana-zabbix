"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// Editor modes
var MODE_METRICS = exports.MODE_METRICS = 0;
var MODE_ITSERVICE = exports.MODE_ITSERVICE = 1;
var MODE_TEXT = exports.MODE_TEXT = 2;
var MODE_ITEMID = exports.MODE_ITEMID = 3;
var MODE_TRIGGERS = exports.MODE_TRIGGERS = 4;

// Triggers severity
var SEV_NOT_CLASSIFIED = exports.SEV_NOT_CLASSIFIED = 0;
var SEV_INFORMATION = exports.SEV_INFORMATION = 1;
var SEV_WARNING = exports.SEV_WARNING = 2;
var SEV_AVERAGE = exports.SEV_AVERAGE = 3;
var SEV_HIGH = exports.SEV_HIGH = 4;
var SEV_DISASTER = exports.SEV_DISASTER = 5;

var SHOW_ALL_TRIGGERS = exports.SHOW_ALL_TRIGGERS = [0, 1];
var SHOW_ALL_EVENTS = exports.SHOW_ALL_EVENTS = [0, 1];
var SHOW_OK_EVENTS = exports.SHOW_OK_EVENTS = 1;

// Data point
var DATAPOINT_VALUE = exports.DATAPOINT_VALUE = 0;
var DATAPOINT_TS = exports.DATAPOINT_TS = 1;
