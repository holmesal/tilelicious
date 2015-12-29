'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = dumpError;

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function dumpError(err) {
    if ((typeof err === 'undefined' ? 'undefined' : _typeof(err)) === 'object') {
        if (err.message) {
            _log2.default.error('\nMessage: ' + err.message);
        }
        if (err.stack) {
            _log2.default.error('\nStacktrace:');
            _log2.default.error('====================');
            _log2.default.error(err.stack);
        }
    } else {
        _log2.default.error('dumpError :: argument is not an object');
    }
}