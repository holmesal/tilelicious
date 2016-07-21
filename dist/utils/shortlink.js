'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _goo = require('goo.gl');

var _goo2 = _interopRequireDefault(_goo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_goo2.default.setKey(process.env.GOOGL_API_KEY);

exports.default = _goo2.default;