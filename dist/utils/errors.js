'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = dumpError;

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function dumpError(err) {
    if ((typeof err === 'undefined' ? 'undefined' : _typeof(err)) === 'object') {
        if (err.message) {
            console.log('\nMessage: ' + err.message);
        }
        if (err.stack) {
            console.log('\nStacktrace:');
            console.log('====================');
            console.log(err.stack);
        }
    } else {
        console.log('dumpError :: argument is not an object');
    }
}