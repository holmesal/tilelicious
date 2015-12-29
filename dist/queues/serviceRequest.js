'use strict';

var _fb = require('../utils/fb');

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _slug = require('slug');

var _slug2 = _interopRequireDefault(_slug);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _slack = require('../utils/slack');

var _slack2 = _interopRequireDefault(_slack);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_log2.default.info('service request queue up and running!');

var sayTotals = function sayTotals(service, totals) {
    var text = 'vote cast for *' + service + '*! Totals are now:';
    var sorted = _lodash2.default.sortBy(_lodash2.default.map(totals, function (votes, name) {
        return { votes: votes, name: name };
    }), 'votes').reverse();
    //log.info(sorted);
    sorted.forEach(function (item) {
        return text += '\n    *' + item.votes + '*  ' + item.name;
    });
    //log.info(text);
    (0, _slack2.default)(text);
};

var queue = new _firebaseQueue2.default(_fb.serviceRequestQueueRef, function (data, progress, resolve, reject) {
    // Get & slugify the service name
    var service = (0, _slug2.default)(data.service);
    // Make a ref
    var serviceCountRef = _fb.serviceRequestsRef.child(service);
    // Increment said ref in a transaction
    serviceCountRef.transaction(function (current) {
        return (current || 0) + 1;
    }, function (error, committed, snap) {
        if (error) {
            _log2.default.error(error);
            reject(error);
        } else {
            // Get the current counts
            _fb.serviceRequestsRef.once('value', function (snap) {
                //log.info(snap.val());
                sayTotals(service, snap.val());
                resolve();
            });
        }
    });
});