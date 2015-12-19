'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rejectedChargesRef = exports.ordersRef = exports.activityStreamRef = exports.userActivityRef = exports.userRef = exports.uidByCodeRef = exports.orderQueueRef = exports.imageGenerationQueueRef = exports.streamNomNomQueueRef = exports.activityNomNomQueueRef = exports.tokenExchangeQueueRef = exports.queueRootRef = exports.rootRef = undefined;

var _firebase = require('firebase');

var _firebase2 = _interopRequireDefault(_firebase);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var FIREBASE_URL = 'https://stravalicious.firebaseio.com';

var rootRef = exports.rootRef = new _firebase2.default(FIREBASE_URL);

/**
 * Queues
 */

var queueRootRef = exports.queueRootRef = rootRef.child('queues');

var tokenExchangeQueueRef = exports.tokenExchangeQueueRef = queueRootRef.child('tokenExchange');

var activityNomNomQueueRef = exports.activityNomNomQueueRef = queueRootRef.child('activityNomNom');

var streamNomNomQueueRef = exports.streamNomNomQueueRef = queueRootRef.child('streamNomNom');

var imageGenerationQueueRef = exports.imageGenerationQueueRef = queueRootRef.child('imageGeneration');

var orderQueueRef = exports.orderQueueRef = queueRootRef.child('order');

/**
 * Firebase locations
 */
var uidByCodeRef = exports.uidByCodeRef = function uidByCodeRef(code) {
  return rootRef.child('uidByCode/' + code);
};

var userRef = exports.userRef = function userRef(uid) {
  return rootRef.child('users/' + uid);
};

var userActivityRef = exports.userActivityRef = function userActivityRef(uuid) {
  return rootRef.child('activityByUser/' + uuid);
};

var activityStreamRef = exports.activityStreamRef = function activityStreamRef(activityId) {
  return rootRef.child('streamByActivity/' + activityId);
};

var ordersRef = exports.ordersRef = rootRef.child('orders');

var rejectedChargesRef = exports.rejectedChargesRef = rootRef.child('rejectedCharges');

// uncomment to DESTROY
//rootRef.set(null);