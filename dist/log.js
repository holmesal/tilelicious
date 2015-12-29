'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _winstonLogentries = require('winston-logentries');

var _winstonLogentries2 = _interopRequireDefault(_winstonLogentries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var logger = new _winston2.default.Logger({
    transports: [new _winston2.default.transports.Console(), new _winston2.default.transports.Logentries({ token: '17ed1c11-f58e-4a6e-8bed-c71d3c6de45b' })]
});

exports.default = logger;