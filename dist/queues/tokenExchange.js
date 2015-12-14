'use strict';

var _fb = require('../utils/fb');

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _stravaV = require('strava-v3');

var _stravaV2 = _interopRequireDefault(_stravaV);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var queue = new _firebaseQueue2.default(_fb.tokenExchangeQueueRef, function (data, progress, resolve, reject) {
    var code = data.code;
    console.log('exchanging token for', code);
    _stravaV2.default.oauth.getToken(code, function (err, res) {
        if (err || res.errors) {
            reject(JSON.stringify(res));
            console.error(err, res);
        } else {
            console.info('got athlete', res);
            var access_token = res.access_token;
            var athlete = res.athlete;

            var uid = athlete.id;
            // store access token on the user
            athlete.access_token = access_token;
            // store the athlete
            (0, _fb.userRef)(uid).set(athlete);
            // Store the code -> uid mapping
            (0, _fb.uidByCodeRef)(code).set(uid);
            // Immediately fetch athelete data from strava
            _fb.activityNomNomQueueRef.child('tasks').push({ uid: uid });
            // Done
            resolve();
        }
    });
});