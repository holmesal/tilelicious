'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.trackActivityCount = exports.associateAthleteData = undefined;

var _mixpanel = require('mixpanel');

var _mixpanel2 = _interopRequireDefault(_mixpanel);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mixpanel = _mixpanel2.default.init(process.env.MIXPANEL_TOKEN);

var associateAthleteData = exports.associateAthleteData = function associateAthleteData(uid, stravaAthlete) {
	mixpanel.people.set(uid, {
		'$email': stravaAthlete.email,
		'$first_name': stravaAthlete.firstname,
		'$last_name': stravaAthlete.lastname,
		'strava_uid': stravaAthlete.id,
		'strava_username': stravaAthlete.username,
		'strava_premium_member': stravaAthlete.premium,
		'strava_country': stravaAthlete.country,
		'strava_city': stravaAthlete.city,
		'strava_state': stravaAthlete.state
	});
};

var trackActivityCount = exports.trackActivityCount = function trackActivityCount(uid, activityCount) {
	mixpanel.people.set(uid, {
		activityCount: activityCount
	});
};