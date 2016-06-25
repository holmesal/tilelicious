import Mixpanel from 'mixpanel';

const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);

export const associateAthleteData = (uid, stravaAthlete) => {
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
}

export const trackActivityCount = (uid, activityCount) => {
	mixpanel.people.set(uid, {
		activityCount
	});
}