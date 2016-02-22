'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _stravaV = require('strava-v3');

var _stravaV2 = _interopRequireDefault(_stravaV);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fb = require('../utils/fb');

var _StreamNomNom = require('./StreamNomNom');

var _StreamNomNom2 = _interopRequireDefault(_StreamNomNom);

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PER_PAGE = 200;

var ActivityNomNom = function () {
    function ActivityNomNom(uid, resolve, reject) {
        var _this = this;

        _classCallCheck(this, ActivityNomNom);

        this.uid = uid;
        this.resolve = resolve;
        this.reject = reject;

        this.userActivityRef = (0, _fb.userActivityRef)(uid);

        // Fetch the token to use with this request
        _log2.default.info('fetching token for ', this.uid);
        (0, _fb.userRef)(this.uid).child('access_token').once('value', function (snap) {
            var token = snap.val();
            _log2.default.info('got token, ', token);
            if (!token) {
                reject('could not find this user token, got: ' + token);
            } else {
                _this.access_token = token;
                // Immediately fetch activities
                _this.fetchActivities();
            }
        });
    }

    _createClass(ActivityNomNom, [{
        key: 'fetchActivities',
        value: function fetchActivities() {
            var _this2 = this;

            var page = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];

            _log2.default.info('fetching activities page ' + page + ' for athlete ' + this.uid);
            _stravaV2.default.athlete.listActivities({
                per_page: PER_PAGE,
                page: page,
                id: this.uid,
                access_token: this.access_token
            }, function (err, res) {
                if (err || res.errors) {
                    _this2.reject(JSON.stringify(res));
                    _log2.default.error(err, res);
                } else {
                    var activities = res;
                    if (activities.length > 0) {
                        _log2.default.info('got ' + activities.length + ' activities, starting with id: ' + activities[0].id);
                        // Save these activities to firebase
                        _this2.pushActivitiesToFirebase(activities);
                        if (activities.length === PER_PAGE) {
                            var nextPage = page + 1;
                            _log2.default.info('page is ', page, ' next page is ', nextPage);
                            _this2.fetchActivities(page + 1);
                        } else {
                            _log2.default.info('done fetching activities');
                            _this2.resolve();
                        }
                    } else {
                        _log2.default.info('user ' + _this2.uid + ' had no activities');
                        _this2.resolve();
                    }
                }
            });
        }
    }, {
        key: 'pushActivitiesToFirebase',
        value: function pushActivitiesToFirebase(activities) {
            var _this3 = this;

            _lodash2.default.forEach(activities, function (activity) {
                activity.created = Date.now();
                _this3.userActivityRef.child(activity.id).set(_lodash2.default.pick(activity, 'id', 'created', 'start_latlng', 'end_latlng', 'location_city', 'location_country', 'location_state', 'type', 'athlete'));

                // DANGER - uncomment this line to pull in stream data for all of these activities
                //new StreamNomNom(this.uid, activity.id)
            });
        }
    }]);

    return ActivityNomNom;
}();

_log2.default.info('activityNomNom queue up and running');

var queue = new _firebaseQueue2.default(_fb.activityNomNomQueueRef, function (data, progress, resolve, reject) {
    _log2.default.info('activityNomNomQueue running for user: ', data.uid);
    var activity = new ActivityNomNom(data.uid, resolve, reject);
});