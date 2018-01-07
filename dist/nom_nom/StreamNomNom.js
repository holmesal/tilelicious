'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _stravaV = require('strava-v3');

var _stravaV2 = _interopRequireDefault(_stravaV);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fb = require('../utils/fb');

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _geojson = require('geojson');

var _geojson2 = _interopRequireDefault(_geojson);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _slack = require('../utils/slack');

var _slack2 = _interopRequireDefault(_slack);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FORCE_REFETCH = true;

var StreamNomNom = function () {
    function StreamNomNom(uid, activityId, resolve, reject, taskId) {
        var _this = this;

        _classCallCheck(this, StreamNomNom);

        this.uid = uid;
        this.activityId = activityId;
        this.resolve = resolve;
        this.reject = reject;
        this.taskId = taskId;
        var that = this;
        // Only fetch this stream if it doesn't exist in firebase
        (0, _fb.activityStreamRef)(activityId).child('hasData').once('value', function (snap) {
            if (snap.val() && !FORCE_REFETCH) {
                _log2.default.info('not fetching stream, it is already loaded');
            } else {
                _log2.default.info('fetching stream: ', activityId);
                // Fetch the token to use with this request
                _log2.default.info('fetching token for ', _this.uid);
                (0, _fb.userRef)(_this.uid).child('access_token').once('value', function (snap) {
                    var token = snap.val();
                    _log2.default.info('got token, ', token);
                    if (!token) {
                        reject('could not find this user token, got: ' + token);
                    } else {
                        _this.access_token = token;
                        _this.fetchStream();
                    }
                });
            }
        });
    }

    _createClass(StreamNomNom, [{
        key: 'fetchStream',
        value: function fetchStream() {
            var _this2 = this;

            _stravaV2.default.streams.activity({
                id: this.activityId,
                types: 'latlng',
                resolution: 'medium',
                access_token: this.access_token
            }, function (err, stream) {
                if (err) {
                    _log2.default.error(err);
                    _this2.reject(err);
                } else {
                    var latlng = _lodash2.default.findWhere(stream, { type: 'latlng' });
                    //log.info(stream);
                    if (latlng) {
                        latlng.geojson = _this2.convertStreamToGeoJSON(latlng.data);
                        delete latlng.data;
                        _log2.default.info('done fetching stream ', _this2.activityId);
                        _this2.pushStreamToFirebase(latlng);
                        _this2.resolve();
                    } else {
                        // TODO - remove the stream activity from firebase in this case, so the loading can at least finish and the image generation doesn't error out later...
                        _log2.default.info('no data returned for this stream?');
                        var rej = JSON.stringify({
                            error: err,
                            streamResponse: stream,
                            activityId: _this2.activityId,
                            uid: _this2.uid
                        });
                        _log2.default.info(rej);
                        // Tattle in slack
                        (0, _slack2.default)('*Error fetching stream*\n`' + rej + '`\n' + _fb.streamNomNomQueueRef.child('tasks').child(_this2.taskId).toString());
                        // Nuke this activity
                        (0, _fb.activityStreamRef)(_this2.activityId).set(null);
                        // Done
                        _this2.reject(rej);
                    }
                }
            });
        }
    }, {
        key: 'convertStreamToGeoJSON',
        value: function convertStreamToGeoJSON(stream) {
            var inverted = _lodash2.default.map(stream, function (point) {
                return [point[1], point[0]];
            });
            var shape = [{
                line: inverted
            }];
            var features = _geojson2.default.parse(shape, { LineString: 'line' });
            return features;
        }
    }, {
        key: 'pushStreamToFirebase',
        value: function pushStreamToFirebase(stream) {
            // Store this stream
            (0, _fb.activityStreamRef)(this.activityId).set(stream);
            // Mark this activity as loaded
            (0, _fb.userActivityRef)(this.uid).child(this.activityId).update({
                streamLoaded: true
            });
        }
    }]);

    return StreamNomNom;
}();

//let test = new StreamNomNom('8657205', '330487627');

exports.default = StreamNomNom;
_log2.default.info('streamNomNom queue up and running');

var queue = new _firebaseQueue2.default(_fb.streamNomNomQueueRef, { sanitize: false }, function (data, progress, resolve, reject) {
    _log2.default.info('streamNomNomQueue running for user: ', data.uid, ' and activity ', data.activityId);
    if (!data.uid || !data.activityId) {
        reject('something was undefined: activityId: ' + data.activityId + '   uid: ' + data.uid);
    } else {
        var stream = new StreamNomNom(data.uid, data.activityId, resolve, reject, data._id);
    }
});