'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
    value: true
});

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var StreamNomNom = (function () {
    function StreamNomNom(uid, activityId, resolve, reject) {
        _classCallCheck(this, StreamNomNom);

        this.uid = uid;
        this.activityId = activityId;
        this.resolve = resolve;
        this.reject = reject;
        var that = this;
        // Only fetch this stream if it doesn't exist in firebase
        (0, _fb.activityStreamRef)(activityId).child('hasData').once('value', function (snap) {
            if (snap.val()) {
                _log2.default.info('not fetching stream, it is already loaded');
            } else {
                _log2.default.info('fetching stream: ', activityId);
                that.fetchStream();
            }
        });
    }

    _createClass(StreamNomNom, [{
        key: 'fetchStream',
        value: function fetchStream() {
            var _this = this;

            _stravaV2.default.streams.activity({
                id: this.activityId,
                types: 'latlng',
                resolution: 'medium'
            }, function (err, stream) {
                if (err) {
                    _log2.default.error(err);
                    _this.reject(err);
                } else {
                    var latlng = _lodash2.default.findWhere(stream, { type: 'latlng' });
                    //log.info(stream);
                    if (latlng) {
                        latlng.geojson = _this.convertStreamToGeoJSON(latlng.data);
                        delete latlng.data;
                        _log2.default.info('done fetching stream ', _this.activityId);
                        _this.pushStreamToFirebase(latlng);
                        _this.resolve();
                    } else {
                        _log2.default.info('no data returned for this stream?');
                        _this.reject(err);
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
})();

//let test = new StreamNomNom('8657205', '330487627');

exports.default = StreamNomNom;
_log2.default.info('streamNomNom queue up and running');

var queue = new _firebaseQueue2.default(_fb.streamNomNomQueueRef, function (data, progress, resolve, reject) {
    _log2.default.info('streamNomNomQueue running for user: ', data.uid, ' and activity ', data.activityId);
    if (!data.uid || !data.activityId) {
        reject('something was undefined: activityId: ' + data.activityId + '   uid: ' + data.uid);
    } else {
        var stream = new StreamNomNom(data.uid, data.activityId, resolve, reject);
    }
});