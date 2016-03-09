'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = dumpError;

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _slack = require('./slack');

var _slack2 = _interopRequireDefault(_slack);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function dumpError(err) {
    // Log via winston
    _log2.default.error(err);
    var stage = err.stage;
    var error = err.error;
    var meta = err.meta;
    var data = err.data;

    if (error && typeof error != 'string') error = JSON.stringify(error);
    if (meta && typeof meta != 'string') meta = JSON.stringify(meta);
    if (data && typeof data != 'string') data = JSON.stringify(data);

    // Log via slack
    (0, _slack2.default)(':fire::fire::computer::fire::fire: error in stage: *' + stage + '* \nwith content: \n`*' + error + '` \nand meta \n`' + meta + '`\nand data \n`' + data + '`');
    //if (typeof err === 'object') {
    //    if (err.message) {
    //        log.error('\nMessage: ' + err.message)
    //    }
    //    if (err.stack) {
    //        log.error('\nStacktrace:')
    //        log.error('====================')
    //        log.error(err.stack);
    //    }
    //} else {
    //    log.warn('dumpError :: argument is not an object, it is a: ', typeof err);
    //    log.error(err);
    //}
}